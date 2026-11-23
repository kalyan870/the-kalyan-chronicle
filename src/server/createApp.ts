import express from 'express';
import type { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { clerkMiddleware } from '@clerk/express';
import { Resend } from 'resend';
import {
  FALLBACK_COMMITS,
  FALLBACK_SUBSTACK_POSTS,
  FEATURED_PROJECTS,
  type CommitEntry,
  type PackageAuditReport,
  type PackageFinding,
  type ProjectDispatch,
  type SavedEditionRecord,
  type SubstackPost,
} from '../data/chronicleData.ts';
import {
  buildBroadsheetNewsletterHtml,
  buildBroadsheetNewsletterText,
} from './newsletterTemplate.ts';
import {
  clearRagMemories,
  getRagSessionOwner,
  getStorageObject,
  isNeonConfigured,
  listActiveSubscribers,
  listAutomationRuns,
  listEditionMetadata,
  listMediaAssetMetadata,
  listNewsletterLogs,
  listRagMemories,
  listStorageObjects,
  recordAuthEvent,
  saveAutomationRun,
  saveEditionMetadata,
  saveMediaAssetMetadata,
  saveNewsletterLog,
  saveStorageObject,
  saveSubscriber,
  unsubscribeSubscriber,
  upsertUserAccount,
  type AutomationRunRecord,
  type MediaAssetRecord,
} from './neonDb.ts';
import {
  aiInferenceLimiter,
  analyzePackageSchema,
  apiGeneralLimiter,
  apiMutationLimiter,
  automationTriggerSchema,
  createSecurityHeadersMiddleware,
  createUnsubscribeToken,
  enforceSameOriginMutations,
  evalMatrixSchema,
  isSafeObjectKey,
  newsletterDispatchSchema,
  presignUploadSchema,
  registerMediaSchema,
  resolveSafeBaseUrl,
  saveEditionSchema,
  storageObjectSchema,
  subscribeDigestSchema,
  subscribeStrictLimiter,
  traceAuditSchema,
  verifyCronBearerToken,
  verifyUnsubscribeToken,
} from './security.ts';
import { toSafeExternalHref } from '../utils/safeUrl.ts';
import {
  cloudflareBackendAuthMiddleware,
  isCloudflareAccessConfigured,
  isCloudflareServiceTokenConfigured,
  isFirebaseAuthConfigured,
  verifyUnifiedWriteAuth,
} from './authGate.ts';
import { sanitizeAiOutput, validateRagInput } from './aiGuardrails.ts';
import { queryChronicleRagWithMemory, streamChronicleRagWithMemory } from './ragMemory.ts';
import {
  buildBroadsheetOgSvg,
  buildJsonFeed,
  buildLlmsTxt,
  buildOpenApiSpec,
  buildRobotsTxt,
  buildRssFeed,
  buildSitemapXml,
} from './discovery.ts';
import { buildAgentCard, handleA2aRpcRequest } from './a2aGateway.ts';
import { getMcpServerDescriptor, handleMcpJsonRpc } from './mcpServer.ts';
import { auditAgentTrace, runRagEvalMatrix } from './workbenchEngines.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOCAL_ARCHIVE_DIR = path.resolve(__dirname, '../../.local-r2-archive');

export interface RepoSummary {
  name: string;
  description: string;
  language: string;
  stars: number;
  updatedAt: string;
  url: string;
}

export interface DigestPayload {
  fetchedAt: string;
  githubSource: 'live' | 'fallback';
  substackSource: 'live' | 'fallback';
  profile: {
    login: string;
    name: string;
    bio: string;
    publicRepos: number;
    followers: number;
    avatarUrl: string;
    htmlUrl: string;
  };
  repos: RepoSummary[];
  latestProjects: ProjectDispatch[];
  commits: CommitEntry[];
  substackPosts: SubstackPost[];
}

let cachedDigest: { data: DigestPayload; expiresAt: number } | null = null;
const CACHE_TTL_MS = 10 * 60 * 1000;

function isClerkConfigured(): boolean {
  return Boolean(process.env.CLERK_SECRET_KEY && process.env.VITE_CLERK_PUBLISHABLE_KEY);
}

function getR2BucketName(): string {
  return process.env.R2_BUCKET_NAME || 'kalyan-chronicle-editions';
}

function getR2Endpoint(): string {
  if (process.env.R2_ENDPOINT) {
    return process.env.R2_ENDPOINT.replace(/\/+$/, '');
  }
  const rawAccount = (process.env.R2_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID || '').trim();
  const cleanAccount = rawAccount
    .replace(/^https?:\/\//, '')
    .replace(/\.r2\.cloudflarestorage\.com.*$/, '');
  return cleanAccount ? `https://${cleanAccount}.r2.cloudflarestorage.com` : '';
}

function isR2Configured(): boolean {
  return Boolean(
    getR2Endpoint() &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY
  );
}

function isResendConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

function escapeHtmlText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildUnsubscribeUrl(email: string, req?: Request): string {
  const base = resolveSafeBaseUrl(req);
  const token = createUnsubscribeToken(email);
  return `${base}/api/newsletter/unsubscribe?token=${encodeURIComponent(token)}`;
}

function buildNewsletterUnsubscribeHeaders(unsubscribeUrl: string): Record<string, string> {
  return {
    'List-Unsubscribe': `<${unsubscribeUrl}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  };
}

function createR2Client(): S3Client {
  return new S3Client({
    region: 'auto',
    endpoint: getR2Endpoint(),
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
    },
  });
}

function decodeXmlEntities(input: string): string {
  return input
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function stripHtml(input: string): string {
  return decodeXmlEntities(input)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractTag(block: string, tagName: string): string {
  const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i');
  const match = block.match(regex);
  return match ? match[1].trim() : '';
}

function formatShortDate(isoOrRfc: string): string {
  const parsed = new Date(isoOrRfc);
  if (Number.isNaN(parsed.getTime())) {
    return isoOrRfc;
  }
  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

async function fetchWithTimeout(url: string, headers: Record<string, string>, timeoutMs = 5000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { headers, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function buildLiveDigest(): Promise<DigestPayload> {
  const ghHeaders: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'The-Kalyan-Chronicle-Digest',
  };
  if (process.env.GITHUB_TOKEN) {
    ghHeaders.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  let githubSource: 'live' | 'fallback' = 'fallback';
  let substackSource: 'live' | 'fallback' = 'fallback';

  let profile = {
    login: 'kalyan870',
    name: 'Saragadam Kalyan',
    bio: 'AI Engineer building practical GenAI, LLM, agentic AI, and full-stack applications.',
    publicRepos: 54,
    followers: 0,
    avatarUrl: '',
    htmlUrl: 'https://github.com/kalyan870',
  };

  let repos: RepoSummary[] = [
    {
      name: 'InterviewIQ-AI',
      description: 'Full-stack AI interview preparation platform with voice interviews, resume intelligence, and rubric scoring.',
      language: 'TypeScript',
      stars: 0,
      updatedAt: 'Active',
      url: 'https://github.com/kalyan870',
    },
    {
      name: 'Enterprise-RAG-System',
      description: 'Production-oriented document Q&A engine featuring hybrid search, reranking, and evaluation.',
      language: 'Python',
      stars: 0,
      updatedAt: 'Active',
      url: 'https://github.com/kalyan870',
    },
    {
      name: 'Environmental-Risk-Safety-Dashboard',
      description: 'Real-time environmental telemetry cockpit displaying AQI, geospatial risk pins, and 7-day trend curves.',
      language: 'TypeScript',
      stars: 0,
      updatedAt: 'Active',
      url: 'https://github.com/kalyan870',
    },
    {
      name: 'Face-Emotion-Dashboard',
      description: 'Real-time facial emotion recognition and telemetry dashboard using MediaPipe, Python, and TypeScript.',
      language: 'TypeScript',
      stars: 0,
      updatedAt: 'Active',
      url: 'https://github.com/kalyan870',
    },
  ];

  let latestProjects: ProjectDispatch[] = [...FEATURED_PROJECTS];
  let commits: CommitEntry[] = [...FALLBACK_COMMITS];
  let substackPosts: SubstackPost[] = [...FALLBACK_SUBSTACK_POSTS];

  try {
    const [userRes, reposRes, eventsRes] = await Promise.all([
      fetchWithTimeout('https://api.github.com/users/kalyan870', ghHeaders),
      fetchWithTimeout('https://api.github.com/users/kalyan870/repos?sort=pushed&per_page=15', ghHeaders),
      fetchWithTimeout('https://api.github.com/users/kalyan870/events/public?per_page=20', ghHeaders),
    ]);

    if (userRes.ok) {
      const userJson = (await userRes.json()) as Record<string, unknown>;
      profile = {
        login: String(userJson.login || 'kalyan870'),
        name: String(userJson.name || 'Saragadam Kalyan'),
        bio: String(userJson.bio || profile.bio),
        publicRepos: Number(userJson.public_repos ?? profile.publicRepos),
        followers: Number(userJson.followers ?? 0),
        avatarUrl: String(userJson.avatar_url || ''),
        htmlUrl: String(userJson.html_url || 'https://github.com/kalyan870'),
      };
      githubSource = 'live';
    }

    if (reposRes.ok) {
      const reposJson = (await reposRes.json()) as Array<Record<string, unknown>>;
      if (Array.isArray(reposJson) && reposJson.length > 0) {
        const originalRepos = reposJson.filter((repo) => !repo.fork);
        const pool = originalRepos.length > 0 ? originalRepos : reposJson;
        repos = pool.slice(0, 6).map((repo) => ({
          name: String(repo.name || 'repository'),
          description: String(repo.description || 'Engineering repository on github.com/kalyan870.'),
          language: String(repo.language || 'TypeScript'),
          stars: Number(repo.stargazers_count ?? 0),
          updatedAt: formatShortDate(String(repo.pushed_at || repo.updated_at || '')),
          url: toSafeExternalHref(repo.html_url, 'https://github.com/kalyan870'),
        }));

        const featuredUrls = new Set(
          FEATURED_PROJECTS.map((p) => p.repoUrl.toLowerCase().replace(/\/+$/, ''))
        );
        const featuredSlugs = new Set(
          FEATURED_PROJECTS.map((p) =>
            p.repoUrl.toLowerCase().replace(/\/+$/, '').split('/').pop() || ''
          )
        );

        const newlyPushedProjects: ProjectDispatch[] = pool
          .filter((repo) => {
            const url = String(repo.html_url || '').toLowerCase().replace(/\/+$/, '');
            const name = String(repo.name || '').toLowerCase();
            return (
              Boolean(url) &&
              !featuredUrls.has(url) &&
              !featuredSlugs.has(name) &&
              name !== 'kalyan870'
            );
          })
          .slice(0, 3)
          .map((repo) => {
            const rawName = String(repo.name || 'Repository');
            const prettyTitle = rawName.replace(/[-_]+/g, ' ');
            const topics = Array.isArray(repo.topics)
              ? (repo.topics as unknown[]).map((t) => String(t)).slice(0, 4)
              : [];
            const lang = String(repo.language || 'TypeScript');
            const updatedLabel = formatShortDate(String(repo.pushed_at || repo.updated_at || ''));
            const safeHomepage =
              typeof repo.homepage === 'string' && /^https?:\/\//i.test(repo.homepage.trim())
                ? toSafeExternalHref(repo.homepage, '')
                : '';
            const homepage = safeHomepage || undefined;

            return {
              id: `gh-${rawName.toLowerCase()}`,
              title: prettyTitle,
              kicker: `Latest GitHub Release · ${updatedLabel || 'Active'}`,
              highlighted: false,
              summary: String(
                repo.description ||
                  `Recently updated ${lang} engineering project maintained in github.com/kalyan870.`
              ),
              architectureNote: homepage
                ? 'Synced automatically from GitHub with live deployment link.'
                : 'Synced automatically from latest GitHub repository activity.',
              stack: Array.from(new Set([lang, ...topics, 'GitHub Sync'])).slice(0, 5),
              repoUrl: toSafeExternalHref(repo.html_url, 'https://github.com/kalyan870'),
              liveUrl: homepage,
            };
          });

        latestProjects = [...FEATURED_PROJECTS, ...newlyPushedProjects].slice(0, 9);
        githubSource = 'live';
      }
    }

    if (eventsRes.ok) {
      const eventsJson = (await eventsRes.json()) as Array<Record<string, unknown>>;
      const extracted: CommitEntry[] = [];
      for (const evt of eventsJson) {
        if (evt.type === 'PushEvent') {
          const repoObj = (evt.repo || {}) as Record<string, unknown>;
          const repoName = String(repoObj.name || 'kalyan870/repo');
          const payload = (evt.payload || {}) as Record<string, unknown>;
          const commitList = Array.isArray(payload.commits)
            ? (payload.commits as Array<Record<string, unknown>>)
            : [];
          for (const c of commitList) {
            const sha = String(c.sha || '').slice(0, 7);
            const msg = String(c.message || '').split('\n')[0].trim();
            if (sha && msg) {
              extracted.push({
                sha,
                repo: repoName,
                message: msg,
                date: formatShortDate(String(evt.created_at || '')),
                url: toSafeExternalHref(
                  `https://github.com/${repoName}/commit/${String(c.sha || '')}`,
                  'https://github.com/kalyan870'
                ),
              });
            }
          }
        }
        if (extracted.length >= 6) break;
      }
      if (extracted.length > 0) {
        commits = extracted;
        githubSource = 'live';
      }
    }
  } catch {
    // Graceful fallback already populated
  }

  try {
    const rssRes = await fetchWithTimeout('https://saragadamkalyan.substack.com/feed', {
      'User-Agent': 'The-Kalyan-Chronicle-Digest',
      Accept: 'application/rss+xml, application/xml, text/xml',
    });
    if (rssRes.ok) {
      const xml = await rssRes.text();
      const itemMatches = xml.match(/<item>[\s\S]*?<\/item>/gi) || [];
      const parsedPosts: SubstackPost[] = itemMatches.slice(0, 4).map((itemXml) => {
        const title = stripHtml(extractTag(itemXml, 'title')) || 'Substack Dispatch';
        const link = toSafeExternalHref(
          decodeXmlEntities(extractTag(itemXml, 'link')),
          'https://saragadamkalyan.substack.com/'
        );
        const pubDate = formatShortDate(extractTag(itemXml, 'pubDate'));
        const rawDesc = extractTag(itemXml, 'description') || extractTag(itemXml, 'content:encoded');
        const cleanExcerpt = stripHtml(rawDesc).slice(0, 210);
        return {
          title,
          link,
          publishedAt: pubDate || 'Substack Dispatch',
          excerpt: cleanExcerpt ? `${cleanExcerpt}${cleanExcerpt.length >= 210 ? '…' : ''}` : 'Read the full technical note on Substack.',
          source: 'live',
        };
      });

      if (parsedPosts.length > 0) {
        substackPosts = parsedPosts;
        substackSource = 'live';
      }
    }
  } catch {
    // Graceful fallback already populated
  }

  return {
    fetchedAt: new Date().toISOString(),
    githubSource,
    substackSource,
    profile,
    repos,
    latestProjects,
    commits,
    substackPosts,
  };
}

