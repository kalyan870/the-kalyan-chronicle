import { useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  FileCode2,
  GitPullRequest,
  Play,
  Search,
  Terminal,
  X,
} from 'lucide-react';

interface DevWorkbenchModalProps {
  open: boolean;
  initialTab?: WorkbenchTab;
  onClose: () => void;
}

type WorkbenchTab = 'trace' | 'eval' | 'local-code' | 'protocol';

interface TraceSpanPreset {
  id: string;
  name: string;
  kind: 'retrieval' | 'tool' | 'llm' | 'guardrail';
  httpStatus?: number;
  status?: 'ok' | 'error';
  durationMs: number;
  inputTokens?: number;
  outputTokens?: number;
  itemsReturned?: number;
  outputSummary?: string;
}

interface TraceAuditResult {
  traceId: string;
  spanCount: number;
  totalDurationMs: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  estimatedCostUsd: number;
  healthScore: number;
  verdict: string;
  findings: Array<{
    spanId: string;
    spanName: string;
    severity: string;
    category: string;
    detail: string;
    remediation: string;
  }>;
  normalizedSpans: Array<TraceSpanPreset & { silentFailure: boolean }>;
}

interface EvalMatrixResult {
  evaluatedAt: string;
  baselineLabel: string;
  candidateLabel: string;
  totalCases: number;
  baselineAvgRecall: number;
  candidateAvgRecall: number;
  recallDeltaPct: number;
  baselineLatencyMs: number;
  candidateLatencyMs: number;
  markdownDiffReport: string;
  cases: Array<{
    id: string;
    question: string;
    baselineRecallPct: number;
    candidateRecallPct: number;
    deltaPct: number;
    matchedTerms: string[];
    topSources: string[];
    passed: boolean;
  }>;
}

const SILENT_FAILURE_TRACE: TraceSpanPreset[] = [
  {
    id: 'sp_guard_1',
    name: 'input-safety-validation',
    kind: 'guardrail',
    httpStatus: 200,
    status: 'ok',
    durationMs: 12,
    outputSummary: 'clean',
  },
  {
    id: 'sp_ret_1',
    name: 'hybrid-vector-retriever',
    kind: 'retrieval',
    httpStatus: 200,
    status: 'ok',
    durationMs: 420,
    itemsReturned: 0,
    outputSummary: '[]',
  },
  {
    id: 'sp_llm_1',
    name: 'synthesis-model-answer',
    kind: 'llm',
    httpStatus: 200,
    status: 'ok',
    durationMs: 2840,
    inputTokens: 1120,
    outputTokens: 340,
    outputSummary: 'Generated confident answer without context chunks',
  },
];

const HEALTHY_TRACE: TraceSpanPreset[] = [
  {
    id: 'sp_guard_ok',
    name: 'input-safety-validation',
    kind: 'guardrail',
    httpStatus: 200,
    status: 'ok',
    durationMs: 8,
    outputSummary: 'clean',
  },
  {
    id: 'sp_ret_ok',
    name: 'hybrid-bm25-vector-rrf',
    kind: 'retrieval',
    httpStatus: 200,
    status: 'ok',
    durationMs: 84,
    itemsReturned: 4,
    outputSummary: '4 ranked citations returned',
  },
  {
    id: 'sp_llm_ok',
    name: 'grounded-synthesis',
    kind: 'llm',
    httpStatus: 200,
    status: 'ok',
    durationMs: 610,
    inputTokens: 1480,
    outputTokens: 165,
    outputSummary: 'Grounded 3-sentence response with inline citations',
  },
];

const DEFAULT_EVAL_CASES = [
  {
    id: 'E-01',
    question: 'What stack powers InterviewIQ AI and voice evaluation?',
    expectedTerms: ['InterviewIQ AI', 'TypeScript', 'Voice'],
  },
  {
    id: 'E-02',
    question: 'How does Enterprise RAG avoid blind spots on identifiers?',
    expectedTerms: ['Hybrid Search', 'Reranking', 'FastAPI'],
  },
  {
    id: 'E-03',
    question: 'How does the safety dashboard track AQI and rain radar?',
    expectedTerms: ['Windy', 'AQI', 'PM2.5'],
  },
  {
    id: 'E-04',
    question: 'Which computer vision pipelines handle facial emotion vision?',
    expectedTerms: ['MediaPipe', 'PCA', 'Streamlit'],
  },
];

