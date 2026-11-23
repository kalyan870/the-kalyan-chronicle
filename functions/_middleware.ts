interface CloudflareEnv {
  CLOUDFLARE_ACCESS_TEAM_DOMAIN?: string;
  CLOUDFLARE_ACCESS_AUD?: string;
  CLOUDFLARE_ACCESS_SERVICE_TOKEN_ID?: string;
  CLOUDFLARE_ACCESS_SERVICE_TOKEN_SECRET?: string;
}

interface PagesContext {
  request: Request;
  env: CloudflareEnv;
  next: () => Promise<Response>;
}

function decodeBase64Url(str: string): Uint8Array<ArrayBuffer> {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return bytes;
}

function decodeJsonSegment<T>(seg: string): T | null {
  try {
    return JSON.parse(new TextDecoder().decode(decodeBase64Url(seg))) as T;
  } catch {
    return null;
  }
}

function readCookie(cookieHeader: string | null, name: string): string {
  if (!cookieHeader) return '';
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx > 0 && part.slice(0, idx).trim() === name) {
      const raw = part.slice(idx + 1).trim();
      try {
        return decodeURIComponent(raw);
      } catch {
        return raw;
      }
    }
  }
  return '';
}

function constantTimeMatch(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function onRequest(context: PagesContext): Promise<Response> {
  const { request, env, next } = context;
  const url = new URL(request.url);

  const isProtectedMutation =
    url.pathname.startsWith('/api/r2/') ||
    url.pathname.startsWith('/api/storage/') ||
    url.pathname.startsWith('/api/email/') ||
    url.pathname.startsWith('/api/newsletter/send') ||
    url.pathname.startsWith('/api/automation/run');

  const hasJwtGate = Boolean(env.CLOUDFLARE_ACCESS_TEAM_DOMAIN && env.CLOUDFLARE_ACCESS_AUD);
  const hasServiceGate = Boolean(
    env.CLOUDFLARE_ACCESS_SERVICE_TOKEN_ID && env.CLOUDFLARE_ACCESS_SERVICE_TOKEN_SECRET
  );

  if (!isProtectedMutation || (!hasJwtGate && !hasServiceGate)) {
    return next();
  }

  const clientId = (request.headers.get('CF-Access-Client-Id') || '').trim();
  const clientSecret = (request.headers.get('CF-Access-Client-Secret') || '').trim();
  if (hasServiceGate && clientId && clientSecret) {
    if (
      constantTimeMatch(clientId, env.CLOUDFLARE_ACCESS_SERVICE_TOKEN_ID!) &&
      constantTimeMatch(clientSecret, env.CLOUDFLARE_ACCESS_SERVICE_TOKEN_SECRET!)
    ) {
      return next();
    }
    return new Response(JSON.stringify({ error: 'Invalid Access service token.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const assertion = (
    request.headers.get('Cf-Access-Jwt-Assertion') ||
    readCookie(request.headers.get('Cookie'), 'CF_Authorization')
  ).trim();
  if (!assertion || !hasJwtGate) {
    return new Response(JSON.stringify({ error: 'Access assertion required.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const parts = assertion.split('.');
  if (parts.length !== 3) {
    return new Response(JSON.stringify({ error: 'Invalid Access token.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const [headerSeg, payloadSeg, sigSeg] = parts;
  const header = decodeJsonSegment<{ alg?: string; kid?: string }>(headerSeg);
  const payload = decodeJsonSegment<{
    aud?: string | string[];
    iss?: string;
    exp?: number;
    iat?: number;
    nbf?: number;
  }>(payloadSeg);
  const nowSec = Math.floor(Date.now() / 1000);
  const normalizedDomain = env.CLOUDFLARE_ACCESS_TEAM_DOMAIN!.replace(/^https?:\/\//, '').replace(/\/+$/, '');
  const audList = Array.isArray(payload?.aud) ? payload.aud : payload?.aud ? [payload.aud] : [];

  if (
    !header?.kid ||
    header.alg !== 'RS256' ||
    !payload?.exp ||
    payload.exp <= nowSec ||
    (payload.iat && payload.iat > nowSec + 300) ||
    (payload.nbf && payload.nbf > nowSec + 300) ||
    payload.iss !== `https://${normalizedDomain}` ||
    !audList.includes(env.CLOUDFLARE_ACCESS_AUD!)
  ) {
    return new Response(JSON.stringify({ error: 'Unauthorized Access assertion.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const certsRes = await fetch(`https://${normalizedDomain}/cdn-cgi/access/certs`);
  if (!certsRes.ok) {
    return new Response(JSON.stringify({ error: 'Unable to validate Access signing keys.' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const certsJson = (await certsRes.json()) as { keys?: Array<JsonWebKey & { kid?: string }> };
  const matchingKey = certsJson.keys?.find((k) => k.kid === header.kid);
  if (!matchingKey) {
    return new Response(JSON.stringify({ error: 'Unknown Access key.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const cryptoKey = await crypto.subtle.importKey(
    'jwk',
    matchingKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify']
  );

  const encodedPayload = new TextEncoder().encode(`${headerSeg}.${payloadSeg}`);
  const payloadBuffer = new Uint8Array(new ArrayBuffer(encodedPayload.byteLength));
  payloadBuffer.set(encodedPayload);

  const verified = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    decodeBase64Url(sigSeg),
    payloadBuffer
  );

  if (!verified) {
    return new Response(JSON.stringify({ error: 'Invalid Access signature.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return next();
}