export function analyzePackageManifest(rawJson: string): PackageAuditReport {
  const rawParsed: unknown = JSON.parse(rawJson);
  if (!rawParsed || typeof rawParsed !== 'object' || Array.isArray(rawParsed)) {
    throw new Error('package.json must be a valid JSON object.');
  }
  const parsed = rawParsed as {
    name?: string;
    scripts?: Record<string, string>;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };

  const deps = parsed.dependencies || {};
  const devDeps = parsed.devDependencies || {};
  const scripts = parsed.scripts || {};
  const allDeps: Record<string, string> = { ...deps, ...devDeps };
  const findings: PackageFinding[] = [];

  if (deps['@types/prismjs'] || deps['vite'] || deps['@vitejs/plugin-react'] || deps['@tailwindcss/vite']) {
    const misplaced = ['@types/prismjs', 'vite', '@vitejs/plugin-react', '@tailwindcss/vite'].filter(
      (pkg) => Boolean(deps[pkg])
    );
    findings.push({
      id: 'misplaced-build-deps',
      packageName: misplaced.join(', '),
      currentVersion: misplaced.map((p) => deps[p]).join(' / '),
      category: 'DX & Performance',
      severity: 'Moderate',
      issue:
        'Build tools, Vite plugins, and TypeScript declaration packages are placed under runtime "dependencies" instead of "devDependencies", inflating production server installs.',
      recommendation:
        'Move vite, @vitejs/plugin-react, @tailwindcss/vite, and @types/prismjs into "devDependencies" so production runtimes install only runtime libraries.',
      workflowImpact:
        'Cuts clean npm install / container image size and speeds up CI/CD cold-start builds.',
    });
  }

  if (allDeps['typescript'] && /\^7\./.test(allDeps['typescript'])) {
    findings.push({
      id: 'ts-caret-drift',
      packageName: 'typescript',
      currentVersion: allDeps['typescript'],
      category: 'Version & Compatibility',
      severity: 'High',
      issue:
        'Using an unpinned caret (^7.0.2) on a major-transition TypeScript toolchain alongside @types/node (^22.14.0) and @types/react (^19.3.0) risks sudden compiler/JSX mismatches across deploys.',
      recommendation:
        'Pin verified compiler/runtime versions (commit package-lock.json and deploy with npm ci) across Vercel, Cloudflare, and local dev.',
      workflowImpact:
        'Eliminates "works locally, breaks on deploy" mornings and stops sudden tsc regressions.',
    });
  }

  if (allDeps['express'] && /\^4\./.test(allDeps['express'])) {
    findings.push({
      id: 'express-4-async-security',
      packageName: 'express',
      currentVersion: allDeps['express'],
      category: 'Security Hardening',
      severity: 'High',
      issue:
        'Express 4.21.2 does not natively catch rejected async route promises without wrapper middleware, and the stack lacks helmet headers, cors allowlisting, and express-rate-limit protecting /api/* routes.',
      recommendation:
        'Upgrade to Express 5.x (native async error handling) or wrap async routes, and add helmet + express-rate-limit + zod request validation.',
      workflowImpact:
        'Prevents unhandled promise crashes and shields Gemini, R2, and Resend quotas from unthrottled bursts.',
    });
  }

  if (allDeps['prismjs']) {
    findings.push({
      id: 'prismjs-xss-and-bundle',
      packageName: 'prismjs + @types/prismjs',
      currentVersion: `${allDeps['prismjs']} / ${allDeps['@types/prismjs'] || 'uninstalled'}`,
      category: 'Security Hardening',
      severity: 'Moderate',
      issue:
        'PrismJS 1.30 relies on imperative DOM/HTML string injection (dangerouslySetInnerHTML), lags behind on @types/prismjs (^1.26.6), and ships heavier client grammar bundles.',
      recommendation:
        'Replace prismjs with shiki (build-time or React-node AST highlighting) or sugar-high (<2 KB). If keeping PrismJS, sanitize HTML with DOMPurify.',
      workflowImpact:
        'Removes manual useEffect highlight hooks, drops ~40–75 KB from client bundles, and eliminates XSS review friction.',
    });
  }

  if (allDeps['tailwindcss'] && allDeps['autoprefixer']) {
    findings.push({
      id: 'redundant-autoprefixer',
      packageName: 'autoprefixer + @tailwindcss/vite',
      currentVersion: `${allDeps['autoprefixer']} + ${allDeps['@tailwindcss/vite'] || '4.x'}`,
      category: 'DX & Performance',
      severity: 'Advisory',
      issue:
        'Tailwind CSS v4 via @tailwindcss/vite already integrates Lightning CSS prefixing and bundling, making standalone autoprefixer redundant.',
      recommendation:
        'Remove standalone autoprefixer if no legacy PostCSS plugins remain to simplify CSS build tooling.',
      workflowImpact:
        'Reduces PostCSS pipeline overhead and keeps styling single-source inside src/index.css.',
    });
  }

  if (!allDeps['vitest'] && !allDeps['eslint']) {
    findings.push({
      id: 'missing-lint-test-guardrails',
      packageName: 'scripts.lint / quality gates',
      currentVersion: scripts.lint || 'tsc --noEmit',
      category: 'DX & Performance',
      severity: 'Advisory',
      issue:
        'scripts.lint currently runs only "tsc --noEmit", missing unused imports, React hook rules, and API contract regression tests.',
      recommendation:
        'Add eslint and vitest for fast automated checks across createApp.ts and chronicleData.ts.',
      workflowImpact:
        'Compresses manual QA before every git push into a deterministic 5-second automated check.',
    });
  }

  return {
    projectName: parsed.name || 'react-example',
    analyzedAt: new Date().toISOString(),
    totalDependencies: Object.keys(deps).length,
    totalDevDependencies: Object.keys(devDeps).length,
    summary: `Audited ${Object.keys(deps).length} runtime dependencies and ${Object.keys(devDeps).length} devDependencies for ${parsed.name || 'react-example'}. Found ${findings.length} actionable architecture, security, and DX optimizations.`,
    findings,
    suggestedScripts: {
      dev: 'tsx watch server.ts',
      start: 'node server.ts',
      build: 'vite build',
      lint: 'tsc --noEmit && eslint .',
      test: 'vitest run',
      audit: 'npm audit --omit=dev',
    },
  };
}

