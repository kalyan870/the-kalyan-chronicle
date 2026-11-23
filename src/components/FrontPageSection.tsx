import { useState } from 'react';
import { ENGINEERING_DESKS, KALYAN_PROFILE } from '../data/chronicleData';
import { BroadsheetQrCode, buildSectionQrUrl } from './BroadsheetQrCode';
import { NewspaperImage } from './NewspaperImage';
import { ChronicleAskBar } from './ChronicleAskBar';

export function FrontPageSection() {
  const [selectedDeskIndex, setSelectedDeskIndex] = useState<string>(ENGINEERING_DESKS[0].index);
  const activeDesk =
    ENGINEERING_DESKS.find((desk) => desk.index === selectedDeskIndex) ?? ENGINEERING_DESKS[0];

  return (
    <section id="front-page" className="py-8 border-b border-[var(--color-rule-strong)]">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <article className="lg:col-span-8 lg:pr-8 lg:border-r border-[var(--color-rule)]">
          <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--color-press-red)] font-medium tracking-wider uppercase mb-2">
            <span>Lead Feature</span>
            <span aria-hidden="true">·</span>
            <span className="text-[var(--color-ink-muted)]">Full-Stack &amp; AI Blueprint</span>
            <span aria-hidden="true">·</span>
            <span className="text-[var(--color-ink-muted)]">5 min read</span>
          </div>

          <h2 className="font-display text-3xl sm:text-4xl font-bold leading-[1.1] tracking-tight text-[var(--color-ink)]">
            Kalyan’s Entire Work — And Reclaim Five Hours Daily
          </h2>

          <p className="mt-3 text-lg text-[var(--color-ink-muted)] leading-snug">
            From Vignan CSE foundations and FastAPI + React systems to InterviewIQ AI, Hybrid RAG retrieval, and automated Substack publishing.
          </p>

          <div className="mt-3 pb-4 border-b border-[var(--color-rule)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--color-ink-subtle)]">
              <span>By Engineering Desk</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                {KALYAN_PROFILE.bundleStats.codeOnlyFiles} source files ({KALYAN_PROFILE.bundleStats.codeOnlySize}) / {KALYAN_PROFILE.bundleStats.fullFiles} total assets ({KALYAN_PROFILE.bundleStats.fullSize})
              </span>
            </div>
            <div className="shrink-0 border border-[var(--color-rule)] bg-[var(--color-paper-surface)] p-1.5">
              <BroadsheetQrCode
                url={buildSectionQrUrl('front-page')}
                label="Section I QR"
                sublabel="Lead Blueprint"
                compact
              />
            </div>
          </div>

          <figure className="mt-5 mb-6">
            <NewspaperImage
              src="/assets/aistudio/file_00000000b0ac8211a6c5a0111e97fa8d_9011c4bb.png"
              alt="Saragadam Kalyan at desk with AI, Python, Docker, and GitHub stickers on laptop beside Artificial Intelligence and System Design volumes"
              aspectClass="aspect-[3/2]"
              imgClassName="object-cover object-top bg-white"
              caption="Fig. 1 — Saragadam Kalyan at the engineering desk: uniting AI, Python, Docker, and System Design into reproducible full-stack products."
            />
          </figure>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-[15px] leading-[1.68] text-[var(--color-ink)]">
            <div className="space-y-4">
              <p className="drop-cap">
                When an engineering team steps in to operate and extend Saragadam Kalyan’s body of work, they do not inherit a fragmented folder of classroom exercises. Starting as a Computer Science & Engineering student at Vignan and building steadily toward a 2028 AI engineering track, Kalyan structured every project around modular React 19 interfaces, FastAPI and Express backends, and applied LLM tooling.
              </p>
              <p>
                On the surface, the personal portfolio and nexus applications read like crisp editorial showcases: discrete views such as <span className="font-mono text-[13px]">HeroSection</span>, <span className="font-mono text-[13px]">FocusDimensions</span>, <span className="font-mono text-[13px]">LabVaultSection</span>, and <span className="font-mono text-[13px]">GitHubActivitySection</span>. Underneath, developers execute a single-source pattern where every project entry, writing link, and capability flows from typed data (<span className="font-mono text-[13px]">kalyanData.ts</span>).
              </p>
            </div>

            <div className="space-y-4">
              <p>
                Crucially, backend developers keep strict server boundaries rather than scattering secrets across client bundles. Shared Express routes in <span className="font-mono text-[13px]">src/server/createApp.ts</span> keep API keys and credentials isolated on the server, persist structured edition and project records cleanly, and enforce input validation across every request.
              </p>
              <p>
                For daily workflow efficiency, this structure compounds across every task. Hybrid RAG replaces manual documentation hunts; InterviewIQ AI and the AI Job Agent automate ATS resume alignment and mock drills; the Environmental Risk &amp; Safety Dashboard and MediaPipe vision tools surface real-time telemetry; and live GitHub and Substack feeds keep public credibility synchronized automatically.
              </p>
            </div>
          </div>

          <ChronicleAskBar />
        </article>

        <aside className="lg:col-span-4 space-y-5">
          <div className="border-b border-[var(--color-rule-strong)] pb-2">
            <p className="text-xs uppercase tracking-widest text-[var(--color-press-red)] font-medium">
              How Developers Run the Stack
            </p>
            <h3 className="font-display text-2xl font-bold text-[var(--color-ink)] mt-1">
              The Five-Desk Playbook
            </h3>
            <p className="text-xs text-[var(--color-ink-muted)] mt-1">
              Select an engineering desk below to inspect how teams execute each layer and the daily time reclaimed.
            </p>
          </div>

          <div className="divide-y divide-[var(--color-rule)] border-b border-[var(--color-rule)]">
            {ENGINEERING_DESKS.map((desk) => {
              const isActive = desk.index === activeDesk.index;
              return (
                <button
                  key={desk.index}
                  type="button"
                  onClick={() => setSelectedDeskIndex(desk.index)}
                  className={`w-full text-left py-3 px-2.5 transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-[var(--color-paper-alt)]'
                      : 'hover:bg-[var(--color-paper-surface)]'
                  }`}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-display text-base font-semibold text-[var(--color-ink)]">
                      {desk.index}. {desk.name}
                    </span>
                    <span className="font-mono text-xs tabular-nums text-[var(--color-press-red)] shrink-0">
                      {desk.dailyTimeAfter}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--color-ink-muted)] mt-0.5">{desk.scope}</p>
                </button>
              );
            })}
          </div>

          <div className="bg-[var(--color-paper-surface)] border border-[var(--color-rule)] p-4 space-y-3 print-avoid-break">
            <div className="flex items-baseline justify-between gap-2 border-b border-[var(--color-rule)] pb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-ink)]">
                Desk {activeDesk.index} Execution Brief
              </span>
              <span className="font-mono text-xs tabular-nums text-[var(--color-ink-muted)]">
                {activeDesk.dailyTimeBefore} → {activeDesk.dailyTimeAfter}
              </span>
            </div>
            <p className="text-sm leading-relaxed text-[var(--color-ink)]">
              {activeDesk.howDevsExecute}
            </p>
            <div className="pt-1 text-xs text-[var(--color-ink-muted)] font-mono">
              Modules: {activeDesk.keyModules.join(' · ')}
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
