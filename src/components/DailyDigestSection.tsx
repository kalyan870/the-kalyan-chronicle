import { RefreshCw, ExternalLink } from 'lucide-react';
import type { CommitEntry, ProjectDispatch, SubstackPost } from '../data/chronicleData';
import { SectionQRCode } from './SectionQRCode';
import { NewspaperImage } from './NewspaperImage';
import { toSafeExternalHref } from '../utils/safeUrl';

export interface RepoItem {
  name: string;
  description: string;
  language: string;
  stars: number;
  updatedAt: string;
  url: string;
}

export interface DigestState {
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
  repos: RepoItem[];
  latestProjects?: ProjectDispatch[];
  commits: CommitEntry[];
  substackPosts: SubstackPost[];
}

interface DailyDigestSectionProps {
  digest: DigestState | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}

export function DailyDigestSection({
  digest,
  loading,
  error,
  onRefresh,
}: DailyDigestSectionProps) {
  const commits = digest?.commits ?? [];
  const posts = digest?.substackPosts ?? [];
  const repos = digest?.repos ?? [];

  return (
    <section id="daily-digest" className="py-8 border-b border-[var(--color-rule-strong)]">
      <div className="flex flex-wrap items-end justify-between gap-4 pb-4 border-b border-[var(--color-rule)]">
        <div>
          <p className="text-xs uppercase tracking-widest text-[var(--color-press-red)] font-medium">
            Section II · Daily Engineering Wire
          </p>
          <h2 className="font-display text-3xl font-bold text-[var(--color-ink)] mt-1">
            Daily Workflow Digest: Commits, Substack & Architecture Spotlight
          </h2>
        </div>

        <div className="no-print flex flex-wrap items-center gap-4">
          <span className="text-xs text-[var(--color-ink-muted)] font-mono tabular-nums">
            {digest
              ? `GitHub: ${digest.githubSource === 'live' ? 'Live API' : 'Archive'} · Substack: ${
                  digest.substackSource === 'live' ? 'Live RSS' : 'Archive'
                }`
              : 'Connecting feeds'}
          </span>
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="inline-flex items-center gap-2 border border-[var(--color-rule-strong)] bg-[var(--color-paper-surface)] px-3.5 py-2 text-xs font-medium text-[var(--color-ink)] hover:bg-[var(--color-paper-alt)] disabled:opacity-60 transition-colors cursor-pointer whitespace-nowrap"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
            <span>{loading ? 'Syncing Feeds…' : 'Sync Live Wire'}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-4 border border-[var(--color-press-red)] bg-[var(--color-paper-surface)] p-3 text-xs text-[var(--color-press-red)]">
          Feed notice: {error}. Displaying verified archival dispatches below.
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Column 1: GitHub Commits & Repo Wire */}
        <div className="lg:col-span-4 lg:pr-6 lg:border-r border-[var(--color-rule)] space-y-5">
          <div>
            <h3 className="font-display text-xl font-bold text-[var(--color-ink)]">
              GitHub Commit & Repo Wire
            </h3>
            <p className="text-xs text-[var(--color-ink-muted)] mt-1">
              Recent activity from github.com/{digest?.profile.login || 'kalyan870'} ({digest?.profile.publicRepos ?? 54} public repositories)
            </p>
          </div>

          <div className="divide-y divide-[var(--color-rule)] border-t border-b border-[var(--color-rule)]">
            {commits.slice(0, 5).map((commit, idx) => (
              <div key={`${commit.sha}-${idx}`} className="py-3 space-y-1">
                <div className="flex items-center justify-between gap-2 text-xs font-mono text-[var(--color-ink-muted)] tabular-nums">
                  <span className="text-[var(--color-press-red)] font-medium">{commit.sha}</span>
                  <span>{commit.date}</span>
                </div>
                <p className="text-sm font-medium text-[var(--color-ink)] leading-snug">
                  {commit.message}
                </p>
                <a
                  href={toSafeExternalHref(commit.url, 'https://github.com/kalyan870')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-[var(--color-ink-muted)] hover:text-[var(--color-press-red)] underline underline-offset-2"
                >
                  <span>{commit.repo}</span>
                  <ExternalLink className="h-3 w-3" aria-hidden="true" />
                </a>
              </div>
            ))}
          </div>

          <div>
            <h4 className="text-xs uppercase tracking-wider font-semibold text-[var(--color-ink)] mb-2">
              Active Repositories
            </h4>
            <ul className="space-y-2.5 text-xs">
              {repos.slice(0, 4).map((repo) => (
                <li key={repo.name} className="border-b border-[var(--color-rule)] pb-2 last:border-b-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <a
                      href={toSafeExternalHref(repo.url, 'https://github.com/kalyan870')}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-[var(--color-ink)] hover:text-[var(--color-press-red)] underline underline-offset-2"
                    >
                      {repo.name}
                    </a>
                    <span className="font-mono text-[11px] text-[var(--color-ink-muted)] shrink-0">
                      {repo.language} · {repo.updatedAt}
                    </span>
                  </div>
                  <p className="text-[var(--color-ink-muted)] mt-0.5 line-clamp-2">
                    {repo.description}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Column 2: Substack Dispatches */}
        <div className="lg:col-span-4 lg:pr-6 lg:border-r border-[var(--color-rule)] space-y-5">
          <div>
            <h3 className="font-display text-xl font-bold text-[var(--color-ink)]">
              The Substack Column
            </h3>
            <p className="text-xs text-[var(--color-ink-muted)] mt-1">
              Long-form essays & technical notes from saragadamkalyan.substack.com
            </p>
          </div>

          <div className="divide-y divide-[var(--color-rule)] border-t border-b border-[var(--color-rule)]">
            {posts.map((post, idx) => (
              <article key={`${post.title}-${idx}`} className="py-4 space-y-1.5">
                <div className="flex items-center gap-2 text-xs text-[var(--color-ink-subtle)] font-mono">
                  <span>{post.publishedAt}</span>
                  <span aria-hidden="true">·</span>
                  <span>{post.source === 'live' ? 'RSS Live' : 'Curated Note'}</span>
                </div>
                <h4 className="font-display text-lg font-bold leading-snug text-[var(--color-ink)]">
                  <a
                    href={toSafeExternalHref(post.link, 'https://saragadamkalyan.substack.com/')}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-[var(--color-press-red)] transition-colors"
                  >
                    {post.title}
                  </a>
                </h4>
                <p className="text-sm text-[var(--color-ink-muted)] leading-relaxed">
                  {post.excerpt}
                </p>
              </article>
            ))}
          </div>

          <div className="bg-[var(--color-paper-alt)] p-4 border border-[var(--color-rule)] print-avoid-break">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-ink)]">
              Compounding Growth Effect
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-[var(--color-ink)]">
              Publishing architectural trade-offs on Substack right after shipping GitHub milestones eliminates stale documentation. New collaborators grasp system intent in minutes, while your public portfolio stays perpetually current without quarterly rewrites.
            </p>
          </div>
        </div>

        {/* Column 3: Key Technical Challenge & Solution */}
        <div className="lg:col-span-4 space-y-4 print-avoid-break">
          <div>
            <p className="text-xs uppercase tracking-wider text-[var(--color-press-red)] font-medium">
              Technical Challenge & Solution
            </p>
            <h3 className="font-display text-xl font-bold text-[var(--color-ink)] mt-1">
              Real-Time Telemetry, Serverless Routing & Hybrid RAG Latency
            </h3>
          </div>

          <figure>
            <NewspaperImage
              src="/assets/aistudio/file_0000000030988246b127bb6b496cb00f_4f2dde0c.png"
              alt="Saragadam Kalyan reviewing the Environmental Risk and Safety Dashboard on laptop"
              aspectClass="aspect-[4/4]"
              imgClassName="object-cover object-top"
              caption="Fig. 2 — Demonstrating the Environmental Risk & Safety Dashboard: unifying live geospatial telemetry, 7-day trend modeling, and serverless API endpoints."
            />
          </figure>

          <div className="space-y-3 text-sm leading-relaxed text-[var(--color-ink)]">
            <p>
              <strong>The Challenge:</strong> Shipping full-stack telemetry apps (like the Environmental Risk &amp; Safety Dashboard and InterviewIQ AI) across both long-running Express servers and stateless deployments creates route drift—especially when guarding <span className="font-mono text-xs">GEMINI_API_KEY</span>, server sessions, and object storage access.
            </p>
            <p>
              <strong>The Solution:</strong> Centralizing Express logic inside <span className="font-mono text-xs">src/server/createApp.ts</span>, re-exporting it through <span className="font-mono text-xs">api/index.ts</span> for Vercel while mounting Vite locally in <span className="font-mono text-xs">server.ts</span>, and pairing lexical + vector RAG with reranking.
            </p>
            <p className="text-xs text-[var(--color-ink-muted)] border-t border-[var(--color-rule)] pt-2">
              Result: Zero duplicated backend endpoints, strict server-side key isolation, and predictable sub-second dashboard & retrieval precision.
            </p>
          </div>
        </div>
      </div>

      <SectionQRCode
        url="https://github.com/kalyan870/Real-Time-Environmental-Risk-Safety-Dashboard"
        label="Repository QR"
        sublabel="Environmental Risk & Safety Repo"
        caption="Direct Repository Dispatch · Environmental Risk & Safety Dashboard source tree and telemetry endpoints."
      />
    </section>
  );
}
