import crypto, { X509Certificate } from 'crypto';
import fs from 'fs';
import path from 'path';
import type { NextFunction, Request, Response } from 'express';
import { getAuth } from '@clerk/express';
import { projectRoot } from './runtimePaths.ts';

export type AuthProviderName =
  | 'clerk'
  | 'firebase'
  | 'cloudflare-access'
  | 'cloudflare-service-token'
  | 'preview-editor'
  | 'none';

export interface VerifiedIdentity {
  authenticated: boolean;
  provider: AuthProviderName;
  userId?: string;
  email?: string;
  error?: string;
}

export interface AuthResolverOverrides {
  firebaseCertsByKid?: Record<string, string>;
  cloudflareJwksByKid?: Record<string, crypto.JsonWebKey>;
  firebaseProjectId?: string;
  cloudflareTeamDomain?: string;
  cloudflareAud?: string;
  cloudflareServiceTokenId?: string;
  cloudflareServiceTokenSecret?: string;
}

let firebaseCertCache: { certs: Record<string, string>; expiresAt: number } | null = null;
let cloudflareJwkCache: { keys: Record<string, crypto.JsonWebKey>; expiresAt: number } | null = null;

function readBundledFirebaseProjectId(): string {
  if (process.env.FIREBASE_PROJECT_ID) {
    return process.env.FIREBASE_PROJECT_ID.trim();
  }
  try {
    const cfgPath = path.resolve(projectRoot, 'firebase-applet-config.json');
    if (fs.existsSync(cfgPath)) {
      const parsed = JSON.parse(fs.readFileSync(cfgPath, 'utf-8')) as { projectId?: string };
      return parsed.projectId?.trim() || '';
    }
  } catch {
    // Ignore read error
  }
  return '';
}

export function isClerkEnabled(): boolean {
  return Boolean(process.env.CLERK_SECRET_KEY && process.env.VITE_CLERK_PUBLISHABLE_KEY);
}

export function isFirebaseAuthConfigured(): boolean {
  return Boolean(readBundledFirebaseProjectId());
}

export function isCloudflareAccessJwtConfigured(): boolean {
  return Boolean(process.env.CLOUDFLARE_ACCESS_TEAM_DOMAIN && process.env.CLOUDFLARE_ACCESS_AUD);
}

export function isCloudflareServiceTokenConfigured(): boolean {
  return Boolean(
    process.env.CLOUDFLARE_ACCESS_SERVICE_TOKEN_ID &&
      process.env.CLOUDFLARE_ACCESS_SERVICE_TOKEN_SECRET
  );
}

export function isCloudflareAccessConfigured(): boolean {
  return isCloudflareAccessJwtConfigured() || isCloudflareServiceTokenConfigured();
}

function timingSafeCompare(supplied: string, expected: string): boolean {
  const suppliedBuf = Buffer.from(supplied, 'utf-8');
  const expectedBuf = Buffer.from(expected, 'utf-8');
  if (suppliedBuf.length !== expectedBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(suppliedBuf, expectedBuf);
}

function decodeBase64UrlJson<T>(segment: string): T | null {
  try {
    const padded = segment.replace(/-/g, '+').replace(/_/g, '/');
    const json = Buffer.from(padded, 'base64').toString('utf-8');
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader) return {};
  const result: Record<string, string> = {};
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx > 0) {
      const k = part.slice(0, idx).trim();
      const rawVal = part.slice(idx + 1).trim();
      try {
        result[k] = decodeURIComponent(rawVal);
      } catch {
        result[k] = rawVal;
      }
    }
  }
  return result;
}

