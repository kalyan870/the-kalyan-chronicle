import { useState } from 'react';
import { WORKFLOW_TRANSFORMATIONS, type WorkflowRow } from '../data/chronicleData';
import { SectionQRCode } from './SectionQRCode';
import { NewspaperImage } from './NewspaperImage';

type PerspectiveMode = 'schedule' | 'team' | 'breakdown';

export function WorkflowShiftSection() {
  const [perspective, setPerspective] = useState<PerspectiveMode>('schedule');
  const [selectedRowId, setSelectedRowId] = useState<string>(WORKFLOW_TRANSFORMATIONS[0].id);

  const totalBefore = WORKFLOW_TRANSFORMATIONS.reduce((acc, r) => acc + r.minutesBefore, 0);
  const totalAfter = WORKFLOW_TRANSFORMATIONS.reduce((acc, r) => acc + r.minutesAfter, 0);
  const savedMinutes = totalBefore - totalAfter;
  const savedHours = (savedMinutes / 60).toFixed(1);

  const activeRow: WorkflowRow =
    WORKFLOW_TRANSFORMATIONS.find((row) => row.id === selectedRowId) ?? WORKFLOW_TRANSFORMATIONS[0];

  const WORKFLOW_QR_TARGETS: Record<string, { url: string; label: string; sublabel: string }> = {
    'wf-1': {
      url: 'https://github.com/kalyan870/rag-system',
      label: 'Project Repo QR',
      sublabel: 'Enterprise Hybrid RAG System',
    },
    'wf-2': {
      url: 'https://github.com/kalyan870/kalyanhub',
      label: 'Architecture Repo QR',
      sublabel: 'KalyanHub Full-Stack Source',
    },
    'wf-3': {
      url: 'https://kalyannexus.vercel.app/',
      label: 'Flagship Portfolio QR',
      sublabel: 'KalyanNexus Live System',
    },
    'wf-4': {
      url: 'https://github.com/kalyan870/interviewiq-ai',
      label: 'Project QR',
      sublabel: 'InterviewIQ AI Platform',
    },
    'wf-5': {
      url: 'https://instant-forecast.netlify.app/',
      label: 'Live Project QR',
      sublabel: 'Environmental Risk Dashboard',
    },
    'wf-6': {
      url: 'https://kalyanhub.netlify.app/',
      label: 'Project Portal QR',
      sublabel: 'KalyanHub Live Archive',
    },
  };
  const activeQrTarget = WORKFLOW_QR_TARGETS[activeRow.id] ?? WORKFLOW_QR_TARGETS['wf-4'];

  return (
    <section id="workflow-shift" className="py-8 border-b border-[var(--color-rule-strong)]">
      <div className="flex flex-wrap items-end justify-between gap-4 pb-4 border-b border-[var(--color-rule)]">
        <div>
          <p className="text-xs uppercase tracking-widest text-[var(--color-press-red)] font-medium">
            Section III · Daily Efficiency Ledger
          </p>
          <h2 className="font-display text-3xl font-bold text-[var(--color-ink)] mt-1">
            How It Transforms Your Daily Workflow Efficiency
          </h2>
        </div>

        <div
          role="tablist"
          aria-label="Workflow view perspective"
          className="no-print flex items-center gap-1 bg-[var(--color-paper-alt)] p-1 border border-[var(--color-rule)]"
        >
          <button
            type="button"
            role="tab"
            aria-selected={perspective === 'schedule'}
            onClick={() => setPerspective('schedule')}
            className={`px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
              perspective === 'schedule'
                ? 'bg-[var(--color-paper-surface)] text-[var(--color-ink)] border border-[var(--color-rule)]'
                : 'text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]'
            }`}
          >
            Daily Schedule
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={perspective === 'team'}
            onClick={() => setPerspective('team')}
            className={`px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
              perspective === 'team'
                ? 'bg-[var(--color-paper-surface)] text-[var(--color-ink)] border border-[var(--color-rule)]'
                : 'text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]'
            }`}
          >
            Solo vs. Team
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={perspective === 'breakdown'}
            onClick={() => setPerspective('breakdown')}
            className={`px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
              perspective === 'breakdown'
                ? 'bg-[var(--color-paper-surface)] text-[var(--color-ink)] border border-[var(--color-rule)]'
                : 'text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]'
            }`}
          >
            Hours Reclaimed
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-[var(--color-rule)] border-b border-[var(--color-rule)] py-4">
        <div className="px-4 py-2">
          <p className="text-xs text-[var(--color-ink-muted)]">Legacy Manual Overhead</p>
          <p className="font-mono text-2xl font-semibold tabular-nums text-[var(--color-ink)] mt-1">
            {totalBefore} min/day
          </p>
        </div>
        <div className="px-4 py-2">
          <p className="text-xs text-[var(--color-ink-muted)]">AI-Augmented System</p>
          <p className="font-mono text-2xl font-semibold tabular-nums text-[var(--color-press-red)] mt-1">
            {totalAfter} min/day
          </p>
        </div>
        <div className="px-4 py-2">
          <p className="text-xs text-[var(--color-ink-muted)]">Deep Work Reclaimed</p>
          <p className="font-mono text-2xl font-semibold tabular-nums text-[var(--color-ink)] mt-1">
            {savedHours} hrs/day
          </p>
        </div>
        <div className="px-4 py-2">
          <p className="text-xs text-[var(--color-ink-muted)]">Efficiency Multiplier</p>
          <p className="font-mono text-2xl font-semibold tabular-nums text-[var(--color-ink)] mt-1">
            {(totalBefore / totalAfter).toFixed(1)}× faster
          </p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-8">
          {perspective === 'schedule' && (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b-2 border-[var(--color-rule-strong)] text-xs uppercase tracking-wider text-[var(--color-ink-muted)]">
                    <th className="py-2.5 pr-4 font-semibold">Daily Engineering Activity</th>
                    <th className="py-2.5 pr-4 font-semibold">Manual Habit</th>
                    <th className="py-2.5 pr-4 font-semibold">Kalyan System</th>
                    <th className="py-2.5 text-right font-semibold">Time Shift</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-rule)]">
                  {WORKFLOW_TRANSFORMATIONS.map((row) => {
                    const isSelected = row.id === activeRow.id;
                    return (
                      <tr
                        key={row.id}
                        onClick={() => setSelectedRowId(row.id)}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-[var(--color-paper-alt)]'
                            : 'hover:bg-[var(--color-paper-surface)]'
                        }`}
                      >
                        <td className="py-3 pr-4 align-top">
                          <div className="font-semibold text-[var(--color-ink)]">{row.task}</div>
                          <div className="text-xs text-[var(--color-ink-subtle)] mt-0.5">
                            {row.category}
                          </div>
                        </td>
                        <td className="py-3 pr-4 align-top text-xs text-[var(--color-ink-muted)] leading-relaxed">
                          {row.legacyManual}
                        </td>
                        <td className="py-3 pr-4 align-top text-xs text-[var(--color-ink)] leading-relaxed">
                          {row.kalyanSystem}
                        </td>
                        <td className="py-3 align-top text-right font-mono text-xs tabular-nums whitespace-nowrap">
                          <span className="text-[var(--color-ink-subtle)] line-through mr-1.5">
                            {row.minutesBefore}m
                          </span>
                          <span className="font-semibold text-[var(--color-press-red)]">
                            {row.minutesAfter}m
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {perspective === 'team' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="border border-[var(--color-rule)] bg-[var(--color-paper-surface)] p-5 space-y-3">
                <p className="text-xs uppercase tracking-wider text-[var(--color-press-red)] font-medium">
                  Mode A · Solo AI-Full-Stack Builder
                </p>
                <h3 className="font-display text-xl font-bold text-[var(--color-ink)]">
                  One Project, Five Skills Compounded
                </h3>
                <p className="text-sm leading-relaxed text-[var(--color-ink)]">
                  Because <span className="font-mono text-xs">kalyanData.ts</span> decouples data from React view sections and <span className="font-mono text-xs">createApp.ts</span> unifies Express + serverless routes, Kalyan operates like a five-person squad—shipping UI, APIs, RAG retrieval, live snapshots, and daily engineering digests without context-switching penalties.
                </p>
              </div>
              <div className="border border-[var(--color-rule)] bg-[var(--color-paper-surface)] p-5 space-y-3">
                <p className="text-xs uppercase tracking-wider text-[var(--color-press-red)] font-medium">
                  Mode B · Multi-Developer Team Handoff
                </p>
                <h3 className="font-display text-xl font-bold text-[var(--color-ink)]">
                  Parallel Execution Without Merge Friction
                </h3>
                <p className="text-sm leading-relaxed text-[var(--color-ink)]">
                  In a collaborative sprint, frontend engineers iterate on <span className="font-mono text-xs">src/components/*</span>, AI engineers tune retrieval/reranking, and platform engineers configure authentication, storage, and edge deployments—all bounded by clean TypeScript interfaces and full-bundle archives.
                </p>
              </div>
            </div>
          )}

          {perspective === 'breakdown' && (
            <div className="space-y-4">
              {WORKFLOW_TRANSFORMATIONS.map((row) => {
                const saved = row.minutesBefore - row.minutesAfter;
                const pct = Math.round((saved / row.minutesBefore) * 100);
                return (
                  <div key={row.id} className="space-y-1.5">
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="font-medium text-[var(--color-ink)]">{row.task}</span>
                      <span className="font-mono text-xs tabular-nums text-[var(--color-ink-muted)]">
                        Saved {saved} min/day ({pct}% reduction)
                      </span>
                    </div>
                    <div className="h-2.5 w-full bg-[var(--color-paper-alt)] border border-[var(--color-rule)] overflow-hidden">
                      <svg
                        viewBox="0 0 100 10"
                        preserveAspectRatio="none"
                        className="h-full w-full block"
                        aria-hidden="true"
                      >
                        <rect x="0" y="0" width={pct} height="10" fill="var(--color-press-red)" />
                      </svg>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-5 border-t border-[var(--color-rule)] pt-4 flex flex-wrap items-baseline justify-between gap-4">
            <div>
              <span className="text-xs uppercase tracking-wider text-[var(--color-ink-subtle)]">
                Selected Mechanism · {activeRow.task}
              </span>
              <p className="text-sm font-medium text-[var(--color-ink)] mt-0.5">
                {activeRow.mechanism}
              </p>
            </div>
            <span className="font-mono text-xs tabular-nums text-[var(--color-press-red)]">
              Net daily gain: +{activeRow.minutesBefore - activeRow.minutesAfter} min
            </span>
          </div>
        </div>

        <aside className="lg:col-span-4 space-y-4">
          <figure>
            <NewspaperImage
              src="/assets/aistudio/file_00000000288082118b7035a193174736_ff86bac7.webp"
              alt="One project, five skills, build as you learn graphic featuring Saragadam Kalyan"
              aspectClass="aspect-[3/4]"
              imgClassName="object-contain bg-white"
              caption="Fig. 3 — One project, five compounded skills: how building complete systems multiplies daily engineering leverage."
            />
          </figure>
          <blockquote className="border-t border-b border-[var(--color-rule)] py-4 font-display text-lg italic leading-snug text-[var(--color-ink)]">
            “Productivity does not come from typing faster. It comes from building retrieval, routing, and publishing systems that never ask you to solve the same chore twice.”
          </blockquote>
        </aside>
      </div>

      <SectionQRCode
        url={activeQrTarget.url}
        label={activeQrTarget.label}
        sublabel={activeQrTarget.sublabel}
        caption={`Direct System Link · Scan or tap to open ${activeQrTarget.sublabel} detailed in the ledger above.`}
      />
    </section>
  );
}
