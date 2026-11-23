import { useEffect, useState } from 'react';
import { Download, FileText, Printer, X } from 'lucide-react';
import type { BroadsheetPaperSize } from '../utils/printBroadsheet';
import type { RenderedPagePreview } from '../utils/exportBroadsheetPdf';

interface PrintPreviewModalProps {
  open: boolean;
  broadsheetElement: HTMLElement | null;
  onClose: () => void;
  onPrintNow: (paperSize: BroadsheetPaperSize) => Promise<void>;
  onDownloadPdf: (paperSize: BroadsheetPaperSize, paperStock: 'white' | 'newsprint') => Promise<void>;
  printing: boolean;
}

type ZoomLevel = 'compact' | 'standard' | 'large';

export function PrintPreviewModal({
  open,
  broadsheetElement,
  onClose,
  onPrintNow,
  onDownloadPdf,
  printing,
}: PrintPreviewModalProps) {
  const [paperSize, setPaperSize] = useState<BroadsheetPaperSize>('letter');
  const [paperStock, setPaperStock] = useState<'white' | 'newsprint'>('white');
  const [zoom, setZoom] = useState<ZoomLevel>('standard');
  const [pages, setPages] = useState<RenderedPagePreview[]>([]);
  const [rendering, setRendering] = useState<boolean>(false);
  const [renderError, setRenderError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !broadsheetElement) return;
    let cancelled = false;
    setRendering(true);
    setRenderError(null);

    void import('../utils/exportBroadsheetPdf')
      .then(({ renderBroadsheetPagePreviews }) =>
        renderBroadsheetPagePreviews(broadsheetElement, {
          paperSize,
          paperStock,
        })
      )
      .then((result) => {
        if (!cancelled) {
          setPages(result.pages);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRenderError('Could not render simulated paper sheets. You can still trigger printing directly.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setRendering(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, broadsheetElement, paperSize, paperStock]);

  if (!open) return null;

  const zoomWidthClass =
    zoom === 'compact'
      ? 'max-w-[460px]'
      : zoom === 'large'
        ? 'max-w-[780px]'
        : 'max-w-[620px]';

  const paperAspectClass = paperSize === 'A4' ? 'aspect-[210/297]' : 'aspect-[17/22]';
  const paperDimensionsLabel =
    paperSize === 'A4' ? 'A4 Portrait (210 × 297 mm)' : 'US Letter Portrait (8.5 × 11 in)';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="print-preview-title"
      className="no-print fixed inset-0 z-50 flex flex-col bg-[#161513]/75 backdrop-blur-xs"
    >
      {/* Studio Control Bar */}
      <div className="border-b border-[var(--color-rule-strong)] bg-[var(--color-paper)] px-4 sm:px-6 py-3">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-widest text-[var(--color-press-red)] font-medium">
              Print Pressroom · Simulated Sheet Preview
            </p>
            <h2
              id="print-preview-title"
              className="font-display text-lg sm:text-xl font-bold text-[var(--color-ink)]"
            >
              Physical Paper Preview ({paperDimensionsLabel})
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Paper Size */}
            <div
              role="group"
              aria-label="Paper size"
              className="flex items-center border border-[var(--color-rule)] bg-[var(--color-paper-alt)] p-0.5 text-xs"
            >
              <button
                type="button"
                onClick={() => setPaperSize('letter')}
                className={`px-2.5 py-1 font-medium transition-colors cursor-pointer ${
                  paperSize === 'letter'
                    ? 'bg-[var(--color-paper-surface)] text-[var(--color-ink)] border border-[var(--color-rule)]'
                    : 'text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]'
                }`}
              >
                Letter
              </button>
              <button
                type="button"
                onClick={() => setPaperSize('A4')}
                className={`px-2.5 py-1 font-medium transition-colors cursor-pointer ${
                  paperSize === 'A4'
                    ? 'bg-[var(--color-paper-surface)] text-[var(--color-ink)] border border-[var(--color-rule)]'
                    : 'text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]'
                }`}
              >
                A4
              </button>
            </div>

            {/* Paper Stock */}
            <div
              role="group"
              aria-label="Paper stock finish"
              className="flex items-center border border-[var(--color-rule)] bg-[var(--color-paper-alt)] p-0.5 text-xs"
            >
              <button
                type="button"
                onClick={() => setPaperStock('white')}
                className={`px-2.5 py-1 font-medium transition-colors cursor-pointer ${
                  paperStock === 'white'
                    ? 'bg-[var(--color-paper-surface)] text-[var(--color-ink)] border border-[var(--color-rule)]'
                    : 'text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]'
                }`}
              >
                White Stock
              </button>
              <button
                type="button"
                onClick={() => setPaperStock('newsprint')}
                className={`px-2.5 py-1 font-medium transition-colors cursor-pointer ${
                  paperStock === 'newsprint'
                    ? 'bg-[var(--color-paper-surface)] text-[var(--color-ink)] border border-[var(--color-rule)]'
                    : 'text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]'
                }`}
              >
                Newsprint
              </button>
            </div>

            {/* Preview Scale */}
            <div
              role="group"
              aria-label="Preview sheet scale"
              className="hidden sm:flex items-center border border-[var(--color-rule)] bg-[var(--color-paper-alt)] p-0.5 text-xs"
            >
              {(['compact', 'standard', 'large'] as ZoomLevel[]).map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setZoom(level)}
                  className={`px-2 py-1 font-medium capitalize transition-colors cursor-pointer ${
                    zoom === level
                      ? 'bg-[var(--color-paper-surface)] text-[var(--color-ink)] border border-[var(--color-rule)]'
                      : 'text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]'
                  }`}
                >
                  {level === 'compact' ? '75%' : level === 'standard' ? '100%' : '125%'}
                </button>
              ))}
            </div>

            <button
              type="button"
              disabled={printing || rendering}
              onClick={() => void onDownloadPdf(paperSize, paperStock)}
              className="inline-flex items-center gap-1.5 border border-[var(--color-rule-strong)] bg-[var(--color-paper-surface)] px-3 py-1.5 text-xs font-medium text-[var(--color-ink)] hover:bg-[var(--color-paper-alt)] disabled:opacity-60 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Save {paperSize} PDF</span>
            </button>

            <button
              type="button"
              disabled={printing}
              onClick={() => void onPrintNow(paperSize)}
              className="inline-flex items-center gap-1.5 bg-[var(--color-press-red)] px-3.5 py-1.5 text-xs font-medium text-[#FCF9F5] hover:bg-[#701D16] disabled:opacity-60 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Printer className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{printing ? 'Opening Dialog…' : 'Print Broadsheet'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close print preview"
              className="border border-[var(--color-rule)] bg-[var(--color-paper-surface)] p-1.5 text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] cursor-pointer"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      {/* Metadata Sub-bar */}
      <div className="border-b border-[var(--color-rule)] bg-[var(--color-paper-alt)] px-4 sm:px-6 py-2">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-2 text-xs font-mono text-[var(--color-ink-muted)]">
          <span className="inline-flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5 text-[var(--color-press-red)]" aria-hidden="true" />
            <span>
              {rendering
                ? 'Paginating broadsheet sheets…'
                : `${pages.length} physical sheet${pages.length === 1 ? '' : 's'} · 0.4 in printable margins · Navigation & forms hidden`}
            </span>
          </span>
          <span>Exact-color print CSS active · Esc to close</span>
        </div>
      </div>

      {/* Scrollable Simulated Paper Desk */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-8">
        <div className={`mx-auto ${zoomWidthClass} space-y-8`}>
          {renderError && (
            <div className="border border-[var(--color-press-red)] bg-[var(--color-paper-surface)] p-4 text-xs text-[var(--color-press-red)]">
              {renderError}
            </div>
          )}

          {rendering && pages.length === 0 ? (
            <div className="space-y-6">
              {[1, 2].map((skeletonIdx) => (
                <div
                  key={skeletonIdx}
                  className={`w-full ${paperAspectClass} border border-[var(--color-rule-strong)] bg-[var(--color-paper-surface)] p-6 shadow-2xl flex flex-col justify-between`}
                >
                  <div className="space-y-3 animate-pulse">
                    <div className="h-5 w-2/3 bg-[var(--color-rule)]/60" />
                    <div className="h-3 w-1/2 bg-[var(--color-rule)]/45" />
                    <div className="h-40 w-full bg-[var(--color-rule)]/35 mt-4" />
                    <div className="grid grid-cols-2 gap-4 pt-3">
                      <div className="h-24 bg-[var(--color-rule)]/35" />
                      <div className="h-24 bg-[var(--color-rule)]/35" />
                    </div>
                  </div>
                  <p className="text-center font-mono text-[11px] text-[var(--color-ink-subtle)]">
                    Preparing sheet {skeletonIdx}…
                  </p>
                </div>
              ))}
            </div>
          ) : (
            pages.map((page) => (
              <div key={page.pageNumber} className="space-y-2">
                <div className="flex items-center justify-between text-[11px] font-mono text-[#FCF9F5]/85">
                  <span>
                    Sheet {page.pageNumber} of {pages.length}
                  </span>
                  <span>{paperDimensionsLabel}</span>
                </div>

                <div
                  className={`w-full ${paperAspectClass} ${
                    paperStock === 'newsprint' ? 'bg-[#f7f3ea]' : 'bg-white'
                  } border border-[var(--color-rule-strong)] p-[4.7%] shadow-2xl flex flex-col justify-between overflow-hidden`}
                >
                  <div className="flex-1 min-h-0 border border-dashed border-[var(--color-rule)]/70 p-1 overflow-hidden flex items-start justify-center">
                    <img
                      src={page.dataUrl}
                      alt={`Simulated print sheet ${page.pageNumber} of ${pages.length}`}
                      className="w-full h-auto max-h-full object-contain object-top"
                    />
                  </div>
                  <div className="pt-1.5 text-center font-serif italic text-[10px] text-[var(--color-ink-muted)] shrink-0">
                    The Kalyan Chronicle · Saragadam Kalyan Engineering Broadsheet · Page{' '}
                    {page.pageNumber} of {pages.length}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
