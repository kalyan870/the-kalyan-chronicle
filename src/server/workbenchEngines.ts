import {
  CAREER_HISTORY,
  FEATURED_PROJECTS,
  VERIFIED_CERTIFICATES,
} from '../data/chronicleData.ts';

export interface TraceSpanInput {
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

export interface TraceFinding {
  spanId: string;
  spanName: string;
  severity: 'Critical' | 'Warning' | 'Advisory';
  category: 'Silent Tool Failure' | 'Context Starvation' | 'Latency Bottleneck' | 'Schema Drift';
  detail: string;
  remediation: string;
}

export interface TraceAuditReport {
  traceId: string;
  spanCount: number;
  totalDurationMs: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  estimatedCostUsd: number;
  healthScore: number;
  verdict: 'Healthy' | 'Degraded — Silent Risk' | 'Failed';
  findings: TraceFinding[];
  normalizedSpans: Array<TraceSpanInput & { silentFailure: boolean }>;
}

export function auditAgentTrace(input: {
  traceId?: string;
  spans: TraceSpanInput[];
}): TraceAuditReport {
  const traceId = input.traceId?.trim() || `trace_${Date.now().toString(36)}`;
  const findings: TraceFinding[] = [];
  let totalDurationMs = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  let retrievalEmpty = false;
  let llmAnsweredAfterEmptyRetrieval = false;

  const normalizedSpans = input.spans.map((span) => {
    totalDurationMs += Math.max(0, Number(span.durationMs) || 0);
    totalInputTokens += Math.max(0, Number(span.inputTokens) || 0);
    totalOutputTokens += Math.max(0, Number(span.outputTokens) || 0);

    let silentFailure = false;
    const summary = (span.outputSummary || '').trim();

    if (
      (span.kind === 'retrieval' || span.kind === 'tool') &&
      (span.httpStatus === undefined || span.httpStatus === 200) &&
      (span.itemsReturned === 0 || /^(null|undefined|\[\]|\{\}|empty)$/i.test(summary))
    ) {
      silentFailure = true;
      if (span.kind === 'retrieval') retrievalEmpty = true;
      findings.push({
        spanId: span.id,
        spanName: span.name,
        severity: 'Critical',
        category: 'Silent Tool Failure',
        detail: `Span returned HTTP ${span.httpStatus ?? 200} with empty context/items (${span.itemsReturned ?? 0} results). Downstream synthesis can hallucinate confidently without failing fast.`,
        remediation:
          'Fail closed or trigger a deterministic BM25/keyword fallback whenever dense retrieval or tool execution yields zero records.',
      });
    }

    if (span.kind === 'llm' && retrievalEmpty && (span.outputTokens ?? 0) > 20) {
      llmAnsweredAfterEmptyRetrieval = true;
      silentFailure = true;
      findings.push({
        spanId: span.id,
        spanName: span.name,
        severity: 'Critical',
        category: 'Context Starvation',
        detail: `LLM generated ${span.outputTokens} output tokens after upstream retrieval returned 0 documents — high probability of ungrounded response.`,
        remediation:
          'Enforce a pre-generation context gate requiring >= 1 grounded chunk before invoking synthesis.',
      });
    }

    if (span.durationMs > 2500) {
      findings.push({
        spanId: span.id,
        spanName: span.name,
        severity: 'Warning',
        category: 'Latency Bottleneck',
        detail: `Span exceeded 2.5s budget (${span.durationMs}ms), degrading Time-To-First-Token.`,
        remediation:
          'Add edge caching, parallel tool dispatch, or a 1.5s circuit-breaker timeout with cached fallback.',
      });
    }

    if (span.status === 'error' || (span.httpStatus !== undefined && span.httpStatus >= 400)) {
      silentFailure = true;
      findings.push({
        spanId: span.id,
        spanName: span.name,
        severity: 'Warning',
        category: 'Schema Drift',
        detail: `Span reported explicit error status (HTTP ${span.httpStatus ?? 500}).`,
        remediation: 'Validate tool inputs/outputs with strict Zod schemas and retry transient 5xx responses once.',
      });
    }

    return { ...span, silentFailure };
  });

  // Standard approximate blended cost ($0.15 / 1M input + $0.60 / 1M output for flash-tier inference)
  const estimatedCostUsd = Number(
    ((totalInputTokens * 0.15 + totalOutputTokens * 0.6) / 1_000_000).toFixed(6)
  );

  const criticalCount = findings.filter((f) => f.severity === 'Critical').length;
  const warningCount = findings.filter((f) => f.severity === 'Warning').length;
  const penalty = criticalCount * 32 + warningCount * 12 + (llmAnsweredAfterEmptyRetrieval ? 10 : 0);
  const healthScore = Math.max(0, 100 - penalty);
  const verdict: TraceAuditReport['verdict'] =
    healthScore >= 80 ? 'Healthy' : healthScore >= 45 ? 'Degraded — Silent Risk' : 'Failed';

  return {
    traceId,
    spanCount: normalizedSpans.length,
    totalDurationMs,
    totalInputTokens,
    totalOutputTokens,
    estimatedCostUsd,
    healthScore,
    verdict,
    findings,
    normalizedSpans,
  };
}

export interface EvalCaseInput {
  id: string;
  question: string;
  expectedTerms: string[];
}

export interface EvalMatrixReport {
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

function buildEvalDocuments(): Array<{ title: string; text: string }> {
  return [
    ...FEATURED_PROJECTS.map((p) => ({
      title: p.title,
      text: `${p.title} ${p.kicker} ${p.summary} ${p.architectureNote} ${p.stack.join(' ')}`,
    })),
    ...CAREER_HISTORY.map((c) => ({
      title: `${c.role} at ${c.company}`,
      text: `${c.role} ${c.company} ${c.period} ${c.location} ${c.focus}`,
    })),
    ...VERIFIED_CERTIFICATES.map((cert) => ({
      title: cert.title,
      text: `${cert.title} ${cert.issuer} ${cert.date} ${cert.code}`,
    })),
  ];
}

export function runRagEvalMatrix(input: {
  baselineLabel: string;
  candidateLabel: string;
  baselineTopK: number;
  candidateTopK: number;
  candidateExpandSynonyms: boolean;
  cases: EvalCaseInput[];
}): EvalMatrixReport {
  const docs = buildEvalDocuments();
  const synonymMap: Record<string, string[]> = {
    rag: ['hybrid', 'bm25', 'reranking', 'enterprise', 'retrieval'],
    voice: ['interviewiq', 'mock', 'rubric', 'resume'],
    aqi: ['environmental', 'windy', 'radar', 'pm2.5', 'safety'],
    vision: ['mediapipe', 'pca', 'ann', 'emotion', 'facerecognition'],
    cert: ['databricks', 'aws', 'anthropic', 'guvi', 'tata', 'forage'],
  };

  function scoreCase(q: string, expectedTerms: string[], topK: number, expand: boolean) {
    const start = performance.now();
    const tokens = q
      .toLowerCase()
      .replace(/[^a-z0-9.+#/-]+/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length >= 2);

    const expanded = new Set(tokens);
    if (expand) {
      for (const tok of tokens) {
        for (const s of synonymMap[tok] || []) expanded.add(s);
      }
    }

    const ranked = docs
      .map((d) => {
        const hay = d.text.toLowerCase();
        const titleLow = d.title.toLowerCase();
        let score = 0;
        for (const t of tokens) {
          if (titleLow.includes(t)) score += 6;
          if (hay.includes(t)) score += 3;
        }
        if (expand) {
          for (const e of expanded) {
            if (!tokens.includes(e) && hay.includes(e)) score += 1.5;
          }
        }
        return { doc: d, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    const retrievedText = ranked.map((r) => r.doc.text.toLowerCase()).join(' ');
    const matchedTerms = expectedTerms.filter((term) => retrievedText.includes(term.toLowerCase()));
    const recallPct =
      expectedTerms.length > 0 ? Math.round((matchedTerms.length / expectedTerms.length) * 100) : 100;
    const elapsed = Math.max(0.2, Number((performance.now() - start).toFixed(2)));
    return {
      recallPct,
      matchedTerms,
      topSources: ranked.map((r) => r.doc.title),
      elapsed,
    };
  }

  let baseSum = 0;
  let candSum = 0;
  let baseLat = 0;
  let candLat = 0;

  const caseResults = input.cases.map((c) => {
    const base = scoreCase(c.question, c.expectedTerms, input.baselineTopK, false);
    const cand = scoreCase(c.question, c.expectedTerms, input.candidateTopK, input.candidateExpandSynonyms);
    baseSum += base.recallPct;
    candSum += cand.recallPct;
    baseLat += base.elapsed;
    candLat += cand.elapsed;
    return {
      id: c.id,
      question: c.question,
      baselineRecallPct: base.recallPct,
      candidateRecallPct: cand.recallPct,
      deltaPct: cand.recallPct - base.recallPct,
      matchedTerms: cand.matchedTerms,
      topSources: cand.topSources,
      passed: cand.recallPct >= 66,
    };
  });

  const count = Math.max(1, caseResults.length);
  const baselineAvgRecall = Math.round(baseSum / count);
  const candidateAvgRecall = Math.round(candSum / count);
  const recallDeltaPct = candidateAvgRecall - baselineAvgRecall;

  const mdRows = caseResults
    .map(
      (r) =>
        `| ${r.id} | ${r.question.slice(0, 44)} | ${r.baselineRecallPct}% | ${r.candidateRecallPct}% | ${r.deltaPct >= 0 ? `+${r.deltaPct}` : r.deltaPct}% | ${r.passed ? 'PASS' : 'WARN'} |`
    )
    .join('\n');

  const markdownDiffReport = [
    `### RAG PR Eval Diff (${input.baselineLabel} vs ${input.candidateLabel})`,
    `- **Avg Context Recall**: ${baselineAvgRecall}% -> **${candidateAvgRecall}%** (${recallDeltaPct >= 0 ? `+${recallDeltaPct}` : recallDeltaPct}%)`,
    `- **Top-K / Expansion**: Baseline k=${input.baselineTopK} vs Candidate k=${input.candidateTopK}, synonyms=${input.candidateExpandSynonyms}`,
    '',
    '| Case | Query | Baseline | Candidate | Delta | Status |',
    '| :--- | :--- | ---: | ---: | ---: | :--- |',
    mdRows,
  ].join('\n');

  return {
    evaluatedAt: new Date().toISOString(),
    baselineLabel: input.baselineLabel,
    candidateLabel: input.candidateLabel,
    totalCases: caseResults.length,
    baselineAvgRecall,
    candidateAvgRecall,
    recallDeltaPct,
    baselineLatencyMs: Number(baseLat.toFixed(2)),
    candidateLatencyMs: Number(candLat.toFixed(2)),
    markdownDiffReport,
    cases: caseResults,
  };
}