async function fetchFirebasePublicCerts(forceRefresh = false): Promise<Record<string, string>> {
  const now = Date.now();
  if (!forceRefresh && firebaseCertCache && firebaseCertCache.expiresAt > now) {
    return firebaseCertCache.certs;
  }
  const res = await fetch(
    'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com',
    { signal: AbortSignal.timeout(5000) }
  );
  if (!res.ok) {
    throw new Error('Unable to fetch Firebase verification certificates.');
  }
  const certs = (await res.json()) as Record<string, string>;
  const cacheControl = res.headers.get('cache-control') || '';
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/i);
  const ttlMs = maxAgeMatch ? Number(maxAgeMatch[1]) * 1000 : 1800 * 1000;
  firebaseCertCache = { certs, expiresAt: now + ttlMs };
  return certs;
}

async function fetchCloudflareAccessJwks(
  teamDomain: string,
  forceRefresh = false
): Promise<Record<string, crypto.JsonWebKey>> {
  const now = Date.now();
  if (!forceRefresh && cloudflareJwkCache && cloudflareJwkCache.expiresAt > now) {
    return cloudflareJwkCache.keys;
  }
  const normalizedDomain = teamDomain.replace(/^https?:\/\//, '').replace(/\/+$/, '');
  const res = await fetch(`https://${normalizedDomain}/cdn-cgi/access/certs`, {
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) {
    throw new Error('Unable to fetch Cloudflare Access JWKS.');
  }
  const payload = (await res.json()) as { keys?: Array<crypto.JsonWebKey & { kid?: string }> };
  const keys: Record<string, crypto.JsonWebKey> = {};
  for (const jwk of payload.keys || []) {
    if (jwk.kid) {
      keys[jwk.kid] = jwk;
    }
  }
  cloudflareJwkCache = { keys, expiresAt: now + 15 * 60 * 1000 };
  return keys;
}

export async function verifyFirebaseIdToken(
  token: string,
  overrides?: AuthResolverOverrides
): Promise<VerifiedIdentity> {
  const projectId = overrides?.firebaseProjectId || readBundledFirebaseProjectId();
  if (!projectId) {
    return { authenticated: false, provider: 'firebase', error: 'Firebase projectId is not configured.' };
  }

  if (!token || token.length > 8192) {
    return { authenticated: false, provider: 'firebase', error: 'Malformed Firebase ID token.' };
  }
  const parts = token.split('.');
  if (parts.length !== 3) {
    return { authenticated: false, provider: 'firebase', error: 'Malformed Firebase ID token.' };
  }

  const [headerSeg, payloadSeg, sigSeg] = parts;
  const header = decodeBase64UrlJson<{ alg?: string; kid?: string }>(headerSeg);
  const payload = decodeBase64UrlJson<{
    aud?: string;
    iss?: string;
    sub?: string;
    email?: string;
    email_verified?: boolean;
    exp?: number;
    iat?: number;
    auth_time?: number;
  }>(payloadSeg);

  if (!header || !payload || header.alg !== 'RS256' || !header.kid) {
    return { authenticated: false, provider: 'firebase', error: 'Unsupported Firebase JWT header.' };
  }

  const nowSec = Math.floor(Date.now() / 1000);
  if (!payload.exp || payload.exp <= nowSec) {
    return { authenticated: false, provider: 'firebase', error: 'Firebase token expired.' };
  }
  if (payload.iat && payload.iat > nowSec + 300) {
    return { authenticated: false, provider: 'firebase', error: 'Firebase token issued in the future.' };
  }
  if (payload.auth_time && payload.auth_time > nowSec + 300) {
    return { authenticated: false, provider: 'firebase', error: 'Firebase auth_time is in the future.' };
  }
  if (payload.aud !== projectId) {
    return { authenticated: false, provider: 'firebase', error: 'Firebase token audience mismatch.' };
  }
  if (payload.iss !== `https://securetoken.google.com/${projectId}`) {
    return { authenticated: false, provider: 'firebase', error: 'Firebase token issuer mismatch.' };
  }
  if (payload.email_verified !== true) {
    return { authenticated: false, provider: 'firebase', error: 'Verified email required on Firebase ID token.' };
  }
  if (!payload.sub || typeof payload.sub !== 'string' || payload.sub.length > 128) {
    return { authenticated: false, provider: 'firebase', error: 'Firebase token missing subject.' };
  }

  try {
    let certs = overrides?.firebaseCertsByKid || (await fetchFirebasePublicCerts());
    let certPem = certs[header.kid];
    if (!certPem && !overrides?.firebaseCertsByKid) {
      certs = await fetchFirebasePublicCerts(true);
      certPem = certs[header.kid];
    }
    if (!certPem) {
      return { authenticated: false, provider: 'firebase', error: 'Unknown Firebase signing key.' };
    }

    const verifyKey = certPem.includes('BEGIN CERTIFICATE')
      ? new X509Certificate(certPem).publicKey
      : crypto.createPublicKey(certPem);

    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(`${headerSeg}.${payloadSeg}`);
    verifier.end();
    const signatureBuf = Buffer.from(sigSeg.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
    if (!verifier.verify(verifyKey, signatureBuf)) {
      return { authenticated: false, provider: 'firebase', error: 'Invalid Firebase token signature.' };
    }

    return {
      authenticated: true,
      provider: 'firebase',
      userId: `firebase:${payload.sub}`,
      email: typeof payload.email === 'string' ? payload.email : undefined,
    };
  } catch {
    return { authenticated: false, provider: 'firebase', error: 'Firebase token verification failed.' };
  }
}

export async function verifyCloudflareAccessJwt(
  token: string,
  overrides?: AuthResolverOverrides
): Promise<VerifiedIdentity> {
  const teamDomain = (overrides?.cloudflareTeamDomain || process.env.CLOUDFLARE_ACCESS_TEAM_DOMAIN || '').trim();
  const expectedAud = (overrides?.cloudflareAud || process.env.CLOUDFLARE_ACCESS_AUD || '').trim();
  if (!teamDomain || !expectedAud) {
    return {
      authenticated: false,
      provider: 'cloudflare-access',
      error: 'Cloudflare Access team domain or AUD is not configured.',
    };
  }

  if (!token || token.length > 8192) {
    return { authenticated: false, provider: 'cloudflare-access', error: 'Malformed Cloudflare Access JWT.' };
  }
  const parts = token.split('.');
  if (parts.length !== 3) {
    return { authenticated: false, provider: 'cloudflare-access', error: 'Malformed Cloudflare Access JWT.' };
  }

  const [headerSeg, payloadSeg, sigSeg] = parts;
  const header = decodeBase64UrlJson<{ alg?: string; kid?: string }>(headerSeg);
  const payload = decodeBase64UrlJson<{
    aud?: string | string[];
    iss?: string;
    sub?: string;
    email?: string;
    common_name?: string;
    exp?: number;
    iat?: number;
    nbf?: number;
  }>(payloadSeg);

  if (!header || !payload || header.alg !== 'RS256' || !header.kid) {
    return { authenticated: false, provider: 'cloudflare-access', error: 'Unsupported Cloudflare Access JWT header.' };
  }

  const nowSec = Math.floor(Date.now() / 1000);
  if (!payload.exp || payload.exp <= nowSec) {
    return { authenticated: false, provider: 'cloudflare-access', error: 'Cloudflare Access JWT expired.' };
  }
  if (payload.iat && payload.iat > nowSec + 300) {
    return { authenticated: false, provider: 'cloudflare-access', error: 'Cloudflare Access JWT issued in the future.' };
  }
  if (payload.nbf && payload.nbf > nowSec + 300) {
    return { authenticated: false, provider: 'cloudflare-access', error: 'Cloudflare Access JWT not yet valid.' };
  }

  const normalizedIssuer = `https://${teamDomain.replace(/^https?:\/\//, '').replace(/\/+$/, '')}`;
  if (payload.iss !== normalizedIssuer) {
    return { authenticated: false, provider: 'cloudflare-access', error: 'Cloudflare Access issuer mismatch.' };
  }

  const audList = Array.isArray(payload.aud) ? payload.aud : payload.aud ? [payload.aud] : [];
  if (!audList.includes(expectedAud)) {
    return { authenticated: false, provider: 'cloudflare-access', error: 'Cloudflare Access audience mismatch.' };
  }

  try {
    let jwks = overrides?.cloudflareJwksByKid || (await fetchCloudflareAccessJwks(teamDomain));
    let jwk = jwks[header.kid];
    if (!jwk && !overrides?.cloudflareJwksByKid) {
      jwks = await fetchCloudflareAccessJwks(teamDomain, true);
      jwk = jwks[header.kid];
    }
    if (!jwk) {
      return { authenticated: false, provider: 'cloudflare-access', error: 'Unknown Cloudflare Access signing key.' };
    }

    const publicKey = crypto.createPublicKey({ key: jwk, format: 'jwk' });
    const sigBuf = Buffer.from(sigSeg.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
    const valid = crypto.verify('rsa-sha256', Buffer.from(`${headerSeg}.${payloadSeg}`), publicKey, sigBuf);
    if (!valid) {
      return { authenticated: false, provider: 'cloudflare-access', error: 'Invalid Cloudflare Access signature.' };
    }

    const principal = payload.sub || payload.email || payload.common_name || 'access-user';
    return {
      authenticated: true,
      provider: 'cloudflare-access',
      userId: `cf:${principal}`,
      email: typeof payload.email === 'string' ? payload.email : undefined,
    };
  } catch {
    return { authenticated: false, provider: 'cloudflare-access', error: 'Cloudflare Access verification failed.' };
  }
}

export function verifyCloudflareServiceTokenHeaders(
  req: Pick<Request, 'headers'>,
  overrides?: AuthResolverOverrides
): VerifiedIdentity | null {
  const rawClientId = req.headers['cf-access-client-id'];
  const rawClientSecret = req.headers['cf-access-client-secret'];
  const clientId = typeof rawClientId === 'string' ? rawClientId.trim() : '';
  const clientSecret = typeof rawClientSecret === 'string' ? rawClientSecret.trim() : '';

  if (!clientId && !clientSecret) {
    return null;
  }

  const expectedId = (
    overrides?.cloudflareServiceTokenId ||
    process.env.CLOUDFLARE_ACCESS_SERVICE_TOKEN_ID ||
    ''
  ).trim();
  const expectedSecret = (
    overrides?.cloudflareServiceTokenSecret ||
    process.env.CLOUDFLARE_ACCESS_SERVICE_TOKEN_SECRET ||
    ''
  ).trim();

  if (!expectedId || !expectedSecret) {
    return {
      authenticated: false,
      provider: 'cloudflare-service-token',
      error: 'Cloudflare Access service token validation is not configured on backend.',
    };
  }

  if (!clientId || !clientSecret || !timingSafeCompare(clientId, expectedId) || !timingSafeCompare(clientSecret, expectedSecret)) {
    return {
      authenticated: false,
      provider: 'cloudflare-service-token',
      error: 'Invalid Cloudflare Access service token credentials.',
    };
  }

  return {
    authenticated: true,
    provider: 'cloudflare-service-token',
    userId: `cf-service:${clientId.slice(0, 12)}`,
  };
}

export async function verifyCloudflareBackendRequest(
  req: Pick<Request, 'headers'>,
  overrides?: AuthResolverOverrides
): Promise<VerifiedIdentity | null> {
  const serviceTokenResult = verifyCloudflareServiceTokenHeaders(req, overrides);
  if (serviceTokenResult) {
    return serviceTokenResult;
  }

  const cfHeader = req.headers['cf-access-jwt-assertion'];
  const cookies = parseCookies(req.headers.cookie);
  const cfJwt = (typeof cfHeader === 'string' ? cfHeader : cookies.CF_Authorization || '').trim();
  if (cfJwt) {
    return verifyCloudflareAccessJwt(cfJwt, overrides);
  }

  return null;
}

export async function cloudflareBackendAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const cfAuth = await verifyCloudflareBackendRequest(req);
    if (cfAuth) {
      if (!cfAuth.authenticated) {
        res.status(401).json({ error: cfAuth.error || 'Invalid Cloudflare authentication credentials.' });
        return;
      }
      res.locals.cloudflareAuth = cfAuth;
      next();
      return;
    }

    if (process.env.CLOUDFLARE_ENFORCE_ALL_BACKEND_API === 'true' && isCloudflareAccessConfigured()) {
      res.status(401).json({ error: 'Cloudflare backend authentication required.' });
      return;
    }

    next();
  } catch {
    res.status(401).json({ error: 'Cloudflare backend authentication check failed.' });
  }
}

export async function verifyUnifiedWriteAuth(
  req: Request,
  overrides?: AuthResolverOverrides
): Promise<VerifiedIdentity> {
  // 1. Check Clerk session when configured
  if (isClerkEnabled()) {
    try {
      const auth = getAuth(req);
      if (auth.userId) {
        return {
          authenticated: true,
          provider: 'clerk',
          userId: auth.userId,
        };
      }
    } catch {
      // Ignore Clerk lookup error and inspect other credentials
    }
  }

  // 2. Check Cloudflare Access Service Token, assertion header, or CF_Authorization cookie
  const cfResult = await verifyCloudflareBackendRequest(req, overrides);
  if (cfResult) {
    return cfResult;
  }

  // 3. Check Firebase Auth Bearer / custom header token
  const firebaseHeader = req.headers['x-firebase-auth'];
  const authHeader = req.headers.authorization;
  const bearerMatch = typeof authHeader === 'string' ? authHeader.match(/^Bearer\s+(.+)$/i) : null;
  const candidateToken = (
    typeof firebaseHeader === 'string' ? firebaseHeader : bearerMatch ? bearerMatch[1] : ''
  ).trim();
  if (candidateToken) {
    const projectId = overrides?.firebaseProjectId || readBundledFirebaseProjectId();
    const parts = candidateToken.split('.');
    const unverifiedPayload = parts.length === 3 ? decodeBase64UrlJson<{ iss?: string }>(parts[1]) : null;
    const isFirebaseIssuer =
      Boolean(projectId) &&
      unverifiedPayload?.iss === `https://securetoken.google.com/${projectId}`;

    if (!isClerkEnabled() || typeof firebaseHeader === 'string' || isFirebaseIssuer) {
      return verifyFirebaseIdToken(candidateToken, overrides);
    }
    return {
      authenticated: false,
      provider: 'clerk',
      error: 'Invalid or expired Clerk authentication token.',
    };
  }

  // 4. Enforce fail-closed if any strict provider gate is active or in production deployment
  const hostedRuntime =
    process.env.RUNTIME_DEPLOYMENT === 'netlify' ||
    process.env.NETLIFY === 'true' ||
    process.env.CONTEXT === 'production' ||
    Boolean(process.env.DEPLOY_URL) ||
    process.env.VERCEL === '1' ||
    Boolean(process.env.DENO_DEPLOYMENT_ID) ||
    process.env.CF_PAGES === '1';
  const localPreviewWrites = process.env.NODE_ENV !== 'production' && !hostedRuntime;
  const mustRequireAuth =
    isClerkEnabled() ||
    isCloudflareAccessConfigured() ||
    process.env.FIREBASE_AUTH_REQUIRED === 'true' ||
    process.env.RUNTIME_DEPLOYMENT === 'netlify' ||
    !localPreviewWrites ||
    (process.env.NODE_ENV === 'production' && isFirebaseAuthConfigured());

  if (mustRequireAuth) {
    return {
      authenticated: false,
      provider: 'none',
      error: 'Authentication required to perform protected operations.',
    };
  }

  return {
    authenticated: true,
    provider: 'preview-editor',
    userId: 'Local Preview Editor',
  };
}