async function maybeAddGeminiAuditCommentary(report: PackageAuditReport): Promise<string | undefined> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return undefined;
  }
  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
    });
    const prompt = `You are a principal full-stack engineer reviewing Saragadam Kalyan's package.json audit for "${report.projectName}".
Findings: ${report.findings.map((f) => `${f.packageName} (${f.severity}): ${f.issue}`).join(' | ')}
Write a concise 2-sentence executive summary explaining how applying these upgrades improves daily developer workflow efficiency. Plain prose only, no markdown bullets.`;

    const timeoutPromise = new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), 10000));
    const genPromise = ai.models
      .generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
      })
      .then((resp) => (resp.text ? sanitizeAiOutput(resp.text) : undefined));

    return await Promise.race([genPromise, timeoutPromise]);
  } catch {
    return undefined;
  }
}

function readLocalArchive(): SavedEditionRecord[] {
  try {
    const indexPath = path.join(LOCAL_ARCHIVE_DIR, 'index.json');
    if (!fs.existsSync(indexPath)) return [];
    const raw = fs.readFileSync(indexPath, 'utf-8');
    return JSON.parse(raw) as SavedEditionRecord[];
  } catch {
    return [];
  }
}

function resolveSafeLocalArchiveFile(key: string): string | null {
  const safeFile = key.replace(/[^a-zA-Z0-9._-]/g, '_');
  if (!safeFile) return null;
  const resolved = path.resolve(LOCAL_ARCHIVE_DIR, `${safeFile}.json`);
  if (!resolved.startsWith(LOCAL_ARCHIVE_DIR + path.sep)) {
    return null;
  }
  return resolved;
}

function writeLocalArchiveRecord(record: SavedEditionRecord, snapshot: unknown): void {
  if (!fs.existsSync(LOCAL_ARCHIVE_DIR)) {
    fs.mkdirSync(LOCAL_ARCHIVE_DIR, { recursive: true });
  }
  const existing = readLocalArchive();
  const next = [record, ...existing.filter((item) => item.key !== record.key)].slice(0, 20);
  fs.writeFileSync(path.join(LOCAL_ARCHIVE_DIR, 'index.json'), JSON.stringify(next, null, 2));
  const targetPath = resolveSafeLocalArchiveFile(record.key);
  if (targetPath) {
    fs.writeFileSync(targetPath, JSON.stringify(snapshot, null, 2));
  }
}

