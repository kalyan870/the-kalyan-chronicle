import { useEffect, useState } from 'react';
import {
  Activity,
  ArrowUpRight,
  FileCode2,
  GitPullRequest,
  Radio,
  Terminal,
} from 'lucide-react';

export type WorkbenchSectionTab = 'trace' | 'eval' | 'local-code' | 'protocol';

interface WorkbenchShowcaseSectionProps {
  onOpenTool: (tab: WorkbenchSectionTab) => void;
}

const WORKBENCH_CARDS: Array<{
  tab: WorkbenchSectionTab;
  title: string;
  kicker: string;
  summary: string;
  actionLabel: string;
  icon: typeof Activity;
}> = [
  {
    tab: 'trace',
    title: 'Trace & Silent-Failure Debugger',
    kicker: 'Observability · OTel Span Audit',
    summary:
      'Detects HTTP 200 empty-context tool failures, context starvation, latency spikes, and span token costs.',
    actionLabel: 'Inspect Traces',
    icon: Activity,
  },
  {
    tab: 'eval',
    title: 'PR Eval Regression Matrix',
    kicker: 'CI/CD Quality · Golden Dataset Diff',
    summary:
      'Compares baseline vs. candidate retrieval recall across golden questions and generates PR Markdown diffs.',
    actionLabel: 'Run PR Evals',
    icon: GitPullRequest,
  },
  {
    tab: 'local-code',
    title: 'Zero-Server Code Search',
    kicker: 'Browser-Local · Offline Spec Indexing',
    summary:
      'Chunks and ranks source specs or README docs entirely in browser memory with zero network payload.',
    actionLabel: 'Search Locally',
    icon: FileCode2,
  },
  {
    tab: 'protocol',
    title: 'MCP, A2A & Feeds Inspector',
    kicker: '2026 Agent Protocols · Live JSON-RPC & SSE',
    summary:
      'Invoke hosted JSON-RPC 2.0 MCP tools, stream A2A responses, and inspect OpenAPI 3.1 and discovery specs.',
    actionLabel: 'Open Inspector',
    icon: Terminal,
  },
];

const PUBLIC_DISCOVERY_LINKS = [
  { label: 'Agent Card (A2A)', href: '/.well-known/agent-card.json' },
  { label: 'llms.txt', href: '/llms.txt' },
  { label: 'MCP Manifest', href: '/api/mcp' },
  { label: 'OpenAPI 3.1', href: '/openapi.json' },
  { label: 'JSON Feed 1.1', href: '/feed.json' },
  { label: 'RSS 2.0', href: '/rss.xml' },
  { label: 'Broadsheet OG Card', href: '/api/og' },
  { label: 'Readiness Probe', href: '/healthz/ready' },
];

export function WorkbenchShowcaseSection({ onOpenTool }: WorkbenchShowcaseSectionProps) {
  const [readiness, setReadiness] = useState<{ status: string; runs: number } | null>(null);

  useEffect(() => {
    let mounted = true;
    fetch('/healthz/ready')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { status?: string; automationRunsTracked?: number } | null) => {
        if (mounted && data?.status) {
          setReadiness({
            status: data.status,
            runs: Number(data.automationRunsTracked ?? 0),
          });
        }
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <section
      id="workbench-desk"
      className="no-print py-8 border-b border-[var(--color-rule-strong)] space-y-5"
    >
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--color-rule)] pb-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-[var(--color-press-red)] font-medium">
            Section IV-B · Interactive Engineering Workbench &amp; Open Standards
          </p>
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-[var(--color-ink)] mt-0.5">
            Live AI Systems Lab, Trace Auditing &amp; Machine-Readable Endpoints
          </h2>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs border border-[var(--color-rule)] bg-[var(--color-paper-surface)] px-3 py-1.5">
          <Radio className="h-3.5 w-3.5 text-emerald-700" aria-hidden="true" />
          <span>
            Press Gateway: <strong>{readiness?.status || 'READY'}</strong>
            {readiness ? ` · ${readiness.runs} synced runs` : ''}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {WORKBENCH_CARDS.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.tab}
              className="border border-[var(--color-rule-strong)] bg-[var(--color-paper-surface)] p-4 flex flex-col justify-between gap-3"
            >
              <div className="space-y-1.5">
                <p className="text-[11px] font-mono text-[var(--color-press-red)] font-semibold">
                  {card.kicker}
                </p>
                <h3 className="font-display text-lg font-bold text-[var(--color-ink)] flex items-start gap-2">
                  <Icon className="h-4 w-4 text-[var(--color-press-red)] shrink-0 mt-1" aria-hidden="true" />
                  <span>{card.title}</span>
                </h3>
                <p className="text-xs leading-relaxed text-[var(--color-ink-muted)]">
                  {card.summary}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onOpenTool(card.tab)}
                className="w-full inline-flex items-center justify-center gap-1.5 border border-[var(--color-rule-strong)] bg-[var(--color-paper)] px-3 py-2 text-xs font-medium text-[var(--color-ink)] hover:bg-[var(--color-press-red)] hover:text-[#FCF9F5] hover:border-[var(--color-press-red)] transition-colors cursor-pointer"
              >
                <span>{card.actionLabel}</span>
                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>

      <div className="border border-[var(--color-rule)] bg-[var(--color-paper-surface)] px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
        <span className="font-mono uppercase tracking-wider text-[11px] text-[var(--color-ink-muted)] font-semibold">
          Open 2026 Web &amp; Agent Discovery:
        </span>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 font-mono text-[11px]">
          {PUBLIC_DISCOVERY_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-0.5 underline decoration-[var(--color-rule)] underline-offset-4 text-[var(--color-ink)] hover:text-[var(--color-press-red)]"
            >
              <span>{link.label}</span>
              <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
