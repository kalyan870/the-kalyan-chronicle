import crypto from 'crypto';
import { neon } from '@neondatabase/serverless';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { SavedEditionRecord } from '../data/chronicleData.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOCAL_ARCHIVE_DIR = path.resolve(__dirname, '../../.local-r2-archive');
const LOCAL_RELATIONAL_FILE = path.join(LOCAL_ARCHIVE_DIR, 'relational-store.json');

export interface MediaAssetRecord {
  id: string;
  fileName: string;
  contentType: string;
  byteSize: number;
  r2ObjectKey: string;
  uploadedBy: string;
  createdAt: string;
  storageBackend: 'cloudflare-r2' | 'local-archive';
}

export interface NewsletterLogRecord {
  id: string;
  recipientEmail: string;
  subject: string;
  resendMessageId: string;
  mode: string;
  triggeredBy: string;
  createdAt: string;
}

export interface AutomationRunRecord {
  id: string;
  triggerSource:
    | 'vercel-cron'
    | 'github-actions'
    | 'cloudflare-trigger'
    | 'manual-press-run'
    | 'backend-scheduler';
  status: 'completed' | 'partial' | 'failed';
  editionKey: string;
  commitCount: number;
  substackCount: number;
  newsletterSent: boolean;
  durationMs: number;
  summary: string;
  createdAt: string;
}

export interface SubscriberRecord {
  id: string;
  email: string;
  name: string;
  active: boolean;
  createdAt: string;
}

export interface RagCitation {
  id: string;
  title: string;
  section: string;
  url?: string;
}

export interface RagMemoryRecord {
  id: string;
  sessionId: string;
  userId: string;
  role: 'user' | 'assistant';
  content: string;
  citations: RagCitation[];
  createdAt: string;
}

export interface BackendUserAccountRecord {
  id: string;
  provider: string;
  externalUserId: string;
  email: string;
  lastSeenAt: string;
  createdAt: string;
}

export interface BackendStorageObjectRecord {
  objectKey: string;
  bucket: string;
  contentType: string;
  byteSize: number;
  payload: unknown;
  checksumSha256: string;
  ownerUserId: string;
  storageBackend: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthEventRecord {
  id: string;
  provider: string;
  userId: string;
  action: string;
  resourceKey: string;
  createdAt: string;
}

interface LocalRelationalStore {
  editions: SavedEditionRecord[];
  media: MediaAssetRecord[];
  newsletters: NewsletterLogRecord[];
  automationRuns?: AutomationRunRecord[];
  subscribers?: SubscriberRecord[];
  ragMemories?: RagMemoryRecord[];
  userAccounts?: BackendUserAccountRecord[];
  storageObjects?: BackendStorageObjectRecord[];
  authEvents?: AuthEventRecord[];
}

let migrationCompleted = false;
let migrationInFlight: Promise<void> | null = null;

export function isNeonConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.trim().length > 0);
}

function getSql() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not configured');
  }
  return neon(process.env.DATABASE_URL);
}

