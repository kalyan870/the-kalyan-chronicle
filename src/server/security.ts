import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';

export function createSecurityHeadersMiddleware() {
  const baseHelmet = helmet({
    frameguard: false,
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        'default-src': ["'self'"],
        'script-src': [
          "'self'",
          "'unsafe-inline'",
          'https://apis.google.com',
          'https://www.gstatic.com',
          'https://*.clerk.accounts.dev',
        ],
        'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        'font-src': ["'self'", 'data:', 'https://fonts.gstatic.com'],
        'img-src': ["'self'", 'data:', 'blob:', 'https:'],
        'connect-src': [
          "'self'",
          'https://*.googleapis.com',
          'https://*.firebaseio.com',
          'https://securetoken.googleapis.com',
          'https://identitytoolkit.googleapis.com',
          'https://*.clerk.accounts.dev',
          'https://api.github.com',
          'https://saragadamkalyan.substack.com',
        ],
        'frame-src': [
          "'self'",
          'blob:',
          'https://accounts.google.com',
          'https://*.firebaseapp.com',
          'https://*.clerk.accounts.dev',
        ],
        'object-src': ["'none'"],
        'base-uri': ["'self'"],
        'form-action': ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
    crossOriginResourcePolicy: false,
    originAgentCluster: true,
    xPermittedCrossDomainPolicies: { permittedPolicies: 'none' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  });

  return (req: Request, res: Response, next: NextFunction) => {
    res.setHeader(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()'
    );
    baseHelmet(req, res, next);
  };
}

const SAFE_HOST_REGEX = /^[a-zA-Z0-9.-]+(?::\d{1,5})?$/;

export function resolveSafeBaseUrl(req?: Request): string {
  const envUrl = (process.env.APP_URL || '').trim();
  if (envUrl && envUrl !== 'MY_APP_URL' && /^https?:\/\//i.test(envUrl)) {
    try {
      const parsed = new URL(envUrl);
      if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
        return envUrl.replace(/\/+$/, '');
      }
    } catch {
      // Fallback below
    }
  }
  const forwardedHostRaw = req?.get('x-forwarded-host')?.split(',')[0]?.trim() || '';
  const hostRaw = forwardedHostRaw || req?.get('host')?.trim() || '';
  if (hostRaw && SAFE_HOST_REGEX.test(hostRaw) && hostRaw.length <= 253) {
    const protoRaw = req?.get('x-forwarded-proto')?.split(',')[0]?.trim().toLowerCase();
    const proto = protoRaw === 'https' || req?.secure ? 'https' : req?.protocol === 'https' ? 'https' : 'http';
    return `${proto}://${hostRaw}`;
  }
  return 'https://kalyannexus.vercel.app';
}

export function enforceSameOriginMutations(req: Request, res: Response, next: NextFunction): void {
  const method = req.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    next();
    return;
  }

  const originHeader = req.get('origin')?.trim();
  // Machine-to-machine CLI/curl/webhook calls omit Origin; Bearer/service tokens are checked separately
  if (!originHeader || originHeader === 'null') {
    next();
    return;
  }

  try {
    const originHost = new URL(originHeader).host.toLowerCase();
    const requestHosts = new Set<string>();
    const forwardedHost = req.get('x-forwarded-host')?.split(',')[0]?.trim().toLowerCase();
    const directHost = req.get('host')?.trim().toLowerCase();
    if (forwardedHost && SAFE_HOST_REGEX.test(forwardedHost)) requestHosts.add(forwardedHost);
    if (directHost && SAFE_HOST_REGEX.test(directHost)) requestHosts.add(directHost);

    const envUrl = (process.env.APP_URL || '').trim();
    if (envUrl && envUrl !== 'MY_APP_URL') {
      try {
        requestHosts.add(new URL(envUrl).host.toLowerCase());
      } catch {
        // Ignore invalid APP_URL
      }
    }

    if (requestHosts.has(originHost)) {
      next();
      return;
    }

    res.status(403).json({ error: 'Cross-origin state-changing request rejected.' });
  } catch {
    res.status(403).json({ error: 'Invalid request origin header.' });
  }
}

export const apiGeneralLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 120,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many requests from this IP. Please retry in a few minutes.' },
});

export const apiMutationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Rate limit exceeded for write/email/upload operations. Please wait shortly.' },
});

export const aiInferenceLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: process.env.NODE_ENV === 'production' ? 40 : 120,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'AI query rate limit reached. Please retry in a few minutes.' },
});

export const subscribeStrictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Subscription rate limit reached. Please retry in a few minutes.' },
});

function sanitizePlainInput(value: string): string {
  return value.replace(/[\u0000-\u001F\u007F<>]/g, '').trim();
}

export const analyzePackageSchema = z.object({
  packageJson: z.string().trim().min(2, 'Please provide a valid package.json payload.').max(150_000),
});

export const saveEditionSchema = z.object({
  title: z.string().transform(sanitizePlainInput).pipe(z.string().min(1).max(160)).optional(),
  notes: z.string().transform(sanitizePlainInput).pipe(z.string().max(500)).optional(),
});

const ALLOWED_MEDIA_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'application/pdf',
  'application/json',
]);

export const presignUploadSchema = z.object({
  fileName: z.string().trim().min(1, 'File name is required.').max(180),
  contentType: z
    .string()
    .trim()
    .refine((val) => ALLOWED_MEDIA_TYPES.has(val), {
      message: 'Permitted media types: PNG, JPEG, WEBP, GIF, PDF, or JSON.',
    }),
  byteSize: z
    .number()
    .int()
    .min(1, 'File cannot be empty.')
    .max(10 * 1024 * 1024, 'Media asset exceeds the 10 MB upload cap.'),
});

