import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Archive, ExternalLink, QrCode, RotateCcw, X } from 'lucide-react';
import { TopBar } from './components/TopBar';
import { Masthead } from './components/Masthead';
import { FrontPageSection } from './components/FrontPageSection';
import { DailyDigestSection, type DigestState } from './components/DailyDigestSection';
import { WorkflowShiftSection } from './components/WorkflowShiftSection';
import { PackageAuditSection } from './components/PackageAuditSection';
import { ClassifiedsAndColophon } from './components/ClassifiedsAndColophon';
import { OfflineIndicator } from './components/OfflineIndicator';
const PrintPreviewModal = lazy(() =>
  import('./components/PrintPreviewModal').then((module) => ({ default: module.PrintPreviewModal }))
);
const EditionArchiveModal = lazy(() =>
  import('./components/EditionArchiveModal').then((module) => ({ default: module.EditionArchiveModal }))
);
const DevWorkbenchModal = lazy(() =>
  import('./components/DevWorkbenchModal').then((module) => ({ default: module.DevWorkbenchModal }))
);
import {
  WorkbenchShowcaseSection,
  type WorkbenchSectionTab,
} from './components/WorkbenchShowcaseSection';
import type { BroadsheetPaperSize } from './utils/printBroadsheet';
import { runViewTransition } from './utils/viewTransition';
import { registerChronicleWebMcpTools } from './lib/webMcp';
import {
  FEATURED_PROJECTS,
  KALYAN_PROFILE,
  VERIFIED_CERTIFICATES,
} from './data/chronicleData';
import { STATIC_DIGEST } from './data/staticDigest';
import { IS_STATIC_ONLY_BUILD } from './utils/publicAssetUrl';

const DIGEST_CACHE_KEY = 'kalyan_chronicle_latest_edition_v1';

function readCachedDigest(): DigestState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(DIGEST_CACHE_KEY);
    return raw ? (JSON.parse(raw) as DigestState) : null;
  } catch {
    return null;
  }
}