const SAMPLE_LOCAL_SOURCE = `# Hybrid RAG & Chronicle Retrieval Module
export function rankHybridChunks(queryTokens: string[], chunks: Array<{ id: string; text: string }>) {
  // Combines exact identifier matches with semantic synonyms using reciprocal scoring
  return chunks
    .map((chunk) => {
      const hay = chunk.text.toLowerCase();
      const hits = queryTokens.filter((tok) => hay.includes(tok)).length;
      return { id: chunk.id, score: hits / Math.max(1, queryTokens.length) };
    })
    .sort((a, b) => b.score - a.score);
}

# Environment & Security Checklist
1. Reject path traversal ("..", leading slash) on object storage keys.
2. Verify signed RS256 and HMAC unsubscribe tokens using timingSafeEqual.
3. Gate write mutations behind authenticated user sessions in production.

# Daily Press Scheduler
Runs at 07:00 UTC to sync GitHub repositories, Substack essays, and package audits.`;

interface LocalChunkHit {
  index: number;
  heading: string;
  snippet: string;
  score: number;
  matchedTokens: string[];
}

export function DevWorkbenchModal({ open, initialTab = 'trace', onClose }: DevWorkbenchModalProps) {
  const [activeTab, setActiveTab] = useState<WorkbenchTab>(initialTab);

  useEffect(() => {
    if (open) {
      setActiveTab(initialTab);
    }
  }, [open, initialTab]);

  // Tab 1: Trace Debugger
  const [traceJsonText, setTraceJsonText] = useState<string>(() =>
    JSON.stringify({ traceId: 'tr_silent_rag_demo', spans: SILENT_FAILURE_TRACE }, null, 2)
  );
  const [traceResult, setTraceResult] = useState<TraceAuditResult | null>(null);
  const [traceLoading, setTraceLoading] = useState<boolean>(false);
  const [traceError, setTraceError] = useState<string | null>(null);

  // Tab 2: PR Eval Matrix
  const [baselineTopK, setBaselineTopK] = useState<number>(1);
  const [candidateTopK, setCandidateTopK] = useState<number>(4);
  const [expandSynonyms, setExpandSynonyms] = useState<boolean>(true);
  const [evalResult, setEvalResult] = useState<EvalMatrixResult | null>(null);
  const [evalLoading, setEvalLoading] = useState<boolean>(false);
  const [evalError, setEvalError] = useState<string | null>(null);
  const [copiedDiff, setCopiedDiff] = useState<boolean>(false);

  // Tab 3: Local Client-Side Code Search
  const [localDocText, setLocalDocText] = useState<string>(SAMPLE_LOCAL_SOURCE);
  const [localQuery, setLocalQuery] = useState<string>('timingSafeEqual traversal security');
  const [localHits, setLocalHits] = useState<LocalChunkHit[]>([]);

  // Tab 4: Protocol / MCP & Feeds Inspector
  const [mcpToolName, setMcpToolName] = useState<string>('list_projects');
  const [mcpArgsText, setMcpArgsText] = useState<string>(
    JSON.stringify({ keyword: 'RAG', highlightedOnly: true }, null, 2)
  );
  const [mcpResponseText, setMcpResponseText] = useState<string>('');
  const [mcpLoading, setMcpLoading] = useState<boolean>(false);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    // Run local client-side search immediately on text/query change
    const blocks = localDocText
      .split(/\n{2,}|(?=^# )/m)
      .map((b) => b.trim())
      .filter(Boolean);
    const tokens = localQuery
      .toLowerCase()
      .replace(/[^a-z0-9_.-]+/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length >= 2);

    const scored: LocalChunkHit[] = blocks
      .map((block, idx) => {
        const lower = block.toLowerCase();
        const firstLine = block.split('\n')[0].replace(/^#+\s*/, '').slice(0, 70);
        const matched = tokens.filter((t) => lower.includes(t));
        const tf = matched.length / Math.max(1, tokens.length);
        return {
          index: idx + 1,
          heading: firstLine || `Chunk #${idx + 1}`,
          snippet: block,
          score: Number((tf * 100).toFixed(1)),
          matchedTokens: matched,
        };
      })
      .sort((a, b) => b.score - a.score);

    setLocalHits(scored);
  }, [open, localDocText, localQuery]);

  async function handleRunTraceAudit(customPayload?: { traceId: string; spans: TraceSpanPreset[] }) {
    setTraceLoading(true);
    setTraceError(null);
    try {
      const payload = customPayload ?? JSON.parse(traceJsonText);
      const res = await fetch('/api/workbench/trace-audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { report?: TraceAuditResult; error?: string };
      if (!res.ok || !data.report) {
        setTraceError(data.error || 'Unable to inspect trace payload.');
      } else {
        setTraceResult(data.report);
      }
    } catch {
      setTraceError('Invalid JSON trace payload. Expecting { "traceId": "...", "spans": [...] }.');
    } finally {
      setTraceLoading(false);
    }
  }

  async function handleRunEvalMatrix() {
    setEvalLoading(true);
    setEvalError(null);
    setCopiedDiff(false);
    try {
      const res = await fetch('/api/workbench/eval-matrix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baselineLabel: `main (k=${baselineTopK}, exact)`,
          candidateLabel: `pr-branch (k=${candidateTopK}, ${expandSynonyms ? 'hybrid+syn' : 'exact'})`,
          baselineTopK,
          candidateTopK,
          candidateExpandSynonyms: expandSynonyms,
          cases: DEFAULT_EVAL_CASES,
        }),
      });
      const data = (await res.json()) as { report?: EvalMatrixResult; error?: string };
      if (!res.ok || !data.report) {
        setEvalError(data.error || 'Unable to execute eval matrix.');
      } else {
        setEvalResult(data.report);
      }
    } catch {
      setEvalError('Eval server unreachable right now.');
    } finally {
      setEvalLoading(false);
    }
  }

  async function handleCopyMarkdownDiff() {
    if (!evalResult?.markdownDiffReport) return;
    try {
      await navigator.clipboard.writeText(evalResult.markdownDiffReport);
      setCopiedDiff(true);
      setTimeout(() => setCopiedDiff(false), 2200);
    } catch {
      // Ignore clipboard failures
    }
  }

  async function handleInvokeMcpTool() {
    setMcpLoading(true);
    try {
      const parsedArgs = mcpArgsText.trim() ? JSON.parse(mcpArgsText) : {};
      const res = await fetch('/api/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: `ui_${Date.now()}`,
          method: 'tools/call',
          params: {
            name: mcpToolName,
            arguments: parsedArgs,
          },
        }),
      });
      const json = await res.json();
      setMcpResponseText(JSON.stringify(json, null, 2));
    } catch {
      setMcpResponseText(JSON.stringify({ error: 'Invalid JSON arguments or network failure.' }, null, 2));
    } finally {
      setMcpLoading(false);
    }
  }

  function selectPresetTool(tool: string) {
    setMcpToolName(tool);
    if (tool === 'get_engineer_profile') {
      setMcpArgsText('{}');
    } else if (tool === 'list_projects') {
      setMcpArgsText(JSON.stringify({ keyword: 'RAG', highlightedOnly: true }, null, 2));
    } else if (tool === 'search_chronicle_rag') {
      setMcpArgsText(JSON.stringify({ query: 'What stack powers InterviewIQ AI?' }, null, 2));
    } else if (tool === 'list_archived_editions') {
      setMcpArgsText(JSON.stringify({ limit: 5 }, null, 2));
    }
  }

  async function handleTestA2aStream() {
    setMcpLoading(true);
    setMcpResponseText('// Opening A2A SSE stream (/a2a/v1 method="message/stream")...\n');
    try {
      const res = await fetch('/a2a/v1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: `a2a_${Date.now()}`,
          method: 'message/stream',
          params: {
            message: {
              parts: [{ kind: 'text', text: 'Summarize InterviewIQ AI and Enterprise Hybrid RAG.' }],
            },
          },
        }),
      });
      if (!res.body) {
        setMcpResponseText(JSON.stringify(await res.json(), null, 2));
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setMcpResponseText(accumulated);
      }
    } catch {
      setMcpResponseText('// Unable to reach A2A SSE gateway.');
    } finally {
      setMcpLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="no-print fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-3 sm:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Engineering Press Workbench"
    >
      <div className="w-full max-w-5xl border-2 border-[var(--color-rule-strong)] bg-[var(--color-paper)] text-[var(--color-ink)] shadow-2xl my-auto max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="border-b border-[var(--color-rule-strong)] bg-[var(--color-paper-surface)] px-5 py-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-mono uppercase tracking-[0.18em] text-[var(--color-press-red)] font-semibold">
              Interactive Developer Tools · Part II Companion Lab
            </p>
            <h2 className="font-display text-2xl font-bold text-[var(--color-ink)]">
              The Engineering Press Workbench
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close workbench"
            className="border border-[var(--color-rule-strong)] bg-[var(--color-paper)] p-1.5 text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] cursor-pointer"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Navigation tabs */}
        <div className="border-b border-[var(--color-rule)] bg-[var(--color-paper-alt)] px-4 sm:px-5 flex flex-wrap gap-1 pt-2">
          <button
            type="button"
            onClick={() => setActiveTab('trace')}
            className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-t border-x transition-colors cursor-pointer ${
              activeTab === 'trace'
                ? 'border-[var(--color-rule-strong)] bg-[var(--color-paper)] text-[var(--color-press-red)] -mb-px pb-2.5'
                : 'border-transparent text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]'
            }`}
          >
            <Activity className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Trace &amp; Silent-Failure Debugger</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('eval')}
            className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-t border-x transition-colors cursor-pointer ${
              activeTab === 'eval'
                ? 'border-[var(--color-rule-strong)] bg-[var(--color-paper)] text-[var(--color-press-red)] -mb-px pb-2.5'
                : 'border-transparent text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]'
            }`}
          >
            <GitPullRequest className="h-3.5 w-3.5" aria-hidden="true" />
            <span>PR Eval Matrix</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('local-code')}
            className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-t border-x transition-colors cursor-pointer ${
              activeTab === 'local-code'
                ? 'border-[var(--color-rule-strong)] bg-[var(--color-paper)] text-[var(--color-press-red)] -mb-px pb-2.5'
                : 'border-transparent text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]'
            }`}
          >
            <FileCode2 className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Zero-Server Code Search</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('protocol')}
            className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-t border-x transition-colors cursor-pointer ${
              activeTab === 'protocol'
                ? 'border-[var(--color-rule-strong)] bg-[var(--color-paper)] text-[var(--color-press-red)] -mb-px pb-2.5'
                : 'border-transparent text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]'
            }`}
          >
            <Terminal className="h-3.5 w-3.5" aria-hidden="true" />
            <span>MCP &amp; Feeds Inspector</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {activeTab === 'trace' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-[var(--color-ink-muted)] max-w-2xl">
                  Inspect multi-step RAG &amp; agent spans to catch HTTP 200 silent tool failures,
                  context starvation, and latency bottlenecks before bad answers reach users.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const sample = { traceId: 'tr_silent_rag_demo', spans: SILENT_FAILURE_TRACE };
                      setTraceJsonText(JSON.stringify(sample, null, 2));
                      void handleRunTraceAudit(sample);
                    }}
                    className="border border-[var(--color-rule)] bg-[var(--color-paper-surface)] px-2.5 py-1.5 text-xs hover:border-[var(--color-press-red)] cursor-pointer"
                  >
                    Load Silent-Failure Trace
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const sample = { traceId: 'tr_healthy_hybrid_rag', spans: HEALTHY_TRACE };
                      setTraceJsonText(JSON.stringify(sample, null, 2));
                      void handleRunTraceAudit(sample);
                    }}
                    className="border border-[var(--color-rule)] bg-[var(--color-paper-surface)] px-2.5 py-1.5 text-xs hover:border-[var(--color-rule-strong)] cursor-pointer"
                  >
                    Load Healthy Trace
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleRunTraceAudit()}
                    disabled={traceLoading}
                    className="inline-flex items-center gap-1.5 bg-[var(--color-press-red)] px-3.5 py-1.5 text-xs font-medium text-[#FCF9F5] hover:bg-[#701D16] disabled:opacity-60 cursor-pointer"
                  >
                    <Play className="h-3 w-3" aria-hidden="true" />
                    <span>{traceLoading ? 'Auditing…' : 'Run Trace Audit'}</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-mono uppercase tracking-wider text-[var(--color-ink-muted)]">
                    Trace Span Payload (JSON)
                  </label>
                  <textarea
                    value={traceJsonText}
                    onChange={(e) => setTraceJsonText(e.target.value)}
                    rows={12}
                    spellCheck={false}
                    className="w-full border border-[var(--color-rule-strong)] bg-[var(--color-paper-surface)] p-3 font-mono text-[11px] text-[var(--color-ink)] focus:outline-2 focus:outline-[var(--color-press-red)]"
                  />
                </div>

                <div className="border border-[var(--color-rule)] bg-[var(--color-paper-surface)] p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-[var(--color-rule)] pb-2">
                    <span className="text-[11px] font-mono uppercase tracking-wider text-[var(--color-ink-muted)]">
                      Diagnostic Report
                    </span>
                    {traceResult && (
                      <span
                        className={`text-xs font-mono font-semibold ${
                          traceResult.healthScore >= 80
                            ? 'text-emerald-800'
                            : 'text-[var(--color-press-red)]'
                        }`}
                      >
                        Score {traceResult.healthScore}/100 · {traceResult.verdict}
                      </span>
                    )}
                  </div>

                  {traceError && (
                    <p className="text-xs text-[var(--color-press-red)]">{traceError}</p>
                  )}

                  {!traceResult && !traceError && (
                    <p className="text-xs text-[var(--color-ink-muted)]">
                      Click <strong>Run Trace Audit</strong> or load a sample trace to analyze span latency,
                      token cost attribution, and silent failure conditions.
                    </p>
                  )}

                  {traceResult && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-3 gap-2 text-xs font-mono border-b border-[var(--color-rule)] pb-2.5">
                        <div>
                          <span className="block text-[10px] text-[var(--color-ink-subtle)]">LATENCY</span>
                          <strong>{traceResult.totalDurationMs} ms</strong>
                        </div>
                        <div>
                          <span className="block text-[10px] text-[var(--color-ink-subtle)]">TOKENS</span>
                          <strong>
                            {traceResult.totalInputTokens}+{traceResult.totalOutputTokens}
                          </strong>
                        </div>
                        <div>
                          <span className="block text-[10px] text-[var(--color-ink-subtle)]">EST. COST</span>
                          <strong>${traceResult.estimatedCostUsd.toFixed(5)}</strong>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        {traceResult.normalizedSpans.map((sp) => (
                          <div
                            key={sp.id}
                            className={`flex items-center justify-between gap-2 px-2.5 py-1.5 text-xs border ${
                              sp.silentFailure
                                ? 'border-[var(--color-press-red)] bg-[#fdf3f2]'
                                : 'border-[var(--color-rule)] bg-[var(--color-paper)]'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              {sp.silentFailure ? (
                                <AlertTriangle
                                  className="h-3.5 w-3.5 text-[var(--color-press-red)] shrink-0"
                                  aria-hidden="true"
                                />
                              ) : (
                                <CheckCircle2
                                  className="h-3.5 w-3.5 text-emerald-700 shrink-0"
                                  aria-hidden="true"
                                />
                              )}
                              <span className="font-mono truncate">{sp.name}</span>
                            </div>
                            <span className="font-mono text-[11px] text-[var(--color-ink-muted)] shrink-0">
                              {sp.kind} · {sp.durationMs}ms
                            </span>
                          </div>
                        ))}
                      </div>

                      {traceResult.findings.length > 0 ? (
                        <div className="space-y-2 pt-1">
                          {traceResult.findings.map((f, idx) => (
                            <div
                              key={`${f.spanId}_${idx}`}
                              className="border-l-2 border-[var(--color-press-red)] pl-2.5 text-xs space-y-0.5"
                            >
                              <p className="font-semibold text-[var(--color-press-red)]">
                                [{f.severity}] {f.category} — {f.spanName}
                              </p>
                              <p className="text-[var(--color-ink)]">{f.detail}</p>
                              <p className="text-[11px] text-[var(--color-ink-muted)]">
                                Fix: {f.remediation}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-emerald-800">
                          Zero silent tool failures or latency breaches detected across all spans.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'eval' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--color-rule)] pb-3">
                <div className="flex flex-wrap items-center gap-4 text-xs">
                  <label className="space-y-1">
                    <span className="block text-[11px] font-mono uppercase text-[var(--color-ink-muted)]">
                      Baseline Top-K
                    </span>
                    <input
                      type="number"
                      min={1}
                      max={6}
                      value={baselineTopK}
                      onChange={(e) => setBaselineTopK(Math.max(1, Math.min(6, Number(e.target.value) || 1)))}
                      className="w-20 border border-[var(--color-rule-strong)] bg-[var(--color-paper-surface)] px-2 py-1 font-mono"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="block text-[11px] font-mono uppercase text-[var(--color-ink-muted)]">
                      PR Candidate Top-K
                    </span>
                    <input
                      type="number"
                      min={1}
                      max={8}
                      value={candidateTopK}
                      onChange={(e) => setCandidateTopK(Math.max(1, Math.min(8, Number(e.target.value) || 4)))}
                      className="w-20 border border-[var(--color-rule-strong)] bg-[var(--color-paper-surface)] px-2 py-1 font-mono"
                    />
                  </label>
                  <label className="inline-flex items-center gap-2 pt-4 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={expandSynonyms}
                      onChange={(e) => setExpandSynonyms(e.target.checked)}
                    />
                    <span>Enable Hybrid Synonym Expansion</span>
                  </label>
                </div>

                <button
                  type="button"
                  onClick={() => void handleRunEvalMatrix()}
                  disabled={evalLoading}
                  className="inline-flex items-center gap-1.5 bg-[var(--color-press-red)] px-4 py-2 text-xs font-medium text-[#FCF9F5] hover:bg-[#701D16] disabled:opacity-60 cursor-pointer"
                >
                  <Play className="h-3 w-3" aria-hidden="true" />
                  <span>{evalLoading ? 'Running Suite…' : 'Run Golden PR Evals'}</span>
                </button>
              </div>

              {evalError && <p className="text-xs text-[var(--color-press-red)]">{evalError}</p>}

              {!evalResult ? (
                <p className="text-xs text-[var(--color-ink-muted)]">
                  Compare retrieval parameters against the curated 4-case engineering golden dataset and
                  generate a copyable PR regression diff report.
                </p>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 border border-[var(--color-rule)] bg-[var(--color-paper-surface)] p-3 text-xs font-mono">
                    <div>
                      <span className="block text-[10px] text-[var(--color-ink-subtle)]">BASELINE AVG RECALL</span>
                      <strong>{evalResult.baselineAvgRecall}%</strong>
                    </div>
                    <div>
                      <span className="block text-[10px] text-[var(--color-ink-subtle)]">CANDIDATE AVG RECALL</span>
                      <strong>
                        {evalResult.candidateAvgRecall}% ({evalResult.recallDeltaPct >= 0 ? `+${evalResult.recallDeltaPct}` : evalResult.recallDeltaPct}%)
                      </strong>
                    </div>
                    <div>
                      <span className="block text-[10px] text-[var(--color-ink-subtle)]">EVAL RUNTIME</span>
                      <strong>{evalResult.candidateLatencyMs} ms</strong>
                    </div>
                  </div>

                  <div className="overflow-x-auto border border-[var(--color-rule)]">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[var(--color-paper-alt)] border-b border-[var(--color-rule)] font-mono text-[11px]">
                        <tr>
                          <th className="p-2.5">Case</th>
                          <th className="p-2.5">Golden Query</th>
                          <th className="p-2.5 text-right">Baseline</th>
                          <th className="p-2.5 text-right">Candidate</th>
                          <th className="p-2.5">Top Matched Sources</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--color-rule)] bg-[var(--color-paper-surface)]">
                        {evalResult.cases.map((c) => (
                          <tr key={c.id}>
                            <td className="p-2.5 font-mono font-semibold">{c.id}</td>
                            <td className="p-2.5">{c.question}</td>
                            <td className="p-2.5 text-right font-mono">{c.baselineRecallPct}%</td>
                            <td className="p-2.5 text-right font-mono font-semibold text-[var(--color-press-red)]">
                              {c.candidateRecallPct}%
                            </td>
                            <td className="p-2.5 text-[11px] text-[var(--color-ink-muted)]">
                              {c.topSources.slice(0, 2).join(', ')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-mono uppercase tracking-wider text-[var(--color-ink-muted)]">
                        GitHub PR Comment Preview (Markdown)
                      </span>
                      <button
                        type="button"
                        onClick={() => void handleCopyMarkdownDiff()}
                        className="inline-flex items-center gap-1 border border-[var(--color-rule)] bg-[var(--color-paper-surface)] px-2.5 py-1 text-xs hover:border-[var(--color-rule-strong)] cursor-pointer"
                      >
                        {copiedDiff ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                        <span>{copiedDiff ? 'Copied Markdown' : 'Copy PR Diff'}</span>
                      </button>
                    </div>
                    <pre className="border border-[var(--color-rule)] bg-[var(--color-paper-surface)] p-3 font-mono text-[11px] overflow-x-auto">
                      {evalResult.markdownDiffReport}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'local-code' && (
            <div className="space-y-4">
              <p className="text-xs text-[var(--color-ink-muted)]">
                100% browser-local chunk indexer — paste private code specs or README notes below and search
                across ranked sections without sending code over any network request.
              </p>

              <div className="relative">
                <Search
                  className="h-3.5 w-3.5 text-[var(--color-ink-subtle)] absolute left-3 top-1/2 -translate-y-1/2"
                  aria-hidden="true"
                />
                <input
                  type="text"
                  value={localQuery}
                  onChange={(e) => setLocalQuery(e.target.value)}
                  placeholder="Query indexed local chunks (e.g. traversal security, hybrid rank)…"
                  className="w-full border border-[var(--color-rule-strong)] bg-[var(--color-paper-surface)] pl-8 pr-3 py-2 text-xs font-mono"
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <span className="block text-[11px] font-mono uppercase text-[var(--color-ink-muted)]">
                    Local Source / Spec Document
                  </span>
                  <textarea
                    value={localDocText}
                    onChange={(e) => setLocalDocText(e.target.value)}
                    rows={11}
                    spellCheck={false}
                    className="w-full border border-[var(--color-rule)] bg-[var(--color-paper-surface)] p-3 font-mono text-[11px]"
                  />
                </div>

                <div className="space-y-2">
                  <span className="block text-[11px] font-mono uppercase text-[var(--color-ink-muted)]">
                    Ranked Browser Chunks ({localHits.length})
                  </span>
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {localHits.map((hit) => (
                      <div
                        key={hit.index}
                        className="border border-[var(--color-rule)] bg-[var(--color-paper-surface)] p-3 space-y-1 text-xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <strong className="font-mono truncate">{hit.heading}</strong>
                          <span className="font-mono text-[11px] text-[var(--color-press-red)] shrink-0">
                            Match {hit.score}%
                          </span>
                        </div>
                        <pre className="whitespace-pre-wrap font-mono text-[11px] text-[var(--color-ink-muted)]">
                          {hit.snippet}
                        </pre>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'protocol' && (
            <div className="space-y-4">
              <div className="border border-[var(--color-rule)] bg-[var(--color-paper-surface)] p-3.5 space-y-2 text-xs">
                <p className="font-mono uppercase tracking-wider text-[11px] text-[var(--color-press-red)] font-semibold">
                  AI Discovery &amp; Syndication Endpoints
                </p>
                <div className="flex flex-wrap gap-3 font-mono text-[11px]">
                  <a href="/.well-known/agent-card.json" target="_blank" rel="noreferrer" className="underline hover:text-[var(--color-press-red)]">
                    /.well-known/agent-card.json (A2A)
                  </a>
                  <a href="/llms.txt" target="_blank" rel="noreferrer" className="underline hover:text-[var(--color-press-red)]">
                    /llms.txt
                  </a>
                  <a href="/openapi.json" target="_blank" rel="noreferrer" className="underline hover:text-[var(--color-press-red)]">
                    /openapi.json (3.1.0)
                  </a>
                  <a href="/feed.json" target="_blank" rel="noreferrer" className="underline hover:text-[var(--color-press-red)]">
                    /feed.json
                  </a>
                  <a href="/rss.xml" target="_blank" rel="noreferrer" className="underline hover:text-[var(--color-press-red)]">
                    /rss.xml
                  </a>
                  <a href="/api/og" target="_blank" rel="noreferrer" className="underline hover:text-[var(--color-press-red)]">
                    /api/og (OG SVG)
                  </a>
                  <a href="/api/mcp" target="_blank" rel="noreferrer" className="underline hover:text-[var(--color-press-red)]">
                    /api/mcp
                  </a>
                  <a href="/healthz/ready" target="_blank" rel="noreferrer" className="underline hover:text-[var(--color-press-red)]">
                    /healthz/ready
                  </a>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      'list_projects',
                      'get_engineer_profile',
                      'search_chronicle_rag',
                      'list_archived_editions',
                    ].map((tool) => (
                      <button
                        key={tool}
                        type="button"
                        onClick={() => selectPresetTool(tool)}
                        className={`px-2.5 py-1 text-[11px] font-mono border cursor-pointer ${
                          mcpToolName === tool
                            ? 'border-[var(--color-press-red)] bg-[var(--color-paper-surface)] text-[var(--color-press-red)] font-semibold'
                            : 'border-[var(--color-rule)] bg-[var(--color-paper)] text-[var(--color-ink-muted)]'
                        }`}
                      >
                        {tool}
                      </button>
                    ))}
                  </div>

                  <textarea
                    value={mcpArgsText}
                    onChange={(e) => setMcpArgsText(e.target.value)}
                    rows={6}
                    spellCheck={false}
                    className="w-full border border-[var(--color-rule-strong)] bg-[var(--color-paper-surface)] p-3 font-mono text-[11px]"
                  />

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void handleInvokeMcpTool()}
                      disabled={mcpLoading}
                      className="inline-flex items-center gap-1.5 bg-[var(--color-press-red)] px-4 py-2 text-xs font-medium text-[#FCF9F5] hover:bg-[#701D16] disabled:opacity-60 cursor-pointer"
                    >
                      <Play className="h-3 w-3" aria-hidden="true" />
                      <span>{mcpLoading ? 'Running…' : 'Invoke /api/mcp Tool'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleTestA2aStream()}
                      disabled={mcpLoading}
                      className="inline-flex items-center gap-1.5 border border-[var(--color-rule-strong)] bg-[var(--color-paper-surface)] px-3.5 py-2 text-xs font-medium text-[var(--color-ink)] hover:bg-[var(--color-paper-alt)] disabled:opacity-60 cursor-pointer"
                    >
                      <Activity className="h-3 w-3 text-[var(--color-press-red)]" aria-hidden="true" />
                      <span>Test A2A SSE Stream</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="block text-[11px] font-mono uppercase text-[var(--color-ink-muted)]">
                    JSON-RPC 2.0 Response
                  </span>
                  <pre className="border border-[var(--color-rule)] bg-[var(--color-paper-surface)] p-3 font-mono text-[11px] max-h-72 overflow-auto">
                    {mcpResponseText || '// Select a tool and click "Invoke /api/mcp Tool" to inspect the live response.'}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
