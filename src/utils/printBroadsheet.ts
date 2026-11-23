export type BroadsheetPaperSize = 'letter' | 'A4';

export interface PrintBroadsheetOptions {
  paperSize?: BroadsheetPaperSize;
}

export interface PrintBroadsheetResult {
  method: 'native' | 'blocked';
}

const PRINT_STYLE_ID = 'broadsheet-print-overrides';

function buildPrintOverrideCss(paperSize: BroadsheetPaperSize): string {
  const pageDimension = paperSize === 'A4' ? 'A4 portrait' : 'letter portrait';

  return `
@media print {
  @page {
    size: ${pageDimension};
    margin: 0.4in;
  }

  html,
  body {
    width: 100% !important;
    max-width: 100% !important;
    margin: 0 !important;
    padding: 0 !important;
    background: #ffffff !important;
    color: #161513 !important;
    font-size: 9.5pt !important;
    line-height: 1.4 !important;
    overflow: visible !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  .no-print,
  header.no-print {
    display: none !important;
  }

  .broadsheet-sheet {
    width: 100% !important;
    max-width: 100% !important;
    margin: 0 !important;
    padding: 0 !important;
    border: none !important;
    box-shadow: none !important;
    background: #ffffff !important;
  }

  section {
    padding-top: 14pt !important;
    padding-bottom: 14pt !important;
  }

  h1 {
    font-size: 28pt !important;
    line-height: 1.05 !important;
    break-after: avoid !important;
    page-break-after: avoid !important;
  }

  h2 {
    font-size: 17pt !important;
    line-height: 1.15 !important;
    break-after: avoid !important;
    page-break-after: avoid !important;
  }

  h3,
  h4 {
    font-size: 12pt !important;
    line-height: 1.22 !important;
    break-after: avoid !important;
    page-break-after: avoid !important;
  }

  article,
  figure,
  blockquote,
  tr,
  .print-avoid-break,
  #final-qr-code {
    break-inside: avoid !important;
    page-break-inside: avoid !important;
  }

  figure img {
    max-width: 100% !important;
    max-height: 2.65in !important;
    width: auto !important;
    height: auto !important;
    object-fit: contain !important;
  }

  svg {
    max-width: 100% !important;
  }

  table {
    width: 100% !important;
    table-layout: fixed !important;
    font-size: 8.25pt !important;
  }

  th,
  td {
    overflow-wrap: break-word !important;
    word-break: break-word !important;
    padding-top: 4pt !important;
    padding-bottom: 4pt !important;
  }

  .overflow-x-auto {
    overflow: visible !important;
  }

  a {
    color: #161513 !important;
    text-decoration: none !important;
  }
}
`.trim();
}

function injectPrintStyleSheet(paperSize: BroadsheetPaperSize): HTMLStyleElement {
  const existing = document.getElementById(PRINT_STYLE_ID);
  if (existing) {
    existing.remove();
  }

  const styleEl = document.createElement('style');
  styleEl.id = PRINT_STYLE_ID;
  styleEl.media = 'print';
  styleEl.textContent = buildPrintOverrideCss(paperSize);
  document.head.appendChild(styleEl);
  document.documentElement.dataset.broadsheetPaper = paperSize;
  return styleEl;
}

function cleanupPrintStyleSheet(): void {
  const existing = document.getElementById(PRINT_STYLE_ID);
  if (existing) {
    existing.remove();
  }
  delete document.documentElement.dataset.broadsheetPaper;
}

export async function printBroadsheet(
  options: PrintBroadsheetOptions = {}
): Promise<PrintBroadsheetResult> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return { method: 'blocked' };
  }

  const paperSize: BroadsheetPaperSize = options.paperSize ?? 'letter';
  injectPrintStyleSheet(paperSize);

  const lazyImgs = Array.from(document.querySelectorAll('img[loading="lazy"]')) as HTMLImageElement[];
  const pendingImgs = lazyImgs.filter((img) => !img.complete || img.naturalWidth === 0);
  if (pendingImgs.length > 0) {
    pendingImgs.forEach((img) => {
      img.loading = 'eager';
    });
    await Promise.race([
      Promise.all(
        pendingImgs.map(
          (img) =>
            new Promise<void>((resolve) => {
              if (img.complete) {
                resolve();
                return;
              }
              img.addEventListener('load', () => resolve(), { once: true });
              img.addEventListener('error', () => resolve(), { once: true });
            })
        )
      ),
      new Promise<void>((resolve) => setTimeout(resolve, 1000)),
    ]);
  }

  if (document.fonts && document.fonts.ready) {
    await Promise.race([
      document.fonts.ready,
      new Promise<void>((resolve) => setTimeout(resolve, 600)),
    ]);
  }

  let printDialogOpened = false;
  const onBeforePrint = () => {
    printDialogOpened = true;
  };
  const onAfterPrint = () => {
    cleanupPrintStyleSheet();
    window.removeEventListener('afterprint', onAfterPrint);
  };

  window.addEventListener('beforeprint', onBeforePrint, { once: true });
  window.addEventListener('afterprint', onAfterPrint);

  try {
    window.print();
  } catch {
    printDialogOpened = false;
  }

  await new Promise<void>((resolve) => setTimeout(resolve, 400));
  window.removeEventListener('beforeprint', onBeforePrint);

  if (!printDialogOpened) {
    window.removeEventListener('afterprint', onAfterPrint);
    cleanupPrintStyleSheet();
    return { method: 'blocked' };
  }

  // Fallback cleanup in case afterprint does not fire after dialog closes
  setTimeout(() => {
    window.removeEventListener('afterprint', onAfterPrint);
    cleanupPrintStyleSheet();
  }, 1500);

  return { method: 'native' };
}
