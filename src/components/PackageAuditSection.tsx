import { useEffect, useState } from 'react';
import { ShieldAlert, Wrench } from 'lucide-react';
import {
  DEFAULT_USER_PACKAGE_JSON,
  type PackageAuditReport,
  type PackageFinding,
} from '../data/chronicleData';
import { SectionQRCode } from './SectionQRCode';
import { NewspaperImage } from './NewspaperImage';
import { IS_STATIC_ONLY_BUILD } from '../utils/publicAssetUrl';

type CategoryFilter =
  | 'All'
  | 'Version & Compatibility'
  | 'Security Hardening'
  | 'DX & Performance';

export function PackageAuditSection() {
  const [rawJson, setRawJson] = useState<string>(DEFAULT_USER_PACKAGE_JSON);
  const [report, setReport] = useState<PackageAuditReport | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<CategoryFilter>('All');
  const [showEditor, setShowEditor] = useState<boolean>(false);

  async function runAudit(jsonPayload: string) {
    if (IS_STATIC_ONLY_BUILD) {
      setError('Package analysis needs the hosted API. Open this tool on the Vercel or Netlify deployment.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/analyze-package', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageJson: jsonPayload }),
      });
      const data = (await res.json()) as PackageAuditReport & { error?: string };
      if (!res.ok) {
        setError(data.error || 'Unable to analyze package.json.');
      } else {
        setReport(data);
      }
    } catch {
      setError('Network error reaching the package analysis service.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!IS_STATIC_ONLY_BUILD) void runAudit(DEFAULT_USER_PACKAGE_JSON);
  }, []);

  const visibleFindings: PackageFinding[] =
    report?.findings.filter((item) => filter === 'All' || item.category === filter) ?? [];

  return (
    <section id="package-audit" className="py-8 border-b border-[var(--color-rule-strong)]">
      <div className="flex flex-wrap items-end justify-between gap-4 pb-4 border-b border-[var(--color-rule)]">
        <div>
          <p className="text-xs uppercase tracking-widest text-[var(--color-press-red)] font-medium">
            Section IV · AI Project Assistant Supplement
          </p>
          <h2 className="font-display text-3xl font-bold text-[var(--color-ink)] mt-1">
            Package.json Audit: Dependencies, Security & DX Upgrades
          </h2>
          <p className="text-sm text-[var(--color-ink-muted)] mt-1">
            Automated technical inspection of <span className="font-mono text-xs">{report?.projectName || 'react-example'}</span> and its impact on daily developer velocity.
          </p>
        </div>

        <div className="no-print flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setShowEditor((prev) => !prev)}
            className="inline-flex items-center gap-2 border border-[var(--color-rule-strong)] bg-[var(--color-paper-surface)] px-3.5 py-2 text-xs font-medium text-[var(--color-ink)] hover:bg-[var(--color-paper-alt)] transition-colors cursor-pointer whitespace-nowrap"
          >
            <Wrench className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{showEditor ? 'Hide Manifest Editor' : 'Inspect Custom package.json'}</span>
          </button>
        </div>
      </div>

      {showEditor && (
        <div className="no-print mt-5 border border-[var(--color-rule-strong)] bg-[var(--color-paper-surface)] p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <label
              htmlFor="package-json-input"
              className="text-xs font-semibold uppercase tracking-wider text-[var(--color-ink)]"
            >
              Paste package.json to re-run dependency & security audit
            </label>
            <button
              type="button"
              onClick={() => {
                setRawJson(DEFAULT_USER_PACKAGE_JSON);
                void runAudit(DEFAULT_USER_PACKAGE_JSON);
              }}
              className="text-xs text-[var(--color-ink-muted)] underline underline-offset-4 hover:text-[var(--color-ink)] cursor-pointer"
            >
              Reset to react-example
            </button>
          </div>
          <textarea
            id="package-json-input"
            value={rawJson}
            onChange={(e) => setRawJson(e.target.value)}
            rows={10}
            className="w-full border border-[var(--color-rule)] bg-[var(--color-paper)] p-3 font-mono text-xs text-[var(--color-ink)] focus:outline-2 focus:outline-[var(--color-press-red)]"
          />
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => void runAudit(rawJson)}
              disabled={loading}
              className="bg-[var(--color-press-red)] px-4 py-2 text-xs font-medium text-[#FCF9F5] hover:bg-[#701D16] disabled:opacity-60 transition-colors cursor-pointer"
            >
              {loading ? 'Auditing…' : 'Run Package Audit'}
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-4 border border-[var(--color-press-red)] bg-[var(--color-paper-surface)] p-3 text-xs text-[var(--color-press-red)]">
          {error}
        </div>
      )}

      <div className="no-print mt-5 flex flex-wrap items-center justify-between gap-4">
        <div
          role="tablist"
          aria-label="Filter audit findings"
          className="flex flex-wrap items-center gap-1 bg-[var(--color-paper-alt)] p-1 border border-[var(--color-rule)]"
        >
          {(
            ['All', 'Version & Compatibility', 'Security Hardening', 'DX & Performance'] as CategoryFilter[]
          ).map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={filter === tab}
              onClick={() => setFilter(tab)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                filter === tab
                  ? 'bg-[var(--color-paper-surface)] text-[var(--color-ink)] border border-[var(--color-rule)]'
                  : 'text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {report && (
          <p className="text-xs font-mono tabular-nums text-[var(--color-ink-muted)]">
            {report.totalDependencies} runtime · {report.totalDevDependencies} devDependencies · {report.findings.length} findings
          </p>
        )}
      </div>

      {report?.aiCommentary && (
        <div className="mt-5 border border-[var(--color-rule)] bg-[var(--color-paper-alt)] p-4">
          <p className="text-xs uppercase tracking-wider font-semibold text-[var(--color-press-red)]">
            Editorial Executive Summary
          </p>
          <p className="mt-1 text-sm leading-relaxed text-[var(--color-ink)]">
            {report.aiCommentary}
          </p>
        </div>
      )}

      {loading && !report ? (
        <div className="py-10 text-center text-sm text-[var(--color-ink-muted)]">
          Inspecting manifest versions, peer compatibility, and Express security posture…
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-8 divide-y divide-[var(--color-rule)] border-t border-b border-[var(--color-rule)]">
            {visibleFindings.map((item) => (
              <article key={item.id} className="py-4 space-y-2 print-avoid-break">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <h3 className="font-mono text-sm font-semibold text-[var(--color-ink)]">
                      {item.packageName}
                    </h3>
                    <span className="font-mono text-xs text-[var(--color-ink-subtle)]">
                      {item.currentVersion}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-mono">
                    <span className="text-[var(--color-ink-muted)]">{item.category}</span>
                    <span aria-hidden="true">·</span>
                    <span
                      className={
                        item.severity === 'High'
                          ? 'text-[var(--color-press-red)] font-semibold'
                          : 'text-[var(--color-ink)] font-medium'
                      }
                    >
                      {item.severity === 'High' && (
                        <ShieldAlert className="inline h-3 w-3 mr-1 -mt-0.5" aria-hidden="true" />
                      )}
                      {item.severity} Priority
                    </span>
                  </div>
                </div>

                <p className="text-sm text-[var(--color-ink)] leading-relaxed">{item.issue}</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1 text-xs">
                  <div>
                    <span className="uppercase tracking-wider font-semibold text-[var(--color-ink-muted)]">
                      Recommended Action
                    </span>
                    <p className="mt-0.5 text-[var(--color-ink)] leading-relaxed">
                      {item.recommendation}
                    </p>
                  </div>
                  <div>
                    <span className="uppercase tracking-wider font-semibold text-[var(--color-press-red)]">
                      Daily Workflow Impact
                    </span>
                    <p className="mt-0.5 text-[var(--color-ink)] leading-relaxed">
                      {item.workflowImpact}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <aside className="lg:col-span-4 space-y-5 print-avoid-break">
            <figure>
              <NewspaperImage
                src="/assets/aistudio/file_00000000c35c82119e4ed7d746fe44ea_eafefffb.webp"
                alt="Saragadam Kalyan beside the metallic K monogram and AI engineering monitor"
                aspectClass="aspect-[4/4]"
                imgClassName="object-cover object-top"
                caption="Fig. 4 — Systems Identity: Saragadam Kalyan — uniting AI tooling, manifest governance, and production Express hardening."
              />
            </figure>

            <div className="border-t border-[var(--color-rule)] pt-4 space-y-2">
              <h4 className="font-display text-lg font-bold text-[var(--color-ink)]">
                Why This Transforms Your Day
              </h4>
              <p className="text-sm leading-relaxed text-[var(--color-ink)]">
                Separating build dependencies from runtime packages, swapping PrismJS for Shiki/Sugar-High, and adding Zod + Helmet on Express turns brittle manual pre-deploy checks into one automated 5-second gate—stopping production regressions before they interrupt deep AI engineering work.
              </p>
            </div>
          </aside>
        </div>
      )}

      <SectionQRCode
        url="https://drive.google.com/file/d/18aDkbo6LT6y6qtGO_IFM0F_Ta2Vu4QPR/view?usp=sharing"
        label="Certificate QR"
        sublabel="GUVI × HCL Full Stack 2026"
        caption="Verified Engineering Credential · Scan or tap to verify full-stack architecture & Express security mastery."
      />
    </section>
  );
}