export async function ensureNeonMigrations(): Promise<void> {
  if (!isNeonConfigured() || migrationCompleted) {
    return;
  }
  if (migrationInFlight) {
    return migrationInFlight;
  }
  migrationInFlight = (async () => {
    const sql = getSql();
  await sql`
    CREATE TABLE IF NOT EXISTS chronicle_editions (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      author_user_id TEXT NOT NULL,
      r2_object_key TEXT NOT NULL,
      storage_backend TEXT NOT NULL DEFAULT 'neon-r2',
      repo_count INTEGER NOT NULL DEFAULT 0,
      commit_count INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS chronicle_media_assets (
      id TEXT PRIMARY KEY,
      edition_id TEXT REFERENCES chronicle_editions(id) ON DELETE SET NULL,
      file_name TEXT NOT NULL,
      content_type TEXT NOT NULL,
      byte_size INTEGER NOT NULL DEFAULT 0,
      r2_object_key TEXT NOT NULL,
      uploaded_by TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS chronicle_newsletter_logs (
      id TEXT PRIMARY KEY,
      recipient_email TEXT NOT NULL,
      subject TEXT NOT NULL,
      resend_message_id TEXT NOT NULL DEFAULT '',
      mode TEXT NOT NULL,
      triggered_by TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS chronicle_automation_runs (
      id TEXT PRIMARY KEY,
      trigger_source TEXT NOT NULL,
      status TEXT NOT NULL,
      edition_key TEXT NOT NULL DEFAULT '',
      commit_count INTEGER NOT NULL DEFAULT 0,
      substack_count INTEGER NOT NULL DEFAULT 0,
      newsletter_sent BOOLEAN NOT NULL DEFAULT FALSE,
      duration_ms INTEGER NOT NULL DEFAULT 0,
      summary TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS chronicle_subscribers (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL DEFAULT '',
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS chronicle_rag_memories (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      user_id TEXT NOT NULL DEFAULT 'anonymous',
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      citations JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS chronicle_user_accounts (
      id TEXT PRIMARY KEY,
      provider TEXT NOT NULL,
      external_user_id TEXT NOT NULL,
      email TEXT NOT NULL DEFAULT '',
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS chronicle_storage_objects (
      object_key TEXT PRIMARY KEY,
      bucket TEXT NOT NULL DEFAULT 'chronicle-backend',
      content_type TEXT NOT NULL DEFAULT 'application/json',
      byte_size INTEGER NOT NULL DEFAULT 0,
      payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      checksum_sha256 TEXT NOT NULL DEFAULT '',
      owner_user_id TEXT NOT NULL,
      storage_backend TEXT NOT NULL DEFAULT 'backend-sql',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS chronicle_auth_events (
      id TEXT PRIMARY KEY,
      provider TEXT NOT NULL,
      user_id TEXT NOT NULL,
      action TEXT NOT NULL,
      resource_key TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
    migrationCompleted = true;
  })().finally(() => {
    migrationInFlight = null;
  });
  return migrationInFlight;
}

function readLocalStore(): LocalRelationalStore {
  try {
    if (!fs.existsSync(LOCAL_RELATIONAL_FILE)) {
      return {
        editions: [],
        media: [],
        newsletters: [],
        automationRuns: [],
        subscribers: [],
        ragMemories: [],
        userAccounts: [],
        storageObjects: [],
        authEvents: [],
      };
    }
    const parsed = JSON.parse(fs.readFileSync(LOCAL_RELATIONAL_FILE, 'utf-8')) as LocalRelationalStore;
    return {
      editions: parsed.editions || [],
      media: parsed.media || [],
      newsletters: parsed.newsletters || [],
      automationRuns: parsed.automationRuns || [],
      subscribers: parsed.subscribers || [],
      ragMemories: parsed.ragMemories || [],
      userAccounts: parsed.userAccounts || [],
      storageObjects: parsed.storageObjects || [],
      authEvents: parsed.authEvents || [],
    };
  } catch {
    return {
      editions: [],
      media: [],
      newsletters: [],
      automationRuns: [],
      subscribers: [],
      ragMemories: [],
      userAccounts: [],
      storageObjects: [],
      authEvents: [],
    };
  }
}

function writeLocalStore(store: LocalRelationalStore): void {
  if (!fs.existsSync(LOCAL_ARCHIVE_DIR)) {
    fs.mkdirSync(LOCAL_ARCHIVE_DIR, { recursive: true });
  }
  const tmpFile = `${LOCAL_RELATIONAL_FILE}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(store, null, 2));
  fs.renameSync(tmpFile, LOCAL_RELATIONAL_FILE);
}

export async function saveEditionMetadata(record: SavedEditionRecord): Promise<void> {
  if (isNeonConfigured()) {
    await ensureNeonMigrations();
    const sql = getSql();
    const id = `ed_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    await sql`
      INSERT INTO chronicle_editions (
        id, title, notes, author_user_id, r2_object_key, storage_backend, repo_count, commit_count, created_at
      )
      VALUES (
        ${id},
        ${record.title},
        ${record.notes || ''},
        ${record.savedBy},
        ${record.key},
        ${record.storageBackend},
        ${record.repoCount},
        ${record.commitCount},
        ${record.savedAt}
      )
    `;
    return;
  }

  const store = readLocalStore();
  store.editions = [record, ...store.editions.filter((e) => e.key !== record.key)].slice(0, 25);
  writeLocalStore(store);
}

export async function listEditionMetadata(): Promise<SavedEditionRecord[]> {
  if (isNeonConfigured()) {
    await ensureNeonMigrations();
    const sql = getSql();
    const rows = (await sql`
      SELECT title, notes, author_user_id, r2_object_key, storage_backend, repo_count, commit_count, created_at
      FROM chronicle_editions
      ORDER BY created_at DESC
      LIMIT 20
    `) as Array<Record<string, unknown>>;

    return rows.map((row) => ({
      key: String(row.r2_object_key || ''),
      title: String(row.title || 'Chronicle Edition'),
      notes: String(row.notes || ''),
      savedBy: String(row.author_user_id || 'Clerk User'),
      storageBackend:
        row.storage_backend === 'cloudflare-r2' ? 'cloudflare-r2' : 'local-archive',
      repoCount: Number(row.repo_count ?? 54),
      commitCount: Number(row.commit_count ?? 4),
      savedAt: row.created_at ? new Date(String(row.created_at)).toISOString() : new Date().toISOString(),
    }));
  }

  return readLocalStore().editions;
}

export async function saveMediaAssetMetadata(asset: MediaAssetRecord): Promise<void> {
  if (isNeonConfigured()) {
    await ensureNeonMigrations();
    const sql = getSql();
    await sql`
      INSERT INTO chronicle_media_assets (
        id, file_name, content_type, byte_size, r2_object_key, uploaded_by, created_at
      )
      VALUES (
        ${asset.id},
        ${asset.fileName},
        ${asset.contentType},
        ${asset.byteSize},
        ${asset.r2ObjectKey},
        ${asset.uploadedBy},
        ${asset.createdAt}
      )
    `;
    return;
  }

  const store = readLocalStore();
  store.media = [asset, ...store.media.filter((m) => m.id !== asset.id)].slice(0, 25);
  writeLocalStore(store);
}

export async function listMediaAssetMetadata(): Promise<MediaAssetRecord[]> {
  if (isNeonConfigured()) {
    await ensureNeonMigrations();
    const sql = getSql();
    const rows = (await sql`
      SELECT id, file_name, content_type, byte_size, r2_object_key, uploaded_by, created_at
      FROM chronicle_media_assets
      ORDER BY created_at DESC
      LIMIT 20
    `) as Array<Record<string, unknown>>;

    return rows.map((row) => ({
      id: String(row.id || ''),
      fileName: String(row.file_name || 'attachment'),
      contentType: String(row.content_type || 'application/octet-stream'),
      byteSize: Number(row.byte_size ?? 0),
      r2ObjectKey: String(row.r2_object_key || ''),
      uploadedBy: String(row.uploaded_by || 'Clerk User'),
      createdAt: row.created_at ? new Date(String(row.created_at)).toISOString() : new Date().toISOString(),
      storageBackend: 'cloudflare-r2',
    }));
  }

  return readLocalStore().media;
}

export async function saveNewsletterLog(entry: NewsletterLogRecord): Promise<void> {
  if (isNeonConfigured()) {
    await ensureNeonMigrations();
    const sql = getSql();
    await sql`
      INSERT INTO chronicle_newsletter_logs (
        id, recipient_email, subject, resend_message_id, mode, triggered_by, created_at
      )
      VALUES (
        ${entry.id},
        ${entry.recipientEmail},
        ${entry.subject},
        ${entry.resendMessageId},
        ${entry.mode},
        ${entry.triggeredBy},
        ${entry.createdAt}
      )
    `;
    return;
  }

  const store = readLocalStore();
  store.newsletters = [entry, ...store.newsletters].slice(0, 20);
  writeLocalStore(store);
}

export async function listNewsletterLogs(): Promise<NewsletterLogRecord[]> {
  if (isNeonConfigured()) {
    await ensureNeonMigrations();
    const sql = getSql();
    const rows = (await sql`
      SELECT id, recipient_email, subject, resend_message_id, mode, triggered_by, created_at
      FROM chronicle_newsletter_logs
      ORDER BY created_at DESC
      LIMIT 10
    `) as Array<Record<string, unknown>>;

    return rows.map((row) => ({
      id: String(row.id || ''),
      recipientEmail: String(row.recipient_email || ''),
      subject: String(row.subject || ''),
      resendMessageId: String(row.resend_message_id || ''),
      mode: String(row.mode || 'preview'),
      triggeredBy: String(row.triggered_by || ''),
      createdAt: row.created_at ? new Date(String(row.created_at)).toISOString() : new Date().toISOString(),
    }));
  }

  return readLocalStore().newsletters;
}

export async function saveAutomationRun(run: AutomationRunRecord): Promise<void> {
  if (isNeonConfigured()) {
    await ensureNeonMigrations();
    const sql = getSql();
    await sql`
      INSERT INTO chronicle_automation_runs (
        id, trigger_source, status, edition_key, commit_count, substack_count, newsletter_sent, duration_ms, summary, created_at
      )
      VALUES (
        ${run.id},
        ${run.triggerSource},
        ${run.status},
        ${run.editionKey},
        ${run.commitCount},
        ${run.substackCount},
        ${run.newsletterSent},
        ${run.durationMs},
        ${run.summary},
        ${run.createdAt}
      )
    `;
    return;
  }

  const store = readLocalStore();
  store.automationRuns = [run, ...(store.automationRuns || [])].slice(0, 20);
  writeLocalStore(store);
}

export async function listAutomationRuns(): Promise<AutomationRunRecord[]> {
  if (isNeonConfigured()) {
    await ensureNeonMigrations();
    const sql = getSql();
    const rows = (await sql`
      SELECT id, trigger_source, status, edition_key, commit_count, substack_count, newsletter_sent, duration_ms, summary, created_at
      FROM chronicle_automation_runs
      ORDER BY created_at DESC
      LIMIT 12
    `) as Array<Record<string, unknown>>;

    return rows.map((row) => ({
      id: String(row.id || ''),
      triggerSource:
        row.trigger_source === 'vercel-cron' ||
        row.trigger_source === 'github-actions' ||
        row.trigger_source === 'cloudflare-trigger' ||
        row.trigger_source === 'backend-scheduler'
          ? row.trigger_source
          : 'manual-press-run',
      status:
        row.status === 'failed' ? 'failed' : row.status === 'partial' ? 'partial' : 'completed',
      editionKey: String(row.edition_key || ''),
      commitCount: Number(row.commit_count ?? 0),
      substackCount: Number(row.substack_count ?? 0),
      newsletterSent: Boolean(row.newsletter_sent),
      durationMs: Number(row.duration_ms ?? 0),
      summary: String(row.summary || ''),
      createdAt: row.created_at ? new Date(String(row.created_at)).toISOString() : new Date().toISOString(),
    }));
  }

  return readLocalStore().automationRuns || [];
}

export async function saveSubscriber(input: {
  email: string;
  name?: string;
}): Promise<SubscriberRecord> {
  const normalizedEmail = input.email.trim().toLowerCase();
  const cleanName = (input.name || '').trim();
  const record: SubscriberRecord = {
    id: `sub_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    email: normalizedEmail,
    name: cleanName,
    active: true,
    createdAt: new Date().toISOString(),
  };

  if (isNeonConfigured()) {
    await ensureNeonMigrations();
    const sql = getSql();
    await sql`
      INSERT INTO chronicle_subscribers (id, email, name, active, created_at)
      VALUES (${record.id}, ${record.email}, ${record.name}, TRUE, ${record.createdAt})
      ON CONFLICT (email) DO UPDATE SET
        name = CASE WHEN EXCLUDED.name <> '' THEN EXCLUDED.name ELSE chronicle_subscribers.name END,
        active = TRUE
    `;
    return record;
  }

  const store = readLocalStore();
  const existing = (store.subscribers || []).filter((s) => s.email !== normalizedEmail);
  store.subscribers = [record, ...existing].slice(0, 500);
  writeLocalStore(store);
  return record;
}

export async function unsubscribeSubscriber(email: string): Promise<boolean> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) return false;

  if (isNeonConfigured()) {
    await ensureNeonMigrations();
    const sql = getSql();
    await sql`
      UPDATE chronicle_subscribers
      SET active = FALSE
      WHERE email = ${normalizedEmail}
    `;
    return true;
  }

  const store = readLocalStore();
  let updated = false;
  store.subscribers = (store.subscribers || []).map((sub) => {
    if (sub.email === normalizedEmail) {
      updated = true;
      return { ...sub, active: false };
    }
    return sub;
  });
  if (updated) {
    writeLocalStore(store);
  }
  return updated;
}