export const registerMediaSchema = z.object({
  fileName: z.string().trim().min(1).max(180),
  contentType: z.string().trim().refine((val) => ALLOWED_MEDIA_TYPES.has(val)),
  byteSize: z.number().int().min(1).max(10 * 1024 * 1024),
  objectKey: z.string().trim().min(5).max(300),
});

export const newsletterDispatchSchema = z.object({
  to: z.string().trim().email('Please provide a valid recipient email address.').optional().or(z.literal('')),
  subject: z.string().trim().max(200).optional(),
  editionTitle: z.string().trim().max(160).optional(),
  note: z.string().trim().max(500).optional(),
  previewOnly: z.boolean().optional(),
});

export const subscribeDigestSchema = z.object({
  email: z.string().trim().email('Please enter a valid email address.').max(180),
  name: z
    .string()
    .transform((v) => v.replace(/[\u0000-\u001F\u007F<>]/g, '').trim())
    .pipe(z.string().max(100))
    .optional(),
});

export const automationTriggerSchema = z.object({
  triggerSource: z
    .enum(['vercel-cron', 'github-actions', 'cloudflare-trigger', 'manual-press-run', 'backend-scheduler'])
    .optional(),
  sendNewsletter: z.boolean().optional(),
  recipientEmail: z
    .string()
    .trim()
    .email('Please provide a valid recipient email address.')
    .optional()
    .or(z.literal('')),
});

export const storageObjectSchema = z.object({
  key: z.string().trim().min(5).max(240),
  contentType: z.string().trim().max(120).optional(),
  payload: z.unknown(),
});

export const traceAuditSchema = z.object({
  traceId: z.string().trim().max(100).optional(),
  spans: z
    .array(
      z.object({
        id: z.string().trim().min(1).max(80),
        name: z.string().trim().min(1).max(120),
        kind: z.enum(['retrieval', 'tool', 'llm', 'guardrail']),
        httpStatus: z.number().int().min(100).max(599).optional(),
        status: z.enum(['ok', 'error']).optional(),
        durationMs: z.number().min(0).max(120000),
        inputTokens: z.number().int().min(0).max(2_000_000).optional(),
        outputTokens: z.number().int().min(0).max(2_000_000).optional(),
        itemsReturned: z.number().int().min(0).max(10000).optional(),
        outputSummary: z.string().max(1000).optional(),
      })
    )
    .min(1)
    .max(40),
});

export const evalMatrixSchema = z.object({
  baselineLabel: z.string().trim().min(1).max(60).default('main-baseline'),
  candidateLabel: z.string().trim().min(1).max(60).default('pr-hybrid-rerank'),
  baselineTopK: z.number().int().min(1).max(8).default(2),
  candidateTopK: z.number().int().min(1).max(8).default(4),
  candidateExpandSynonyms: z.boolean().default(true),
  cases: z
    .array(
      z.object({
        id: z.string().trim().min(1).max(40),
        question: z.string().trim().min(3).max(300),
        expectedTerms: z.array(z.string().trim().min(1).max(60)).min(1).max(12),
      })
    )
    .min(1)
    .max(20),
});

export function verifyCronBearerToken(authHeader: string | undefined, expectedSecret: string | undefined): boolean {
  if (!expectedSecret || !authHeader) return false;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return false;
  const suppliedBuf = Buffer.from(match[1].trim(), 'utf-8');
  const expectedBuf = Buffer.from(expectedSecret.trim(), 'utf-8');
  if (suppliedBuf.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(suppliedBuf, expectedBuf);
}

export function isSafeObjectKey(key: string, prefix: 'editions/' | 'media/' | 'storage/'): boolean {
  if (!key || key.includes('..') || key.includes('\\') || key.startsWith('/')) {
    return false;
  }
  if (!key.startsWith(prefix)) {
    return false;
  }
  return /^[a-zA-Z0-9._/-]+$/.test(key);
}

const EPHEMERAL_UNSUBSCRIBE_KEY = crypto.randomBytes(32).toString('hex');

function getUnsubscribeSigningKey(): string {
  return (
    process.env.UNSUBSCRIBE_SECRET ||
    process.env.CRON_SECRET ||
    process.env.CLERK_SECRET_KEY ||
    EPHEMERAL_UNSUBSCRIBE_KEY
  ).trim();
}

function toBase64Url(input: Buffer | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf-8') : input;
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function fromBase64Url(segment: string): string | null {
  try {
    const padded = segment.replace(/-/g, '+').replace(/_/g, '/');
    return Buffer.from(padded, 'base64').toString('utf-8');
  } catch {
    return null;
  }
}

export function createUnsubscribeToken(email: string): string {
  const normalized = email.trim().toLowerCase();
  const payload = toBase64Url(normalized);
  const sig = crypto
    .createHmac('sha256', getUnsubscribeSigningKey())
    .update(payload)
    .digest();
  return `${payload}.${toBase64Url(sig)}`;
}

export function verifyUnsubscribeToken(token: string): string | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.trim().split('.');
  if (parts.length !== 2) return null;
  const [payload, suppliedSig] = parts;
  if (!payload || !suppliedSig) return null;

  const expectedSig = toBase64Url(
    crypto.createHmac('sha256', getUnsubscribeSigningKey()).update(payload).digest()
  );
  const suppliedBuf = Buffer.from(suppliedSig, 'utf-8');
  const expectedBuf = Buffer.from(expectedSig, 'utf-8');
  if (suppliedBuf.length !== expectedBuf.length) return null;
  if (!crypto.timingSafeEqual(suppliedBuf, expectedBuf)) return null;

  const decoded = fromBase64Url(payload);
  if (!decoded) return null;
  const parsed = subscribeDigestSchema.shape.email.safeParse(decoded);
  return parsed.success ? parsed.data.toLowerCase() : null;
}


