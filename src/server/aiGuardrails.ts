import { z } from 'zod';

export type GuardrailRiskCategory =
  | 'prompt-injection'
  | 'unicode-smuggling'
  | 'encoded-smuggling'
  | 'secret-exfiltration'
  | 'xss-injection'
  | 'command-or-sql-injection'
  | 'ssrf-attempt'
  | 'invalid-input';

export interface GuardrailValidationResult {
  allowed: boolean;
  sanitizedQuery: string;
  sanitizedSessionId: string;
  blockedReason?: string;
  riskCategory?: GuardrailRiskCategory;
  flags: string[];
}

const SESSION_ID_REGEX = /^[a-zA-Z0-9_-]{4,80}$/;

// Detects Unicode Tags (U+E0000-U+E007F) and Bidi directional override controls
const UNICODE_TAG_SMUGGLING_REGEX = /[\u{E0000}-\u{E007F}]/u;
const BIDI_OVERRIDE_REGEX = /[\u202A-\u202E\u2066-\u2069]/;
const INVISIBLE_FORMAT_REGEX = /[\u200B-\u200F\u2060-\u2064\uFEFF\u00AD\u034F]/g;

const INJECTION_RULES: Array<{
  pattern: RegExp;
  category: GuardrailRiskCategory;
  reason: string;
  flag: string;
}> = [
  {
    pattern:
      /\b(ignore|disregard|forget|override|bypass)\b[\s\S]{0,40}\b(previous|prior|above|system|safety|rules|instructions|guardrails)\b/i,
    category: 'prompt-injection',
    reason: 'Query violates editorial assistant safety policies.',
    flag: 'instruction-override',
  },
  {
    pattern:
      /\b(jailbreak|dan\s*mode|developer\s*mode|unrestricted\s*mode|act\s+as\s+root)\b/i,
    category: 'prompt-injection',
    reason: 'Query attempts to bypass assistant operating boundaries.',
    flag: 'jailbreak-persona',
  },
  {
    pattern:
      /(<\/?\s*(?:untrusted_retrieved_context|prior_conversation|system|developer|assistant_instructions)\b|<<\s*SYS\s*>>|\[INST\]|<\|im_start\|>|<\|endoftext\|>|^###\s*System:)/im,
    category: 'prompt-injection',
    reason: 'Structured prompt delimiter injection is not permitted.',
    flag: 'delimiter-forgery',
  },
  {
    pattern:
      /\b(reveal|print|dump|leak|expose|show)\b[\s\S]{0,40}\b(system\s*prompt|process\.env|environment\s*variables|api[_\s-]*key|secret|database_url|clerk_secret|resend_api|r2_secret)\b/i,
    category: 'secret-exfiltration',
    reason: 'Requests to inspect server configuration or credentials are not permitted.',
    flag: 'secret-exfiltration',
  },
  {
    pattern: /(<\s*script\b|javascript:|vbscript:|data:text\/html|onerror\s*=|onload\s*=|<\s*iframe\b)/i,
    category: 'xss-injection',
    reason: 'Potentially unsafe HTML or script markup was rejected.',
    flag: 'xss-markup',
  },
  {
    pattern: /(\bUNION\s+SELECT\b|\bDROP\s+TABLE\b|;\s*DELETE\s+FROM\b|\$\(\s*curl|\brm\s+-rf\b)/i,
    category: 'command-or-sql-injection',
    reason: 'Potentially unsafe command or SQL syntax was rejected.',
    flag: 'command-sql-pattern',
  },
  {
    pattern: /(169\.254\.169\.254|metadata\.google\.internal|file:\/\/\/|\/etc\/passwd)/i,
    category: 'ssrf-attempt',
    reason: 'Internal resource probing patterns are blocked.',
    flag: 'internal-probe',
  },
];

export const ragQueryInputSchema = z.object({
  query: z
    .string()
    .trim()
    .min(2, 'Please enter a question of at least 2 characters.')
    .max(800, 'Question exceeds 800 character limit.'),
  sessionId: z.string().trim().regex(SESSION_ID_REGEX, 'Invalid session identifier format.').optional(),
});

export function stripControlChars(input: string, trim = true): string {
  const withoutTags = input.replace(/[\u{E0000}-\u{E007F}]/gu, '');
  const withoutInvisible = withoutTags
    .replace(BIDI_OVERRIDE_REGEX, '')
    .replace(INVISIBLE_FORMAT_REGEX, '');
  const cleaned = withoutInvisible
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .normalize('NFKC');
  return trim ? cleaned.trim() : cleaned;
}

function extractDecodedInspectablePayloads(text: string): string[] {
  const decoded: string[] = [];

  if (/%[0-9A-Fa-f]{2}/.test(text)) {
    try {
      const pct = decodeURIComponent(text.replace(/\+/g, ' '));
      if (pct && pct !== text) {
        decoded.push(stripControlChars(pct));
      }
    } catch {
      // Ignore malformed percent-encoding
    }
  }

  const b64Candidates = text.match(/\b[A-Za-z0-9+/]{16,}={0,2}\b/g) || [];
  for (const token of b64Candidates.slice(0, 4)) {
    try {
      const buf = Buffer.from(token, 'base64');
      const utf8 = buf.toString('utf8');
      // Only inspect printable UTF-8 decoded candidates
      if (utf8.length >= 8 && /^[\x20-\x7E\s]+$/.test(utf8)) {
        decoded.push(stripControlChars(utf8));
      }
    } catch {
      // Ignore invalid base64
    }
  }

  return decoded;
}

export function validateRagInput(rawQuery: unknown, rawSessionId?: unknown): GuardrailValidationResult {
  const safeSession =
    typeof rawSessionId === 'string' && SESSION_ID_REGEX.test(rawSessionId.trim())
      ? rawSessionId.trim()
      : 'default-edition-session';

  if (typeof rawSessionId === 'string' && !SESSION_ID_REGEX.test(rawSessionId.trim())) {
    return {
      allowed: false,
      sanitizedQuery: '',
      sanitizedSessionId: safeSession,
      blockedReason: 'Invalid session identifier format.',
      riskCategory: 'invalid-input',
      flags: ['invalid-session-id'],
    };
  }

  const rawStr = typeof rawQuery === 'string' ? rawQuery : '';

  if (UNICODE_TAG_SMUGGLING_REGEX.test(rawStr) || BIDI_OVERRIDE_REGEX.test(rawStr)) {
    return {
      allowed: false,
      sanitizedQuery: stripControlChars(rawStr).slice(0, 800),
      sanitizedSessionId: safeSession,
      blockedReason: 'Hidden Unicode tag or directional override characters are not permitted.',
      riskCategory: 'unicode-smuggling',
      flags: ['unicode-tag-or-bidi-smuggling'],
    };
  }

  const normalized = stripControlChars(rawStr);
  const parsed = ragQueryInputSchema.safeParse({
    query: normalized,
    sessionId: safeSession,
  });

  if (!parsed.success) {
    return {
      allowed: false,
      sanitizedQuery: normalized.slice(0, 800),
      sanitizedSessionId: safeSession,
      blockedReason: parsed.error.issues[0]?.message || 'Invalid query payload.',
      riskCategory: 'invalid-input',
      flags: ['schema-validation-failed'],
    };
  }

  const flags: string[] = [];
  for (const rule of INJECTION_RULES) {
    if (rule.pattern.test(parsed.data.query)) {
      flags.push(rule.flag);
      return {
        allowed: false,
        sanitizedQuery: parsed.data.query,
        sanitizedSessionId: safeSession,
        blockedReason: rule.reason,
        riskCategory: rule.category,
        flags,
      };
    }
  }

  const decodedPayloads = extractDecodedInspectablePayloads(parsed.data.query);
  for (const candidate of decodedPayloads) {
    for (const rule of INJECTION_RULES) {
      if (rule.pattern.test(candidate)) {
        return {
          allowed: false,
          sanitizedQuery: parsed.data.query,
          sanitizedSessionId: safeSession,
          blockedReason: 'Encoded prompt injection or unsafe payload was detected and blocked.',
          riskCategory: 'encoded-smuggling',
          flags: ['encoded-payload-smuggling', rule.flag],
        };
      }
    }
  }

  return {
    allowed: true,
    sanitizedQuery: parsed.data.query,
    sanitizedSessionId: safeSession,
    flags,
  };
}

export function sanitizeRetrievedContext(rawChunk: string): string {
  let clean = stripControlChars(rawChunk);
  clean = clean
    .replace(/<\/?\s*(?:untrusted_retrieved_context|prior_conversation|system|developer)\b[^>]*>/gi, '')
    .replace(/<<\s*SYS\s*>>|\[INST\]|<\|im_start\|>|<\|endoftext\|>/gi, '')
    .replace(
      /\b(ignore|disregard|override)\b[\s\S]{0,40}\b(previous|prior|system|safety|instructions)\b/gi,
      '[filtered-directive]'
    );
  return clean;
}

function scrubOutputCore(rawText: string, preserveEdgeWhitespace: boolean): string {
  let clean = stripControlChars(rawText, !preserveEdgeWhitespace);

  clean = clean
    .replace(/<\s*script[\s\S]*?>[\s\S]*?<\s*\/\s*script\s*>/gi, '')
    .replace(/<\/?[a-z][^>]*>/gi, '')
    .replace(/!\[[^\]]*\]\(\s*https?:\/\/[^)]+\)/gi, '[removed-external-image]')
    .replace(/(?:javascript|vbscript):/gi, '')
    .replace(/data:text\/html[^ \s)]*/gi, '[removed-unsafe-uri]')
    .replace(/AIza[0-9A-Za-z_-]{20,}/g, '[redacted-key]')
    .replace(/\b(sk-ant-[0-9A-Za-z_-]{16,}|sk-proj-[0-9A-Za-z_-]{16,})/g, '[redacted-token]')
    .replace(/\b(ghp|gho|ghs|ghu)_[0-9A-Za-z]{20,}\b/g, '[redacted-token]')
    .replace(/\bgithub_pat_[0-9A-Za-z_]{20,}\b/g, '[redacted-token]')
    .replace(/\bAKIA[0-9A-Z]{16}\b/g, '[redacted-key]')
    .replace(/\bxox[baprs]-[0-9A-Za-z-]{12,}\b/g, '[redacted-token]')
    .replace(/\b(sk|pk)_(live|test)_[0-9A-Za-z]{12,}/g, '[redacted-token]')
    .replace(/\bre_[0-9A-Za-z_]{16,}/g, '[redacted-key]')
    .replace(/postgres(?:ql)?:\/\/[^\s'"]+/gi, '[redacted-connection]')
    .replace(/\bBearer\s+[A-Za-z0-9._-]{20,}/gi, 'Bearer [redacted]')
    .replace(/\bprocess\.env\.[A-Z0-9_]+/g, '[redacted-env]');

  // Redact unintended non-public emails while keeping Kalyan's published broadsheet email
  clean = clean.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, (match) =>
    match.toLowerCase() === 'saragadamkalyan068@gmail.com' ? match : '[redacted-email]'
  );

  return preserveEdgeWhitespace ? clean.slice(0, 3500) : clean.slice(0, 3500).trim();
}

export function sanitizeAiOutput(rawText: string): string {
  return scrubOutputCore(rawText, false);
}

export function sanitizeStreamingDelta(rawPiece: string): string {
  return scrubOutputCore(rawPiece, true);
}