async function executeDailyAutomationPipeline(options: {
  triggerSource: AutomationRunRecord['triggerSource'];
  triggeredBy: string;
  sendNewsletter: boolean;
  recipientEmail?: string;
}) {
  const startedAt = Date.now();
  const digest = await buildLiveDigest();
  cachedDigest = { data: digest, expiresAt: Date.now() + CACHE_TTL_MS };

  let packageFindingsCount = 0;
  try {
    const rootPkgPath = path.resolve(__dirname, '../../package.json');
    if (fs.existsSync(rootPkgPath)) {
      const pkgReport = analyzePackageManifest(fs.readFileSync(rootPkgPath, 'utf-8'));
      packageFindingsCount = pkgReport.findings.length;
    }
  } catch {
    packageFindingsCount = 0;
  }

  const isoDate = new Date().toISOString().slice(0, 10);
  const title = `Automated Press Edition — ${isoDate}`;
  const key = `editions/auto-${isoDate}-${Date.now()}.json`;
  const notes = `Automated ${options.triggerSource} run: ${digest.latestProjects.length} synced projects, ${digest.commits.length} commits, ${digest.substackPosts.length} Substack dispatches, ${packageFindingsCount} dependency checks.`;

  const snapshot = {
    key,
    title,
    notes,
    savedBy: options.triggeredBy,
    savedAt: new Date().toISOString(),
    automation: {
      triggerSource: options.triggerSource,
      packageFindingsCount,
    },
    digest,
  };

  const editionRecord: SavedEditionRecord = {
    key,
    title,
    savedAt: snapshot.savedAt,
    savedBy: options.triggeredBy,
    storageBackend: isR2Configured() ? 'cloudflare-r2' : 'local-archive',
    repoCount: digest.profile.publicRepos,
    commitCount: digest.commits.length,
    notes,
  };

  if (isR2Configured()) {
    const client = createR2Client();
    const bucket = getR2BucketName();
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: JSON.stringify(snapshot, null, 2),
        ContentType: 'application/json',
      })
    );
  } else {
    writeLocalArchiveRecord(editionRecord, snapshot);
  }
  await Promise.all([
    saveEditionMetadata(editionRecord),
    saveStorageObject({
      objectKey: key,
      bucket: isR2Configured() ? getR2BucketName() : 'chronicle-backend',
      contentType: 'application/json',
      payload: snapshot,
      ownerUserId: options.triggeredBy,
      storageBackend: isR2Configured() ? 'cloudflare-r2+backend-sql' : 'backend-sql',
    }),
  ]);

  let newsletterSent = false;
  const recipient =
    options.recipientEmail ||
    process.env.CRON_DIGEST_RECIPIENT ||
    'saragadamkalyan068@gmail.com';

  if (options.sendNewsletter && isResendConfigured()) {
    try {
      const subscribers = await listActiveSubscribers();
      const uniqueRecipients = Array.from(
        new Set([recipient, ...subscribers.map((s) => s.email)].filter(Boolean))
      );
      const editionDate = new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });
      const subject = `The Kalyan Chronicle — Daily Edition (${isoDate})`;
      const templateBase = {
        editionTitle: title,
        editionDate,
        editorNote: notes,
        publicRepos: digest.profile.publicRepos,
        commits: digest.commits,
        substackPosts: digest.substackPosts,
      };
      const resend = new Resend(process.env.RESEND_API_KEY);
      const from =
        process.env.RESEND_FROM_EMAIL || 'The Kalyan Chronicle <onboarding@resend.dev>';

      for (const toAddr of uniqueRecipients) {
        const unsubscribeUrl = buildUnsubscribeUrl(toAddr);
        const recipientInput = {
          ...templateBase,
          unsubscribeUrl,
        };
        const htmlBody = buildBroadsheetNewsletterHtml(recipientInput);
        const textBody = buildBroadsheetNewsletterText(recipientInput);
        const sendResult = await resend.emails.send({
          from,
          to: toAddr,
          subject,
          html: htmlBody,
          text: textBody,
          headers: buildNewsletterUnsubscribeHeaders(unsubscribeUrl),
          tags: [
            { name: 'publication', value: 'kalyan-chronicle' },
            { name: 'pipeline', value: options.triggerSource },
          ],
        });
        if (!sendResult.error) {
          newsletterSent = true;
          await saveNewsletterLog({
            id: `nl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            recipientEmail: toAddr,
            subject,
            resendMessageId: sendResult.data?.id || 'automated-sent',
            mode: `auto-${options.triggerSource}`,
            triggeredBy: options.triggeredBy,
            createdAt: new Date().toISOString(),
          });
        }
      }
    } catch {
      newsletterSent = false;
    }
  }

  const durationMs = Math.max(1, Date.now() - startedAt);
  const runStatus: AutomationRunRecord['status'] =
    options.sendNewsletter && isResendConfigured() && !newsletterSent ? 'partial' : 'completed';
  const runRecord: AutomationRunRecord = {
    id: `auto_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    triggerSource: options.triggerSource,
    status: runStatus,
    editionKey: key,
    commitCount: digest.commits.length,
    substackCount: digest.substackPosts.length,
    newsletterSent,
    durationMs,
    summary: `Synced ${digest.latestProjects.length} projects, ${digest.commits.length} commits & ${digest.substackPosts.length} Substack dispatches, audited ${packageFindingsCount} manifest items.`,
    createdAt: new Date().toISOString(),
  };
  await saveAutomationRun(runRecord);

  return {
    run: runRecord,
    edition: editionRecord,
    packageFindingsCount,
  };
}

let dailySchedulerTimer: ReturnType<typeof setInterval> | null = null;
let dailySchedulerInFlight = false;

export function startDailyBackendAutomation(): void {
  if (dailySchedulerTimer) return;

  const checkAndRunDailySync = async () => {
    if (dailySchedulerInFlight) return;
    dailySchedulerInFlight = true;
    try {
      const todayUtc = new Date().toISOString().slice(0, 10);
      const recentRuns = await listAutomationRuns();
      const ranToday = recentRuns.some(
        (run) => run.status === 'completed' && run.createdAt.slice(0, 10) === todayUtc
      );
      if (!ranToday) {
        await executeDailyAutomationPipeline({
          triggerSource: 'backend-scheduler',
          triggeredBy: 'backend-daily-scheduler',
          sendNewsletter: isResendConfigured(),
        });
      }
    } catch {
      // Non-fatal background sync error; retry next cycle
    } finally {
      dailySchedulerInFlight = false;
    }
  };

  // Run initial check shortly after server startup, then check hourly for daily rollover
  const initialTimer = setTimeout(() => {
    void checkAndRunDailySync();
  }, 8000);
  initialTimer.unref();

  dailySchedulerTimer = setInterval(() => {
    void checkAndRunDailySync();
  }, 60 * 60 * 1000);
  dailySchedulerTimer.unref();
}

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(createSecurityHeadersMiddleware());
  app.use(express.json({ limit: '256kb' }));
  app.use('/api/', apiGeneralLimiter);
  app.use('/api/', enforceSameOriginMutations);
  app.use('/a2a/', enforceSameOriginMutations);
  app.use('/api/', cloudflareBackendAuthMiddleware);

  if (isClerkConfigured()) {
    app.use(
      clerkMiddleware({
        publishableKey: process.env.CLERK_PUBLISHABLE_KEY || process.env.VITE_CLERK_PUBLISHABLE_KEY,
        secretKey: process.env.CLERK_SECRET_KEY,
      })
    );
  }

  app.get('/api/config-status', (_req: Request, res: Response) => {
    res.json({
      clerkConfigured: isClerkConfigured(),
      firebaseAuthConfigured: isFirebaseAuthConfigured(),
      cloudflareAccessConfigured: isCloudflareAccessConfigured(),
      cloudflareServiceAuthConfigured: isCloudflareServiceTokenConfigured(),
      neonConfigured: isNeonConfigured(),
      r2Configured: isR2Configured(),
      resendConfigured: isResendConfigured(),
      securityHardened: true,
      aiGuardrailsActive: true,
      ragMemoryReady: true,
      automationConfigured: true,
      cronSecretConfigured: Boolean(process.env.CRON_SECRET),
      geminiConfigured: Boolean(
        process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'
      ),
    });
  });

  app.get('/api/auth/session', async (req: Request, res: Response) => {
    try {
      const identity = await verifyUnifiedWriteAuth(req);
      const status = identity.authenticated ? 200 : 401;
      if (identity.authenticated && identity.provider !== 'preview-editor' && identity.userId) {
        void upsertUserAccount({
          provider: identity.provider,
          externalUserId: identity.userId,
          email: identity.email,
        }).catch(() => undefined);
      }
      res.status(status).json({
        authenticated: identity.authenticated,
        provider: identity.provider,
        userId: identity.userId || null,
        email: identity.email || null,
        error: identity.error || null,
        providersConfigured: {
          clerk: isClerkConfigured(),
          firebase: isFirebaseAuthConfigured(),
          cloudflareAccess: isCloudflareAccessConfigured(),
          cloudflareServiceToken: isCloudflareServiceTokenConfigured(),
        },
      });
    } catch {
      res.status(401).json({ authenticated: false, provider: 'none', error: 'Session verification failed.' });
    }
  });

  async function resolveRagSessionAccess(req: Request, sessionId: string) {
    const hasExplicitToken = Boolean(
      req.headers.authorization || req.headers['x-firebase-auth'] || req.headers['cf-access-jwt-assertion']
    );
    const identity = await verifyUnifiedWriteAuth(req).catch(() => ({
      authenticated: false,
      provider: 'none' as const,
      userId: undefined,
      email: undefined,
      error: 'Authentication failed.',
    }));
    if (hasExplicitToken && !identity.authenticated) {
      return { allowed: false as const, status: 401 as const, error: identity.error || 'Authentication failed.', identity, callerUserId: 'anonymous' };
    }
    const callerUserId =
      identity.authenticated && identity.provider !== 'preview-editor' && identity.userId
        ? identity.userId
        : 'anonymous';
    const owner = await getRagSessionOwner(sessionId);
    if (owner && owner !== 'anonymous' && owner !== callerUserId) {
      return {
        allowed: false as const,
        status: 403 as const,
        error: 'Access denied for this inquiry session.',
        identity,
        callerUserId,
      };
    }
    return { allowed: true as const, identity, callerUserId };
  }

  app.post('/api/rag/query', aiInferenceLimiter, async (req: Request, res: Response) => {
    const rawQuery = (req.body as { query?: unknown } | undefined)?.query;
    const rawSessionId = (req.body as { sessionId?: unknown } | undefined)?.sessionId;

    try {
      const preCheck = validateRagInput(
        typeof rawQuery === 'string' ? rawQuery : '',
        typeof rawSessionId === 'string' ? rawSessionId : undefined
      );
      if (!preCheck.allowed) {
        res.status(400).json({
          ok: false,
          blocked: true,
          riskCategory: preCheck.riskCategory,
          sessionId: preCheck.sanitizedSessionId,
          answer: preCheck.blockedReason || 'Your request could not be processed safely by the editorial desk.',
          citations: [],
          memoryCount: 0,
          usedLiveModel: false,
        });
        return;
      }

      const access = await resolveRagSessionAccess(req, preCheck.sanitizedSessionId);
      if (!access.allowed) {
        res.status(access.status).json({ ok: false, error: access.error });
        return;
      }

      const digest =
        cachedDigest?.data ??
        (await Promise.race([
          buildLiveDigest().then((d) => {
            cachedDigest = { data: d, expiresAt: Date.now() + CACHE_TTL_MS };
            return d;
          }),
          new Promise<DigestPayload>((resolve) =>
            setTimeout(
              () =>
                resolve({
                  fetchedAt: new Date().toISOString(),
                  githubSource: 'fallback',
                  substackSource: 'fallback',
                  profile: {
                    login: 'kalyan870',
                    name: 'Saragadam Kalyan',
                    bio: 'AI Engineer & Full-Stack Developer',
                    publicRepos: 54,
                    followers: 0,
                    avatarUrl: '',
                    htmlUrl: 'https://github.com/kalyan870',
                  },
                  repos: [],
                  latestProjects: FEATURED_PROJECTS,
                  commits: FALLBACK_COMMITS,
                  substackPosts: FALLBACK_SUBSTACK_POSTS,
                }),
              1500
            )
          ),
        ]));

      if (access.identity.authenticated && access.identity.provider !== 'preview-editor' && access.identity.userId) {
        void upsertUserAccount({
          provider: access.identity.provider,
          externalUserId: access.identity.userId,
          email: access.identity.email,
        }).catch(() => undefined);
      }

      const result = await queryChronicleRagWithMemory({
        query: preCheck.sanitizedQuery,
        sessionId: preCheck.sanitizedSessionId,
        userId: access.callerUserId,
        digestContext: {
          latestProjects: digest.latestProjects,
          commits: digest.commits,
          substackPosts: digest.substackPosts,
          publicRepos: digest.profile.publicRepos,
        },
      });

      if (!result.ok) {
        res.status(400).json(result);
        return;
      }

      res.json(result);
    } catch {
      res.status(500).json({ ok: false, error: 'Unable to complete editorial research lookup.' });
    }
  });

  app.post('/api/rag/stream', aiInferenceLimiter, async (req: Request, res: Response) => {
    const rawQuery = (req.body as { query?: unknown } | undefined)?.query;
    const rawSessionId = (req.body as { sessionId?: unknown } | undefined)?.sessionId;

    const preCheck = validateRagInput(
      typeof rawQuery === 'string' ? rawQuery : '',
      typeof rawSessionId === 'string' ? rawSessionId : undefined
    );
    if (!preCheck.allowed) {
      res.status(400).json({
        ok: false,
        blocked: true,
        riskCategory: preCheck.riskCategory,
        sessionId: preCheck.sanitizedSessionId,
        answer: preCheck.blockedReason || 'Your request could not be processed safely by the editorial desk.',
      });
      return;
    }

    const access = await resolveRagSessionAccess(req, preCheck.sanitizedSessionId);
    if (!access.allowed) {
      res.status(access.status).json({ ok: false, error: access.error });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    let closed = false;
    req.on('close', () => {
      closed = true;
    });

    try {
      const digest = await getActiveDigestFast();
      const result = await streamChronicleRagWithMemory(
        {
          query: preCheck.sanitizedQuery,
          sessionId: preCheck.sanitizedSessionId,
          userId: access.callerUserId,
          digestContext: {
            latestProjects: digest.latestProjects,
            commits: digest.commits,
            substackPosts: digest.substackPosts,
            publicRepos: digest.profile.publicRepos,
          },
        },
        {
          onCitations: (citations) => {
            if (!closed) {
              res.write(`event: citations\ndata: ${JSON.stringify({ citations })}\n\n`);
            }
          },
          onDelta: (chunk) => {
            if (!closed) {
              res.write(`event: delta\ndata: ${JSON.stringify({ text: chunk })}\n\n`);
            }
          },
          isAborted: () => closed,
        }
      );

      if (!closed) {
        res.write(
          `event: done\ndata: ${JSON.stringify({
            ok: result.ok,
            answer: result.answer,
            citations: result.citations,
            telemetry: result.telemetry,
            memoryCount: result.memoryCount,
          })}\n\n`
        );
        res.end();
      }
    } catch {
      if (!closed) {
        res.write(`event: error\ndata: ${JSON.stringify({ error: 'Stream interrupted.' })}\n\n`);
        res.end();
      }
    }
  });

  app.get('/api/rag/memory', async (req: Request, res: Response) => {
    const sessionId = typeof req.query.sessionId === 'string' ? req.query.sessionId : 'default-edition-session';
    const validation = validateRagInput('memory lookup', sessionId);
    if (!validation.allowed) {
      res.status(400).json({ error: validation.blockedReason || 'Invalid session identifier.' });
      return;
    }
    try {
      const access = await resolveRagSessionAccess(req, validation.sanitizedSessionId);
      if (!access.allowed) {
        res.status(access.status).json({ error: access.error });
        return;
      }
      const messages = await listRagMemories(validation.sanitizedSessionId, 16);
      res.json({ sessionId: validation.sanitizedSessionId, messages });
    } catch {
      res.status(500).json({ error: 'Unable to retrieve session notes.' });
    }
  });

  app.delete('/api/rag/memory', apiMutationLimiter, async (req: Request, res: Response) => {
    const rawSession =
      typeof req.query.sessionId === 'string'
        ? req.query.sessionId
        : (req.body as { sessionId?: string } | undefined)?.sessionId;
    const validation = validateRagInput('clear memory', rawSession);
    if (!validation.allowed) {
      res.status(400).json({ error: validation.blockedReason || 'Invalid session identifier.' });
      return;
    }
    try {
      const access = await resolveRagSessionAccess(req, validation.sanitizedSessionId);
      if (!access.allowed) {
        res.status(access.status).json({ error: access.error });
        return;
      }
      await clearRagMemories(validation.sanitizedSessionId);
      res.json({ ok: true, sessionId: validation.sanitizedSessionId });
    } catch {
      res.status(500).json({ error: 'Unable to clear session notes.' });
    }
  });

  app.get('/api/digest', async (req: Request, res: Response) => {
    try {
      const forceRefresh = req.query.refresh === 'true';
      const now = Date.now();
      if (!forceRefresh && cachedDigest && cachedDigest.expiresAt > now) {
        res.json(cachedDigest.data);
        return;
      }
      const data = await buildLiveDigest();
      cachedDigest = { data, expiresAt: now + CACHE_TTL_MS };
      res.json(data);
    } catch {
      res.status(500).json({ error: 'Unable to compile engineering digest.' });
    }
  });

  app.post('/api/analyze-package', apiMutationLimiter, async (req: Request, res: Response) => {
    const parsedInput = analyzePackageSchema.safeParse(req.body);
    if (!parsedInput.success) {
      res.status(400).json({ error: parsedInput.error.issues[0]?.message || 'Invalid payload.' });
      return;
    }

    try {
      const report = analyzePackageManifest(parsedInput.data.packageJson);
      const aiCommentary = await maybeAddGeminiAuditCommentary(report);
      if (aiCommentary) {
        report.aiCommentary = aiCommentary;
      }
      res.json(report);
    } catch (err) {
      const msg =
        err instanceof Error && err.message.includes('JSON object')
          ? err.message
          : 'Invalid JSON syntax in package.json input.';
      res.status(400).json({ error: msg });
    }
  });

  app.get('/api/r2/editions', async (_req: Request, res: Response) => {
    try {
      const editions = await listEditionMetadata();
      const fallbackLocal = editions.length > 0 ? editions : readLocalArchive();
      res.json({
        backend: isR2Configured() ? 'cloudflare-r2' : 'local-archive',
        databaseBackend: isNeonConfigured() ? 'neon-postgres' : 'local-fallback',
        editions: fallbackLocal,
      });
    } catch {
      res.status(500).json({ error: 'Failed to list archived editions.' });
    }
  });

  app.get('/api/r2/editions/detail', async (req: Request, res: Response) => {
    const key = typeof req.query.key === 'string' ? req.query.key : '';
    if (!isSafeObjectKey(key, 'editions/')) {
      res.status(400).json({ error: 'Invalid or unsafe edition key.' });
      return;
    }

    try {
      if (isR2Configured()) {
        const client = createR2Client();
        const bucket = getR2BucketName();
        const obj = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
        const bodyText = await obj.Body?.transformToString();
        res.json(bodyText ? JSON.parse(bodyText) : {});
        return;
      }

      const filePath = resolveSafeLocalArchiveFile(key);
      if (filePath && fs.existsSync(filePath)) {
        res.json(JSON.parse(fs.readFileSync(filePath, 'utf-8')));
        return;
      }

      const dbObj = await getStorageObject(key);
      if (dbObj) {
        res.json(dbObj.payload);
        return;
      }

      res.status(404).json({ error: 'Edition snapshot not found.' });
    } catch {
      res.status(500).json({ error: 'Unable to retrieve archived edition.' });
    }
  });

  app.post('/api/r2/editions', apiMutationLimiter, async (req: Request, res: Response) => {
    const authResult = await verifyUnifiedWriteAuth(req);
    if (!authResult.authenticated || !authResult.userId) {
      res.status(401).json({ error: authResult.error || 'Authentication required to archive editions.' });
      return;
    }
    const savedBy = authResult.userId;
    if (authResult.provider !== 'preview-editor') {
      await Promise.all([
        upsertUserAccount({
          provider: authResult.provider,
          externalUserId: authResult.userId,
          email: authResult.email,
        }),
        recordAuthEvent({
          provider: authResult.provider,
          userId: authResult.userId,
          action: 'archive-edition',
        }),
      ]);
    }

    const parsedBody = saveEditionSchema.safeParse(req.body || {});
    if (!parsedBody.success) {
      res.status(400).json({ error: parsedBody.error.issues[0]?.message || 'Invalid edition payload.' });
      return;
    }

    try {
      const title = parsedBody.data.title || `Kalyan-Chronicle-${new Date().toISOString().slice(0, 10)}`;
      const notes = parsedBody.data.notes || '';
      const digest = cachedDigest?.data ?? (await buildLiveDigest());
      const timestamp = Date.now();
      const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const key = `editions/${slug || 'edition'}-${timestamp}.json`;

      const snapshot = {
        key,
        title,
        notes,
        savedBy,
        savedAt: new Date().toISOString(),
        digest,
      };

      const record: SavedEditionRecord = {
        key,
        title,
        savedAt: snapshot.savedAt,
        savedBy,
        storageBackend: isR2Configured() ? 'cloudflare-r2' : 'local-archive',
        repoCount: digest.profile.publicRepos,
        commitCount: digest.commits.length,
        notes,
      };

      if (isR2Configured()) {
        const client = createR2Client();
        const bucket = getR2BucketName();
        await client.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: JSON.stringify(snapshot, null, 2),
            ContentType: 'application/json',
          })
        );
      } else {
        writeLocalArchiveRecord(record, snapshot);
      }

      await Promise.all([
        saveEditionMetadata(record),
        saveStorageObject({
          objectKey: key,
          bucket: isR2Configured() ? getR2BucketName() : 'chronicle-backend',
          contentType: 'application/json',
          payload: snapshot,
          ownerUserId: savedBy,
          storageBackend: isR2Configured() ? 'cloudflare-r2+backend-sql' : 'backend-sql',
        }),
      ]);
      res.json({
        ok: true,
        record,
        databaseBackend: isNeonConfigured() ? 'neon-postgres' : 'local-fallback',
      });
    } catch {
      res.status(500).json({ error: 'Failed to archive newspaper edition.' });
    }
  });

  app.post('/api/r2/presign-upload', apiMutationLimiter, async (req: Request, res: Response) => {
    const authResult = await verifyUnifiedWriteAuth(req);
    if (!authResult.authenticated || !authResult.userId) {
      res.status(401).json({ error: authResult.error || 'Authentication required for object upload URLs.' });
      return;
    }
    const uploadedBy = authResult.userId;

    const parsedUpload = presignUploadSchema.safeParse(req.body);
    if (!parsedUpload.success) {
      res.status(400).json({ error: parsedUpload.error.issues[0]?.message || 'Invalid media upload metadata.' });
      return;
    }

    const { fileName, contentType } = parsedUpload.data;
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '-').toLowerCase();
    const objectKey = `media/${uploadedBy.replace(/[^a-zA-Z0-9_-]/g, '')}/${Date.now()}-${safeName}`;

    if (!isR2Configured()) {
      res.json({
        mode: 'local-fallback',
        objectKey,
        expiresInSeconds: 120,
        uploadUrl: null,
        message: 'Cloudflare R2 credentials not yet configured; recording metadata locally in preview.',
      });
      return;
    }

    try {
      const client = createR2Client();
      const bucket = getR2BucketName();
      const command = new PutObjectCommand({
        Bucket: bucket,
        Key: objectKey,
        ContentType: contentType,
      });
      const uploadUrl = await getSignedUrl(client, command, { expiresIn: 120 });
      res.json({
        mode: 'r2-presigned',
        objectKey,
        expiresInSeconds: 120,
        uploadUrl,
      });
    } catch {
      res.status(500).json({ error: 'Unable to generate short-lived Cloudflare R2 upload URL.' });
    }
  });

  app.post('/api/r2/media', apiMutationLimiter, async (req: Request, res: Response) => {
    const authResult = await verifyUnifiedWriteAuth(req);
    if (!authResult.authenticated || !authResult.userId) {
      res.status(401).json({ error: authResult.error || 'Authentication required to register media assets.' });
      return;
    }
    const uploadedBy = authResult.userId;

    const parsedMedia = registerMediaSchema.safeParse(req.body);
    if (!parsedMedia.success || !isSafeObjectKey(parsedMedia.data.objectKey, 'media/')) {
      res.status(400).json({ error: 'Invalid media asset payload or object key.' });
      return;
    }

    const safeCallerNamespace = uploadedBy.replace(/[^a-zA-Z0-9_-]/g, '');
    if (
      authResult.provider !== 'preview-editor' &&
      !parsedMedia.data.objectKey.startsWith(`media/${safeCallerNamespace}/`)
    ) {
      res.status(403).json({ error: 'Media key must be scoped to your signed-in namespace.' });
      return;
    }

    const { fileName, contentType, byteSize, objectKey } = parsedMedia.data;

    const asset: MediaAssetRecord = {
      id: `media_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      fileName,
      contentType,
      byteSize,
      r2ObjectKey: objectKey,
      uploadedBy,
      createdAt: new Date().toISOString(),
      storageBackend: isR2Configured() ? 'cloudflare-r2' : 'local-archive',
    };

    try {
      await saveMediaAssetMetadata(asset);
      res.json({
        ok: true,
        asset,
        databaseBackend: isNeonConfigured() ? 'neon-postgres' : 'local-fallback',
      });
    } catch {
      res.status(500).json({ error: 'Failed to persist media metadata.' });
    }
  });

  app.get('/api/r2/media', async (req: Request, res: Response) => {
    const authResult = await verifyUnifiedWriteAuth(req);
    if (!authResult.authenticated) {
      res.status(401).json({ error: authResult.error || 'Authentication required to inspect media & dispatch logs.' });
      return;
    }

    try {
      const [media, newsletterLogs] = await Promise.all([
        listMediaAssetMetadata(),
        listNewsletterLogs(),
      ]);
      const scopedMedia =
        authResult.provider === 'preview-editor'
          ? media
          : media.filter((m) => m.uploadedBy === authResult.userId);
      const scopedLogs =
        authResult.provider === 'preview-editor'
          ? newsletterLogs
          : newsletterLogs.filter((log) => log.triggeredBy === authResult.userId);
      res.json({
        databaseBackend: isNeonConfigured() ? 'neon-postgres' : 'local-fallback',
        media: scopedMedia,
        newsletterLogs: scopedLogs,
      });
    } catch {
      res.status(500).json({ error: 'Failed to fetch Neon relational activity.' });
    }
  });

  app.get('/api/r2/presign-download', async (req: Request, res: Response) => {
    const authResult = await verifyUnifiedWriteAuth(req);
    if (!authResult.authenticated || !authResult.userId) {
      res.status(401).json({ error: authResult.error || 'Authentication required for object download URLs.' });
      return;
    }

    const key = typeof req.query.key === 'string' ? req.query.key : '';
    if (!isSafeObjectKey(key, 'media/')) {
      res.status(400).json({ error: 'Invalid or unsafe R2 media key.' });
      return;
    }
    const safeCallerNamespace = authResult.userId.replace(/[^a-zA-Z0-9_-]/g, '');
    if (
      authResult.provider !== 'preview-editor' &&
      !key.startsWith(`media/${safeCallerNamespace}/`)
    ) {
      res.status(403).json({ error: 'Access denied for this media asset.' });
      return;
    }
    if (!isR2Configured()) {
      res.status(400).json({ error: 'Cloudflare R2 credentials are not configured yet.' });
      return;
    }
    try {
      const client = createR2Client();
      const bucket = getR2BucketName();
      const downloadUrl = await getSignedUrl(
        client,
        new GetObjectCommand({ Bucket: bucket, Key: key }),
        { expiresIn: 120 }
      );
      res.json({ downloadUrl, expiresInSeconds: 120 });
    } catch {
      res.status(500).json({ error: 'Unable to generate short-lived R2 read URL.' });
    }
  });

  const handleNewsletterDispatch = async (req: Request, res: Response) => {
    const parsedMail = newsletterDispatchSchema.safeParse(req.body || {});
    if (!parsedMail.success) {
      res.status(400).json({ error: parsedMail.error.issues[0]?.message || 'Invalid newsletter payload.' });
      return;
    }

    try {
      const previewOnly = Boolean(parsedMail.data.previewOnly);
      const authResult = await verifyUnifiedWriteAuth(req);

      if (!previewOnly && !authResult.authenticated) {
        res.status(401).json({ error: authResult.error || 'Authentication required before dispatching email digests.' });
        return;
      }

      const to = parsedMail.data.to || 'saragadamkalyan068@gmail.com';
      const note = parsedMail.data.note || '';
      const editionTitle = parsedMail.data.editionTitle || 'Daily Engineering & Workflow Monograph';
      const editionDate = new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });
      const subject =
        parsedMail.data.subject ||
        `The Kalyan Chronicle — ${editionTitle} (${new Date().toLocaleDateString('en-US')})`;

      const digest = cachedDigest?.data ?? (await buildLiveDigest());
      cachedDigest = { data: digest, expiresAt: Date.now() + CACHE_TTL_MS };
      const unsubscribeUrl = buildUnsubscribeUrl(to, req);
      const templateInput = {
        editionTitle,
        editionDate,
        editorNote: note,
        publicRepos: digest.profile.publicRepos,
        commits: digest.commits,
        substackPosts: digest.substackPosts,
        unsubscribeUrl,
      };

      const html = buildBroadsheetNewsletterHtml(templateInput);
      const text = buildBroadsheetNewsletterText(templateInput);

      if (previewOnly || !isResendConfigured()) {
        res.status(200).json({
          sent: false,
          mode: 'preview',
          subject,
          recipient: to,
          message: 'Generated full broadsheet HTML edition preview below.',
          previewHtml: html,
        });
        return;
      }

      const resend = new Resend(process.env.RESEND_API_KEY);
      const from = process.env.RESEND_FROM_EMAIL || 'The Kalyan Chronicle <onboarding@resend.dev>';
      const result = await resend.emails.send({
        from,
        to,
        subject,
        html,
        text,
        headers: buildNewsletterUnsubscribeHeaders(unsubscribeUrl),
        tags: [{ name: 'publication', value: 'kalyan-chronicle' }],
      });

      if (result.error) {
        res.status(400).json({ error: result.error.message });
        return;
      }

      const messageId = result.data?.id || 'sent';
      await saveNewsletterLog({
        id: `nl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        recipientEmail: to,
        subject,
        resendMessageId: messageId,
        mode: 'email-live',
        triggeredBy: authResult.userId || 'local-editor',
        createdAt: new Date().toISOString(),
      });

      res.json({
        sent: true,
        mode: 'email-live',
        id: messageId,
        subject,
        recipient: to,
        message: `Broadsheet newsletter delivered to ${to}.`,
      });
    } catch {
      res.status(500).json({ error: 'Email delivery encountered an unexpected error.' });
    }
  };

  app.post('/api/email/send-digest', apiMutationLimiter, handleNewsletterDispatch);
  app.post('/api/newsletter/send', apiMutationLimiter, handleNewsletterDispatch);

  app.post('/api/newsletter/subscribe', subscribeStrictLimiter, async (req: Request, res: Response) => {
    const parsedSub = subscribeDigestSchema.safeParse(req.body || {});
    if (!parsedSub.success) {
      res.status(400).json({ error: parsedSub.error.issues[0]?.message || 'Please provide a valid email address.' });
      return;
    }

    try {
      const subscriber = await saveSubscriber({
        email: parsedSub.data.email,
        name: parsedSub.data.name,
      });

      const editionDate = new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });
      const digest = cachedDigest?.data ?? (await buildLiveDigest());
      cachedDigest = { data: digest, expiresAt: Date.now() + CACHE_TTL_MS };
      const welcomeNote = subscriber.name
        ? `Welcome to The Kalyan Chronicle, ${subscriber.name}. You are subscribed to receive the daily morning broadsheet automatically in your inbox.`
        : 'Welcome to The Kalyan Chronicle. You are subscribed to receive the daily morning broadsheet automatically in your inbox.';

      const unsubscribeUrl = buildUnsubscribeUrl(subscriber.email, req);
      const templateInput = {
        editionTitle: 'Welcome & Daily Morning Dispatch',
        editionDate,
        editorNote: welcomeNote,
        publicRepos: digest.profile.publicRepos,
        commits: digest.commits,
        substackPosts: digest.substackPosts,
        unsubscribeUrl,
      };

      const html = buildBroadsheetNewsletterHtml(templateInput);
      const text = buildBroadsheetNewsletterText(templateInput);
      const subject = `Subscribed: The Kalyan Chronicle — Daily Digest (${new Date().toLocaleDateString('en-US')})`;

      if (!isResendConfigured()) {
        res.status(200).json({
          ok: true,
          subscribed: true,
          delivered: false,
          mode: 'preview',
          email: subscriber.email,
          message: `Subscribed ${subscriber.email} to the daily Kalyan Chronicle. Preview today’s morning dispatch below.`,
          previewHtml: html,
        });
        return;
      }

      const resend = new Resend(process.env.RESEND_API_KEY);
      const audienceId = process.env.RESEND_AUDIENCE_ID;
      if (audienceId) {
        try {
          await resend.contacts.create({
            email: subscriber.email,
            firstName: subscriber.name || undefined,
            unsubscribed: false,
            audienceId,
          });
        } catch {
          // Non-fatal if contact already exists or audience scoping differs
        }
      }

      const from = process.env.RESEND_FROM_EMAIL || 'The Kalyan Chronicle <onboarding@resend.dev>';
      const result = await resend.emails.send({
        from,
        to: subscriber.email,
        subject,
        html,
        text,
        headers: buildNewsletterUnsubscribeHeaders(unsubscribeUrl),
        tags: [
          { name: 'publication', value: 'kalyan-chronicle' },
          { name: 'flow', value: 'subscribe-welcome' },
        ],
      });

      if (result.error) {
        res.status(400).json({ error: result.error.message });
        return;
      }

      const messageId = result.data?.id || 'subscribed';
      await saveNewsletterLog({
        id: `nl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        recipientEmail: subscriber.email,
        subject,
        resendMessageId: messageId,
        mode: 'email-subscribe-welcome',
        triggeredBy: 'classifieds-subscribe',
        createdAt: new Date().toISOString(),
      });

      res.json({
        ok: true,
        subscribed: true,
        delivered: true,
        mode: 'email-live',
        id: messageId,
        email: subscriber.email,
        message: `Subscribed! Today’s Kalyan Chronicle has been dispatched to ${subscriber.email}.`,
      });
    } catch {
      res.status(500).json({ error: 'Unable to complete subscription right now. Please try again shortly.' });
    }
  });

  const handleUnsubscribe = async (req: Request, res: Response) => {
    const rawToken =
      typeof req.query.token === 'string'
        ? req.query.token
        : typeof (req.body as { token?: unknown } | undefined)?.token === 'string'
          ? ((req.body as { token: string }).token)
          : '';
    const email = verifyUnsubscribeToken(rawToken);
    const wantsJson =
      req.query.format === 'json' ||
      (req.headers.accept || '').includes('application/json') ||
      req.method === 'POST';

    if (!email) {
      if (wantsJson) {
        res.status(400).json({ ok: false, error: 'Invalid or expired unsubscribe token.' });
        return;
      }
      res
        .status(400)
        .type('html')
        .send(
          `<!doctype html><html lang="en"><head><meta charset="UTF-8"><title>Invalid Unsubscribe Link</title></head><body style="background:#f7f3ea;color:#161513;font-family:Georgia,serif;padding:40px;"><div style="max-width:520px;margin:0 auto;background:#fcfaf4;border:1px solid #2b2925;padding:28px;"><h1 style="margin-top:0;font-size:22px;">Invalid Unsubscribe Link</h1><p style="font-size:14px;color:#524e46;">This unsubscribe token could not be verified. Please use the link from a recent edition email.</p></div></body></html>`
        );
      return;
    }

    try {
      await unsubscribeSubscriber(email);
      if (isResendConfigured() && process.env.RESEND_AUDIENCE_ID) {
        try {
          const resend = new Resend(process.env.RESEND_API_KEY);
          await resend.contacts.update({
            email,
            audienceId: process.env.RESEND_AUDIENCE_ID,
            unsubscribed: true,
          });
        } catch {
          // Non-fatal if contact update fails
        }
      }

      if (wantsJson) {
        res.json({ ok: true, unsubscribed: true, email });
        return;
      }

      res
        .status(200)
        .type('html')
        .send(
          `<!doctype html><html lang="en"><head><meta charset="UTF-8"><title>Unsubscribed — The Kalyan Chronicle</title></head><body style="background:#f7f3ea;color:#161513;font-family:Georgia,serif;padding:40px;"><div style="max-width:520px;margin:0 auto;background:#fcfaf4;border:1px solid #2b2925;padding:28px;"><p style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#8b261d;font-weight:bold;margin:0 0 8px;">The Kalyan Chronicle</p><h1 style="margin:0 0 12px;font-size:24px;">Daily Digest Unsubscribed</h1><p style="font-size:14px;line-height:1.5;color:#524e46;"><strong>${escapeHtmlText(email)}</strong> has been removed from automatic daily broadsheet deliveries.</p></div></body></html>`
        );
    } catch {
      res.status(500).json({ ok: false, error: 'Unable to update subscription preference right now.' });
    }
  };

  app.get('/api/newsletter/unsubscribe', apiMutationLimiter, handleUnsubscribe);
  app.post('/api/newsletter/unsubscribe', apiMutationLimiter, handleUnsubscribe);

  app.get('/api/automation/runs', async (_req: Request, res: Response) => {
    try {
      const runs = await listAutomationRuns();
      res.json({
        schedule: '0 7 * * *',
        scheduleLabel: 'Daily 07:00 UTC',
        cronSecretConfigured: Boolean(process.env.CRON_SECRET),
        databaseBackend: isNeonConfigured() ? 'neon-postgres' : 'local-fallback',
        runs,
      });
    } catch {
      res.status(500).json({ error: 'Unable to load daily sync ledger.' });
    }
  });

  app.post('/api/automation/run', apiMutationLimiter, async (req: Request, res: Response) => {
    const authResult = await verifyUnifiedWriteAuth(req);
    if (!authResult.authenticated || !authResult.userId) {
      res.status(401).json({ error: authResult.error || 'Authentication required to trigger a manual press refresh.' });
      return;
    }
    const triggeredBy = authResult.userId;

    const parsed = automationTriggerSchema.safeParse(req.body || {});
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid payload.' });
      return;
    }

    try {
      const result = await executeDailyAutomationPipeline({
        triggerSource: parsed.data.triggerSource || 'manual-press-run',
        triggeredBy,
        sendNewsletter: Boolean(parsed.data.sendNewsletter),
        recipientEmail: parsed.data.recipientEmail || undefined,
      });
      res.json({
        ok: true,
        ...result,
        databaseBackend: isNeonConfigured() ? 'neon-postgres' : 'local-fallback',
      });
    } catch {
      res.status(500).json({ error: 'Daily project refresh failed.' });
    }
  });

  const handleScheduledCron = async (req: Request, res: Response) => {
    const cfAuth = res.locals.cloudflareAuth as { authenticated?: boolean; userId?: string } | undefined;
    const cronSecret = process.env.CRON_SECRET;
    if (cfAuth?.authenticated) {
      // Verified Cloudflare Access JWT or Service Token from Cloudflare Triggers / Workers
    } else if (cronSecret) {
      if (!verifyCronBearerToken(req.headers.authorization, cronSecret)) {
        res.status(401).json({ error: 'Unauthorized cron request. Valid CRON_SECRET Bearer token required.' });
        return;
      }
    } else if (process.env.NODE_ENV === 'production') {
      res.status(401).json({ error: 'CRON_SECRET or Cloudflare backend authentication must be configured for production cron triggers.' });
      return;
    } else if (req.method === 'GET' && !req.headers['x-vercel-cron']) {
      res.status(401).json({ error: 'CRON_SECRET Bearer token or x-vercel-cron header required for GET cron trigger.' });
      return;
    }

    const parsed = automationTriggerSchema.safeParse(req.body || {});
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid cron payload.' });
      return;
    }

    try {
      const triggerSource =
        parsed.data.triggerSource ||
        (req.headers['x-vercel-cron']
          ? 'vercel-cron'
          : cfAuth?.authenticated
            ? 'cloudflare-trigger'
            : 'github-actions');
      const result = await executeDailyAutomationPipeline({
        triggerSource,
        triggeredBy: cfAuth?.userId ? `cron:${cfAuth.userId}` : `cron:${triggerSource}`,
        sendNewsletter: parsed.data.sendNewsletter ?? true,
        recipientEmail: parsed.data.recipientEmail || undefined,
      });
      res.json({ ok: true, ...result });
    } catch {
      res.status(500).json({ error: 'Scheduled cron press run failed.' });
    }
  };

  app.get('/api/cron/daily-edition', apiMutationLimiter, handleScheduledCron);
  app.post('/api/cron/daily-edition', apiMutationLimiter, handleScheduledCron);

  app.get('/api/storage/objects', async (req: Request, res: Response) => {
    try {
      const authResult = await verifyUnifiedWriteAuth(req);
      if (!authResult.authenticated) {
        res.status(401).json({ error: authResult.error || 'Authentication required to list stored objects.' });
        return;
      }
      const prefix = typeof req.query.prefix === 'string' ? req.query.prefix.trim() : '';
      if (prefix && !/^[a-zA-Z0-9._/-]{1,80}$/.test(prefix)) {
        res.status(400).json({ error: 'Invalid object key prefix.' });
        return;
      }
      const allObjects = await listStorageObjects(prefix, 25);
      const visibleObjects =
        authResult.provider === 'preview-editor'
          ? allObjects
          : allObjects.filter(
              (obj) =>
                obj.ownerUserId === authResult.userId ||
                obj.ownerUserId === 'backend-daily-scheduler' ||
                obj.objectKey.startsWith('editions/')
            );
      res.json({
        databaseBackend: isNeonConfigured() ? 'neon-postgres' : 'local-fallback',
        objects: visibleObjects,
      });
    } catch {
      res.status(500).json({ error: 'Failed to list backend storage objects.' });
    }
  });

  app.get('/api/storage/objects/detail', async (req: Request, res: Response) => {
    try {
      const authResult = await verifyUnifiedWriteAuth(req);
      if (!authResult.authenticated) {
        res.status(401).json({ error: authResult.error || 'Authentication required to read stored objects.' });
        return;
      }
      const key = typeof req.query.key === 'string' ? req.query.key.trim() : '';
      if (
        !isSafeObjectKey(key, 'storage/') &&
        !isSafeObjectKey(key, 'editions/') &&
        !isSafeObjectKey(key, 'media/')
      ) {
        res.status(400).json({ error: 'Invalid or unsafe storage object key.' });
        return;
      }
      const item = await getStorageObject(key);
      if (!item) {
        res.status(404).json({ error: 'Stored object not found.' });
        return;
      }
      if (
        authResult.provider !== 'preview-editor' &&
        key.startsWith('storage/') &&
        item.ownerUserId !== authResult.userId &&
        item.ownerUserId !== 'backend-daily-scheduler'
      ) {
        res.status(403).json({ error: 'Access denied for this stored object.' });
        return;
      }
      res.json(item);
    } catch {
      res.status(500).json({ error: 'Failed to retrieve stored object.' });
    }
  });

  app.post('/api/storage/objects', apiMutationLimiter, async (req: Request, res: Response) => {
    try {
      const authResult = await verifyUnifiedWriteAuth(req);
      if (!authResult.authenticated || !authResult.userId) {
        res.status(401).json({ error: authResult.error || 'Authentication required to write stored objects.' });
        return;
      }

      const parsed = storageObjectSchema.safeParse(req.body || {});
      if (!parsed.success || !isSafeObjectKey(parsed.data.key, 'storage/')) {
        res.status(400).json({ error: 'Object key must start with "storage/" and contain safe characters only.' });
        return;
      }

      const existing = await getStorageObject(parsed.data.key);
      if (
        existing &&
        authResult.provider !== 'preview-editor' &&
        existing.ownerUserId !== authResult.userId
      ) {
        res.status(403).json({ error: 'You do not have permission to overwrite this object key.' });
        return;
      }

      const saved = await saveStorageObject({
        objectKey: parsed.data.key,
        contentType: parsed.data.contentType || 'application/json',
        payload: parsed.data.payload,
        ownerUserId: authResult.userId,
        storageBackend: isNeonConfigured() ? 'neon-postgres' : 'backend-sql',
      });
      if (authResult.provider !== 'preview-editor') {
        await Promise.all([
          upsertUserAccount({
            provider: authResult.provider,
            externalUserId: authResult.userId,
            email: authResult.email,
          }),
          recordAuthEvent({
            provider: authResult.provider,
            userId: authResult.userId,
            action: 'write-storage-object',
            resourceKey: parsed.data.key,
          }),
        ]);
      }
      res.json({ ok: true, object: saved });
    } catch {
      res.status(500).json({ error: 'Failed to persist backend storage object.' });
    }
  });

  function resolvePublicBaseUrl(req: Request): string {
    return resolveSafeBaseUrl(req);
  }

  async function getActiveDigestFast(): Promise<DigestPayload> {
    if (cachedDigest && cachedDigest.expiresAt > Date.now()) {
      return cachedDigest.data;
    }
    try {
      const live = await Promise.race([
        buildLiveDigest().then((d) => {
          cachedDigest = { data: d, expiresAt: Date.now() + CACHE_TTL_MS };
          return d;
        }),
        new Promise<DigestPayload>((resolve) =>
          setTimeout(
            () =>
              resolve({
                fetchedAt: new Date().toISOString(),
                githubSource: 'fallback',
                substackSource: 'fallback',
                profile: {
                  login: 'kalyan870',
                  name: 'Saragadam Kalyan',
                  bio: 'AI Engineer building practical GenAI, LLM, agentic AI, and full-stack applications.',
                  publicRepos: 54,
                  followers: 0,
                  avatarUrl: '',
                  htmlUrl: 'https://github.com/kalyan870',
                },
                repos: [],
                latestProjects: FEATURED_PROJECTS,
                commits: FALLBACK_COMMITS,
                substackPosts: FALLBACK_SUBSTACK_POSTS,
              }),
            1500
          )
        ),
      ]);
      return live;
    } catch {
      return {
        fetchedAt: new Date().toISOString(),
        githubSource: 'fallback',
        substackSource: 'fallback',
        profile: {
          login: 'kalyan870',
          name: 'Saragadam Kalyan',
          bio: 'AI Engineer building practical GenAI, LLM, agentic AI, and full-stack applications.',
          publicRepos: 54,
          followers: 0,
          avatarUrl: '',
          htmlUrl: 'https://github.com/kalyan870',
        },
        repos: [],
        latestProjects: FEATURED_PROJECTS,
        commits: FALLBACK_COMMITS,
        substackPosts: FALLBACK_SUBSTACK_POSTS,
      };
    }
  }

  app.get('/llms.txt', async (req: Request, res: Response) => {
    const digest = await getActiveDigestFast();
    res.type('text/markdown; charset=utf-8').send(buildLlmsTxt(digest, resolvePublicBaseUrl(req)));
  });

  app.get('/feed.json', async (req: Request, res: Response) => {
    const digest = await getActiveDigestFast();
    res.setHeader('Content-Type', 'application/feed+json; charset=utf-8');
    res.json(buildJsonFeed(digest, resolvePublicBaseUrl(req)));
  });

  app.get('/rss.xml', async (req: Request, res: Response) => {
    const digest = await getActiveDigestFast();
    res.type('application/rss+xml; charset=utf-8').send(buildRssFeed(digest, resolvePublicBaseUrl(req)));
  });

  app.get('/api/og', async (_req: Request, res: Response) => {
    const digest = await getActiveDigestFast();
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.type('image/svg+xml; charset=utf-8').send(buildBroadsheetOgSvg(digest));
  });

  app.get('/api/mcp', (_req: Request, res: Response) => {
    res.json(getMcpServerDescriptor());
  });

  app.post('/api/mcp', apiMutationLimiter, async (req: Request, res: Response) => {
    try {
      const digest = await getActiveDigestFast();
      const result = await handleMcpJsonRpc(req.body, {
        latestProjects: digest.latestProjects,
        commits: digest.commits,
        substackPosts: digest.substackPosts,
        publicRepos: digest.profile.publicRepos,
      });
      res.status(result.status).json(result.payload);
    } catch {
      res.status(500).json({
        jsonrpc: '2.0',
        id: null,
        error: { code: -32603, message: 'Internal MCP execution error.' },
      });
    }
  });

  app.post('/api/workbench/trace-audit', apiMutationLimiter, (req: Request, res: Response) => {
    const parsed = traceAuditSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid trace spans payload.' });
      return;
    }
    const report = auditAgentTrace(parsed.data);
    res.json({ ok: true, report });
  });

  app.post('/api/workbench/eval-matrix', apiMutationLimiter, (req: Request, res: Response) => {
    const parsed = evalMatrixSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid eval matrix payload.' });
      return;
    }
    const report = runRagEvalMatrix(parsed.data);
    res.json({ ok: true, report });
  });

  app.get('/.well-known/agent-card.json', async (req: Request, res: Response) => {
    const digest = await getActiveDigestFast();
    res.json(buildAgentCard(digest, resolvePublicBaseUrl(req)));
  });

  app.post('/a2a/v1', aiInferenceLimiter, async (req: Request, res: Response) => {
    try {
      const digest = await getActiveDigestFast();
      await handleA2aRpcRequest(req, res, {
        latestProjects: digest.latestProjects,
        commits: digest.commits,
        substackPosts: digest.substackPosts,
        publicRepos: digest.profile.publicRepos,
      });
    } catch {
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          id: null,
          error: { code: -32603, message: 'Internal A2A execution failure.' },
        });
      }
    }
  });

  app.get('/healthz/live', (_req: Request, res: Response) => {
    res.status(200).json({
      status: 'UP',
      uptimeSec: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/healthz/ready', async (_req: Request, res: Response) => {
    try {
      const runs = await listAutomationRuns();
      res.status(200).json({
        status: 'READY',
        databaseBackend: isNeonConfigured() ? 'neon-postgres' : 'local-fallback',
        automationRunsTracked: runs.length,
        timestamp: new Date().toISOString(),
      });
    } catch {
      res.status(503).json({ status: 'NOT_READY' });
    }
  });

  app.get('/openapi.json', (req: Request, res: Response) => {
    res.json(buildOpenApiSpec(resolvePublicBaseUrl(req)));
  });

  app.get('/robots.txt', (req: Request, res: Response) => {
    res.type('text/plain; charset=utf-8').send(buildRobotsTxt(resolvePublicBaseUrl(req)));
  });

  app.get('/sitemap.xml', (req: Request, res: Response) => {
    res.type('application/xml; charset=utf-8').send(buildSitemapXml(resolvePublicBaseUrl(req)));
  });

  app.use('/api', (_req: Request, res: Response) => {
    res.status(404).json({ error: 'API endpoint not found.' });
  });

  return app;
}