export async function listActiveSubscribers(): Promise<SubscriberRecord[]> {
  if (isNeonConfigured()) {
    await ensureNeonMigrations();
    const sql = getSql();
    const rows = (await sql`
      SELECT id, email, name, active, created_at
      FROM chronicle_subscribers
      WHERE active = TRUE
      ORDER BY created_at DESC
      LIMIT 250
    `) as Array<Record<string, unknown>>;

    return rows.map((row) => ({
      id: String(row.id || ''),
      email: String(row.email || ''),
      name: String(row.name || ''),
      active: Boolean(row.active ?? true),
      createdAt: row.created_at ? new Date(String(row.created_at)).toISOString() : new Date().toISOString(),
    }));
  }

  return (readLocalStore().subscribers || []).filter((s) => s.active);
}

export async function saveRagMemory(entry: {
  sessionId: string;
  userId?: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: RagCitation[];
  createdAt?: string;
}): Promise<RagMemoryRecord> {
  const record: RagMemoryRecord = {
    id: `mem_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    sessionId: entry.sessionId,
    userId: entry.userId || 'anonymous',
    role: entry.role,
    content: entry.content,
    citations: entry.citations || [],
    createdAt: entry.createdAt || new Date().toISOString(),
  };

  if (isNeonConfigured()) {
    await ensureNeonMigrations();
    const sql = getSql();
    await sql`
      INSERT INTO chronicle_rag_memories (
        id, session_id, user_id, role, content, citations, created_at
      )
      VALUES (
        ${record.id},
        ${record.sessionId},
        ${record.userId},
        ${record.role},
        ${record.content},
        ${JSON.stringify(record.citations)}::jsonb,
        ${record.createdAt}
      )
    `;
    return record;
  }

  const store = readLocalStore();
  store.ragMemories = [...(store.ragMemories || []), record].slice(-300);
  writeLocalStore(store);
  return record;
}

export async function listRagMemories(sessionId: string, limit = 12): Promise<RagMemoryRecord[]> {
  if (isNeonConfigured()) {
    await ensureNeonMigrations();
    const sql = getSql();
    const rows = (await sql`
      SELECT id, session_id, user_id, role, content, citations, created_at
      FROM chronicle_rag_memories
      WHERE session_id = ${sessionId}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `) as Array<Record<string, unknown>>;

    return rows
      .map((row) => ({
        id: String(row.id || ''),
        sessionId: String(row.session_id || sessionId),
        userId: String(row.user_id || 'anonymous'),
        role: row.role === 'assistant' ? ('assistant' as const) : ('user' as const),
        content: String(row.content || ''),
        citations: Array.isArray(row.citations) ? (row.citations as RagCitation[]) : [],
        createdAt: row.created_at ? new Date(String(row.created_at)).toISOString() : new Date().toISOString(),
      }))
      .reverse();
  }

  const all = (readLocalStore().ragMemories || []).filter((m) => m.sessionId === sessionId);
  return all.slice(-limit);
}

export async function clearRagMemories(sessionId: string): Promise<void> {
  if (isNeonConfigured()) {
    await ensureNeonMigrations();
    const sql = getSql();
    await sql`DELETE FROM chronicle_rag_memories WHERE session_id = ${sessionId}`;
    return;
  }

  const store = readLocalStore();
  store.ragMemories = (store.ragMemories || []).filter((m) => m.sessionId !== sessionId);
  writeLocalStore(store);
}

export async function getRagSessionOwner(sessionId: string): Promise<string | null> {
  if (isNeonConfigured()) {
    await ensureNeonMigrations();
    const sql = getSql();
    const rows = (await sql`
      SELECT user_id
      FROM chronicle_rag_memories
      WHERE session_id = ${sessionId}
      ORDER BY created_at DESC
      LIMIT 25
    `) as Array<Record<string, unknown>>;
    if (rows.length === 0) return null;
    const namedOwner = rows.find(
      (r) => typeof r.user_id === 'string' && r.user_id.trim() !== '' && r.user_id !== 'anonymous'
    );
    return namedOwner ? String(namedOwner.user_id) : 'anonymous';
  }

  const matching = (readLocalStore().ragMemories || []).filter((m) => m.sessionId === sessionId);
  if (matching.length === 0) return null;
  const namedOwner = matching.find((m) => m.userId && m.userId !== 'anonymous');
  return namedOwner ? namedOwner.userId : 'anonymous';
}

export async function upsertUserAccount(input: {
  provider: string;
  externalUserId: string;
  email?: string;
}): Promise<BackendUserAccountRecord> {
  const now = new Date().toISOString();
  const id = `${input.provider}:${input.externalUserId}`;
  const cleanEmail = (input.email || '').trim().toLowerCase();
  const record: BackendUserAccountRecord = {
    id,
    provider: input.provider,
    externalUserId: input.externalUserId,
    email: cleanEmail,
    lastSeenAt: now,
    createdAt: now,
  };

  if (isNeonConfigured()) {
    await ensureNeonMigrations();
    const sql = getSql();
    await sql`
      INSERT INTO chronicle_user_accounts (
        id, provider, external_user_id, email, last_seen_at, created_at
      )
      VALUES (
        ${record.id},
        ${record.provider},
        ${record.externalUserId},
        ${record.email},
        ${record.lastSeenAt},
        ${record.createdAt}
      )
      ON CONFLICT (id) DO UPDATE SET
        email = CASE WHEN EXCLUDED.email <> '' THEN EXCLUDED.email ELSE chronicle_user_accounts.email END,
        last_seen_at = EXCLUDED.last_seen_at
    `;
    return record;
  }

  const store = readLocalStore();
  const existing = (store.userAccounts || []).find((a) => a.id === id);
  const merged: BackendUserAccountRecord = existing
    ? {
        ...existing,
        email: cleanEmail || existing.email,
        lastSeenAt: now,
      }
    : record;
  store.userAccounts = [merged, ...(store.userAccounts || []).filter((a) => a.id !== id)].slice(0, 200);
  writeLocalStore(store);
  return merged;
}

export async function saveStorageObject(input: {
  objectKey: string;
  bucket?: string;
  contentType?: string;
  payload: unknown;
  ownerUserId: string;
  storageBackend?: string;
}): Promise<BackendStorageObjectRecord> {
  const now = new Date().toISOString();
  const serialized = JSON.stringify(input.payload ?? {});
  const byteSize = Buffer.byteLength(serialized, 'utf-8');
  const checksumSha256 = crypto.createHash('sha256').update(serialized).digest('hex');

  const record: BackendStorageObjectRecord = {
    objectKey: input.objectKey,
    bucket: input.bucket || 'chronicle-backend',
    contentType: input.contentType || 'application/json',
    byteSize,
    payload: input.payload ?? {},
    checksumSha256,
    ownerUserId: input.ownerUserId,
    storageBackend: input.storageBackend || 'backend-sql',
    createdAt: now,
    updatedAt: now,
  };

  if (isNeonConfigured()) {
    await ensureNeonMigrations();
    const sql = getSql();
    await sql`
      INSERT INTO chronicle_storage_objects (
        object_key, bucket, content_type, byte_size, payload_json, checksum_sha256, owner_user_id, storage_backend, created_at, updated_at
      )
      VALUES (
        ${record.objectKey},
        ${record.bucket},
        ${record.contentType},
        ${record.byteSize},
        ${serialized}::jsonb,
        ${record.checksumSha256},
        ${record.ownerUserId},
        ${record.storageBackend},
        ${record.createdAt},
        ${record.updatedAt}
      )
      ON CONFLICT (object_key) DO UPDATE SET
        content_type = EXCLUDED.content_type,
        byte_size = EXCLUDED.byte_size,
        payload_json = EXCLUDED.payload_json,
        checksum_sha256 = EXCLUDED.checksum_sha256,
        owner_user_id = EXCLUDED.owner_user_id,
        storage_backend = EXCLUDED.storage_backend,
        updated_at = EXCLUDED.updated_at
    `;
    return record;
  }

  const store = readLocalStore();
  const existing = (store.storageObjects || []).find((o) => o.objectKey === record.objectKey);
  const nextRecord: BackendStorageObjectRecord = existing
    ? { ...record, createdAt: existing.createdAt }
    : record;
  store.storageObjects = [
    nextRecord,
    ...(store.storageObjects || []).filter((o) => o.objectKey !== record.objectKey),
  ].slice(0, 100);
  writeLocalStore(store);
  return nextRecord;
}

export async function getStorageObject(objectKey: string): Promise<BackendStorageObjectRecord | null> {
  if (isNeonConfigured()) {
    await ensureNeonMigrations();
    const sql = getSql();
    const rows = (await sql`
      SELECT object_key, bucket, content_type, byte_size, payload_json, checksum_sha256, owner_user_id, storage_backend, created_at, updated_at
      FROM chronicle_storage_objects
      WHERE object_key = ${objectKey}
      LIMIT 1
    `) as Array<Record<string, unknown>>;
    if (!rows[0]) return null;
    const row = rows[0];
    return {
      objectKey: String(row.object_key || objectKey),
      bucket: String(row.bucket || 'chronicle-backend'),
      contentType: String(row.content_type || 'application/json'),
      byteSize: Number(row.byte_size ?? 0),
      payload: row.payload_json ?? {},
      checksumSha256: String(row.checksum_sha256 || ''),
      ownerUserId: String(row.owner_user_id || ''),
      storageBackend: String(row.storage_backend || 'backend-sql'),
      createdAt: row.created_at ? new Date(String(row.created_at)).toISOString() : new Date().toISOString(),
      updatedAt: row.updated_at ? new Date(String(row.updated_at)).toISOString() : new Date().toISOString(),
    };
  }

  return (readLocalStore().storageObjects || []).find((o) => o.objectKey === objectKey) || null;
}

export async function listStorageObjects(
  prefix = '',
  limit = 25
): Promise<Array<Omit<BackendStorageObjectRecord, 'payload'>>> {
  if (isNeonConfigured()) {
    await ensureNeonMigrations();
    const sql = getSql();
    const rows = (await (prefix
      ? sql`
          SELECT object_key, bucket, content_type, byte_size, checksum_sha256, owner_user_id, storage_backend, created_at, updated_at
          FROM chronicle_storage_objects
          WHERE LEFT(object_key, LENGTH(${prefix})) = ${prefix}
          ORDER BY updated_at DESC
          LIMIT ${limit}
        `
      : sql`
          SELECT object_key, bucket, content_type, byte_size, checksum_sha256, owner_user_id, storage_backend, created_at, updated_at
          FROM chronicle_storage_objects
          ORDER BY updated_at DESC
          LIMIT ${limit}
        `)) as Array<Record<string, unknown>>;

    return rows.map((row) => ({
      objectKey: String(row.object_key || ''),
      bucket: String(row.bucket || 'chronicle-backend'),
      contentType: String(row.content_type || 'application/json'),
      byteSize: Number(row.byte_size ?? 0),
      checksumSha256: String(row.checksum_sha256 || ''),
      ownerUserId: String(row.owner_user_id || ''),
      storageBackend: String(row.storage_backend || 'backend-sql'),
      createdAt: row.created_at ? new Date(String(row.created_at)).toISOString() : new Date().toISOString(),
      updatedAt: row.updated_at ? new Date(String(row.updated_at)).toISOString() : new Date().toISOString(),
    }));
  }

  return (readLocalStore().storageObjects || [])
    .filter((o) => (!prefix ? true : o.objectKey.startsWith(prefix)))
    .slice(0, limit)
    .map(({ payload: _omit, ...meta }) => meta);
}

export async function recordAuthEvent(input: {
  provider: string;
  userId: string;
  action: string;
  resourceKey?: string;
}): Promise<void> {
  const record: AuthEventRecord = {
    id: `auth_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    provider: input.provider,
    userId: input.userId,
    action: input.action,
    resourceKey: input.resourceKey || '',
    createdAt: new Date().toISOString(),
  };

  if (isNeonConfigured()) {
    await ensureNeonMigrations();
    const sql = getSql();
    await sql`
      INSERT INTO chronicle_auth_events (id, provider, user_id, action, resource_key, created_at)
      VALUES (${record.id}, ${record.provider}, ${record.userId}, ${record.action}, ${record.resourceKey}, ${record.createdAt})
    `;
    return;
  }

  const store = readLocalStore();
  store.authEvents = [record, ...(store.authEvents || [])].slice(0, 100);
  writeLocalStore(store);
}