export default function App() {
  const [digest, setDigest] = useState<DigestState | null>(() => readCachedDigest() ?? STATIC_DIGEST);
  const [digestLoading, setDigestLoading] = useState<boolean>(false);
  const [digestError, setDigestError] = useState<string | null>(null);

  const [exportingPdf, setExportingPdf] = useState<boolean>(false);
  const [pdfMessage, setPdfMessage] = useState<string | null>(null);
  const [showScanBanner, setShowScanBanner] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('dossier') === 'scan';
  });
  const broadsheetRef = useRef<HTMLElement | null>(null);

  const scanDossierUrl = useMemo(() => {
    if (typeof window === 'undefined') return 'https://kalyannexus.vercel.app/';
    return `${window.location.origin}/?dossier=scan#project-index`;
  }, []);

  const loadDigest = useCallback(async (forceRefresh = false) => {
    if (IS_STATIC_ONLY_BUILD) {
      setDigest(STATIC_DIGEST);
      setDigestLoading(false);
      return;
    }
    setDigestLoading(forceRefresh);
    setDigestError(null);
    setArchivedEditionTitle(null);
    try {
      const endpoint = forceRefresh ? '/api/digest?refresh=true' : '/api/digest';
      const res = await fetch(endpoint);
      if (!res.ok) {
        throw new Error(`Status ${res.status}`);
      }
      const data = (await res.json()) as DigestState;
      setDigest(data);
      try {
        window.localStorage.setItem(DIGEST_CACHE_KEY, JSON.stringify(data));
      } catch {
        // Ignore storage quota errors
      }
    } catch {
      const cached = readCachedDigest();
      if (cached) {
        setDigest(cached);
        setDigestError('Offline or unreachable network — displaying latest cached broadsheet edition');
      } else {
        setDigest(STATIC_DIGEST);
        setDigestError('Live GitHub or Substack feeds could not be reached');
      }
    } finally {
      setDigestLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!IS_STATIC_ONLY_BUILD) void loadDigest(false);
  }, [loadDigest]);

  const editionDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const [printing, setPrinting] = useState<boolean>(false);
  const [printPreviewOpen, setPrintPreviewOpen] = useState<boolean>(false);
  const [archiveModalOpen, setArchiveModalOpen] = useState<boolean>(false);
  const [workbenchModalOpen, setWorkbenchModalOpen] = useState<boolean>(false);
  const [workbenchTab, setWorkbenchTab] = useState<WorkbenchSectionTab>('trace');
  const [archivedEditionTitle, setArchivedEditionTitle] = useState<string | null>(null);

  useEffect(() => {
    return registerChronicleWebMcpTools({
      onOpenArchive: () => runViewTransition(() => setArchiveModalOpen(true)),
      onOpenWorkbench: () =>
        runViewTransition(() => {
          setWorkbenchTab('protocol');
          setWorkbenchModalOpen(true);
        }),
    });
  }, []);

  const handleDownloadPdf = async (
    paperSize: BroadsheetPaperSize = 'letter',
    paperStock: 'white' | 'newsprint' = 'newsprint'
  ): Promise<boolean> => {
    if (!broadsheetRef.current) return false;
    setExportingPdf(true);
    try {
      const { exportBroadsheetToPdf } = await import('./utils/exportBroadsheetPdf');
      const savedName = await exportBroadsheetToPdf(broadsheetRef.current, {
        paperSize,
        paperStock,
      });
      setPdfMessage(`Saved print-ready PDF: ${savedName}`);
      return true;
    } catch {
      setPdfMessage('Unable to generate PDF in this frame. Open the URL directly in a browser tab and press Ctrl+P / Cmd+P.');
      return false;
    } finally {
      setExportingPdf(false);
    }
  };

  const handleConfirmPrint = async (paperSize: BroadsheetPaperSize = 'letter') => {
    setPrintPreviewOpen(false);
    setPrinting(true);
    setPdfMessage(null);
    await new Promise<void>((resolve) => setTimeout(resolve, 80));

    const { printBroadsheet } = await import('./utils/printBroadsheet');
    const result = await printBroadsheet({ paperSize });
    if (result.method === 'blocked') {
      setPdfMessage('Browser print dialog is restricted in embedded preview — generating print-ready PDF…');
      await handleDownloadPdf(paperSize, 'newsprint');
    }

    setPrinting(false);
  };

  const highlightedProjects = FEATURED_PROJECTS.filter((p) => p.highlighted);

  return (
    <div className="min-h-screen bg-[var(--color-paper)] text-[var(--color-ink)]">
      <TopBar
        onPrint={() => runViewTransition(() => setPrintPreviewOpen(true))}
        onOpenWorkbench={() => runViewTransition(() => setWorkbenchModalOpen(true))}
        printing={printing || exportingPdf}
        printNotice={pdfMessage}
        onDismissNotice={() => setPdfMessage(null)}
      />

      <main
        ref={broadsheetRef}
        className="broadsheet-sheet mx-auto max-w-[1200px] px-4 sm:px-8 lg:px-10 bg-[var(--color-paper)]"
      >
        <Masthead
          editionDate={editionDate}
          publicRepoCount={digest?.profile.publicRepos ?? 54}
          onDownloadPdf={() => void handleDownloadPdf()}
          exportingPdf={exportingPdf}
          pdfMessage={pdfMessage}
          scanDossierUrl={scanDossierUrl}
          onOpenArchive={() => runViewTransition(() => setArchiveModalOpen(true))}
        />

        {showScanBanner && (
          <aside className="mt-6 border border-[var(--color-rule-strong)] bg-[var(--color-paper-surface)] p-5 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--color-rule)] pb-3">
              <div>
                <p className="text-xs uppercase tracking-widest text-[var(--color-press-red)] font-medium flex items-center gap-1.5">
                  <QrCode className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>QR Reader Dossier · Instant Verified Summary</span>
                </p>
                <h2 className="font-display text-2xl font-bold text-[var(--color-ink)] mt-0.5">
                  {KALYAN_PROFILE.name} — Complete Portfolio, Highlighted Projects &amp; Certificates
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowScanBanner(false)}
                className="no-print inline-flex items-center gap-1 border border-[var(--color-rule)] px-2.5 py-1 text-xs text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] cursor-pointer"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Hide Quick Card</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
              <div className="space-y-1.5">
                <p className="font-semibold uppercase tracking-wider text-[var(--color-ink)]">
                  Portfolios, LinkedIn &amp; Socials
                </p>
                <ul className="space-y-1">
                  {KALYAN_PROFILE.links.map((l) => (
                    <li key={l.label}>
                      <a
                        href={l.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 underline underline-offset-2 hover:text-[var(--color-press-red)]"
                      >
                        <span>
                          <strong>{l.label}:</strong> {l.handle}
                        </span>
                        <ExternalLink className="h-3 w-3" aria-hidden="true" />
                      </a>
                    </li>
                  ))}
                  <li className="font-mono text-[var(--color-ink-muted)] pt-1">
                    Email: {KALYAN_PROFILE.email}
                  </li>
                </ul>
              </div>

              <div className="space-y-1.5">
                <p className="font-semibold uppercase tracking-wider text-[var(--color-ink)]">
                  Highlighted Projects ({highlightedProjects.length})
                </p>
                <ul className="space-y-1.5">
                  {highlightedProjects.map((p) => (
                    <li key={p.id}>
                      <a
                        href={p.liveUrl || p.repoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="font-semibold hover:text-[var(--color-press-red)] underline underline-offset-2"
                      >
                        {p.title}
                      </a>
                      <span className="block text-[var(--color-ink-muted)]">{p.kicker}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-1.5">
                <p className="font-semibold uppercase tracking-wider text-[var(--color-ink)]">
                  Verified Certificates ({VERIFIED_CERTIFICATES.length})
                </p>
                <ul className="space-y-1">
                  {VERIFIED_CERTIFICATES.slice(0, 5).map((c) => (
                    <li key={c.id}>
                      <a
                        href={c.url}
                        target="_blank"
                        rel="noreferrer"
                        className="underline underline-offset-2 hover:text-[var(--color-press-red)]"
                      >
                        {c.title}
                      </a>
                      <span className="text-[var(--color-ink-subtle)]"> · {c.issuer}</span>
                    </li>
                  ))}
                </ul>
                <a
                  href="#certificates-ledger"
                  className="inline-block pt-1 font-medium text-[var(--color-press-red)] underline underline-offset-4"
                >
                  View all {VERIFIED_CERTIFICATES.length} certificates &amp; full newspaper below
                </a>
              </div>
            </div>
          </aside>
        )}

        {archivedEditionTitle && (
          <div className="no-print mt-6 border border-[var(--color-press-red)] bg-[var(--color-paper-surface)] px-4 py-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs">
              <Archive className="h-4 w-4 text-[var(--color-press-red)] shrink-0" aria-hidden="true" />
              <span>
                <strong className="uppercase tracking-wider text-[var(--color-press-red)]">
                  Back Issue Mode:
                </strong>{' '}
                Viewing archived snapshot <em>{archivedEditionTitle}</em>.
              </span>
            </div>
            <button
              type="button"
              onClick={() => void loadDigest(false)}
              className="inline-flex items-center gap-1.5 border border-[var(--color-rule-strong)] bg-[var(--color-paper)] px-3 py-1.5 text-xs font-medium text-[var(--color-ink)] hover:bg-[var(--color-paper-alt)] cursor-pointer whitespace-nowrap"
            >
              <RotateCcw className="h-3.5 w-3.5 text-[var(--color-press-red)]" aria-hidden="true" />
              <span>Return to Live Edition</span>
            </button>
          </div>
        )}

        <FrontPageSection />
        <DailyDigestSection
          digest={digest}
          loading={digestLoading}
          error={digestError}
          onRefresh={() => void loadDigest(true)}
          liveSyncEnabled={!IS_STATIC_ONLY_BUILD}
        />
        <WorkflowShiftSection />
        <PackageAuditSection />
        <WorkbenchShowcaseSection
          onOpenTool={(tab) => {
            runViewTransition(() => {
              setWorkbenchTab(tab);
              setWorkbenchModalOpen(true);
            });
          }}
        />
        <ClassifiedsAndColophon
          scanDossierUrl={scanDossierUrl}
          onOpenQuickDossier={() => setShowScanBanner(true)}
          latestProjects={digest?.latestProjects}
        />
      </main>
      {printPreviewOpen && <Suspense fallback={null}><PrintPreviewModal
        open={printPreviewOpen}
        broadsheetElement={broadsheetRef.current}
        onClose={() => setPrintPreviewOpen(false)}
        onPrintNow={handleConfirmPrint}
        onDownloadPdf={async (paperSize, paperStock) => {
          setPrintPreviewOpen(false);
          await handleDownloadPdf(paperSize, paperStock);
        }}
        printing={printing || exportingPdf}
      /></Suspense>}
      {archiveModalOpen && <Suspense fallback={null}><EditionArchiveModal
        open={archiveModalOpen}
        onClose={() => runViewTransition(() => setArchiveModalOpen(false))}
        onLoadSnapshot={(snapshotDigest, editionTitle) => {
          runViewTransition(() => {
            setDigest(snapshotDigest);
            setDigestError(null);
            setArchivedEditionTitle(editionTitle);
            setPdfMessage(`Viewing archived issue: ${editionTitle}`);
          });
        }}
      /></Suspense>}
      {workbenchModalOpen && <Suspense fallback={null}><DevWorkbenchModal
        open={workbenchModalOpen}
        initialTab={workbenchTab}
        onClose={() => runViewTransition(() => setWorkbenchModalOpen(false))}
      /></Suspense>}
      <OfflineIndicator />
    </div>
  );
}
