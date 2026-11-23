import html2canvas from 'html2canvas-pro';
import { jsPDF } from 'jspdf';
import type { BroadsheetPaperSize } from './printBroadsheet';

export interface ExportBroadsheetOptions {
  paperSize?: BroadsheetPaperSize;
  paperStock?: 'newsprint' | 'white';
}

export interface RenderedPagePreview {
  pageNumber: number;
  dataUrl: string;
}

export interface RenderedBroadsheetPages {
  paperSize: BroadsheetPaperSize;
  pages: RenderedPagePreview[];
}

async function ensureLazyImagesLoaded(root: HTMLElement): Promise<void> {
  const imgs = Array.from(root.querySelectorAll('img'));
  const pending = imgs.filter((img) => !img.complete || img.naturalWidth === 0);
  if (pending.length === 0) return;

  pending.forEach((img) => {
    img.loading = 'eager';
  });

  await Promise.race([
    Promise.all(
      pending.map(
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
    new Promise<void>((resolve) => setTimeout(resolve, 1500)),
  ]);
}

async function captureBroadsheetCanvas(
  element: HTMLElement,
  backgroundHex: string,
  targetScale: number
): Promise<HTMLCanvasElement> {
  if (document.fonts && document.fonts.ready) {
    await Promise.race([
      document.fonts.ready,
      new Promise<void>((resolve) => setTimeout(resolve, 1500)),
    ]);
  }

  await ensureLazyImagesLoaded(element);

  return html2canvas(element, {
    scale: targetScale,
    useCORS: true,
    allowTaint: false,
    backgroundColor: backgroundHex,
    logging: false,
    windowWidth: 1240,
    ignoreElements: (el) => el.classList.contains('no-print'),
    onclone: (clonedDoc) => {
      const clonedSheet = clonedDoc.querySelector('.broadsheet-sheet') as HTMLElement | null;
      if (clonedSheet) {
        clonedSheet.style.width = '1140px';
        clonedSheet.style.maxWidth = '1140px';
        clonedSheet.style.paddingLeft = '36px';
        clonedSheet.style.paddingRight = '36px';
        clonedSheet.style.backgroundColor = backgroundHex;
      }
      clonedDoc.querySelectorAll('img').forEach((img) => {
        img.style.opacity = '1';
      });
    },
  });
}

function getPaperDimensionsPt(paperSize: BroadsheetPaperSize): { width: number; height: number } {
  // Standard US Letter: 612 x 792 pt; Standard A4: 595.28 x 841.89 pt
  return paperSize === 'A4'
    ? { width: 595.28, height: 841.89 }
    : { width: 612, height: 792 };
}

function sliceCanvasIntoPages(
  canvas: HTMLCanvasElement,
  paperSize: BroadsheetPaperSize,
  backgroundHex: string
): { dataUrl: string; renderedSliceHeightPt: number }[] {
  const { width: pageWidth, height: pageHeight } = getPaperDimensionsPt(paperSize);
  const marginX = 28.8; // 0.4in
  const marginTop = 28.8;
  const marginBottom = 30;
  const printableWidth = pageWidth - marginX * 2;
  const printableHeight = pageHeight - marginTop - marginBottom;

  const pxPerPt = canvas.width / printableWidth;
  const sliceHeightPx = Math.floor(printableHeight * pxPerPt);

  if (canvas.width <= 0 || canvas.height <= 0 || sliceHeightPx <= 0 || !Number.isFinite(pxPerPt)) {
    return [];
  }

  const slices: { dataUrl: string; renderedSliceHeightPt: number }[] = [];
  let yOffsetPx = 0;

  while (yOffsetPx < canvas.height) {
    const currentSliceHeightPx = Math.min(sliceHeightPx, canvas.height - yOffsetPx);
    if (currentSliceHeightPx <= 0) break;
    const sliceCanvas = document.createElement('canvas');
    sliceCanvas.width = canvas.width;
    sliceCanvas.height = currentSliceHeightPx;

    const ctx = sliceCanvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = backgroundHex;
      ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
      ctx.drawImage(
        canvas,
        0,
        yOffsetPx,
        canvas.width,
        currentSliceHeightPx,
        0,
        0,
        canvas.width,
        currentSliceHeightPx
      );
    }

    slices.push({
      dataUrl: sliceCanvas.toDataURL('image/jpeg', 0.92),
      renderedSliceHeightPt: currentSliceHeightPx / pxPerPt,
    });

    yOffsetPx += currentSliceHeightPx;
  }

  return slices;
}

export async function renderBroadsheetPagePreviews(
  element: HTMLElement,
  options: ExportBroadsheetOptions = {}
): Promise<RenderedBroadsheetPages> {
  const paperSize: BroadsheetPaperSize = options.paperSize ?? 'letter';
  const backgroundHex = options.paperStock === 'newsprint' ? '#f7f3ea' : '#ffffff';
  const previewScale = element.scrollHeight > 7000 ? 0.9 : 1.1;

  const canvas = await captureBroadsheetCanvas(element, backgroundHex, previewScale);
  const slices = sliceCanvasIntoPages(canvas, paperSize, backgroundHex);

  return {
    paperSize,
    pages: slices.map((slice, idx) => ({
      pageNumber: idx + 1,
      dataUrl: slice.dataUrl,
    })),
  };
}

export async function exportBroadsheetToPdf(
  element: HTMLElement,
  options: ExportBroadsheetOptions = {}
): Promise<string> {
  const paperSize: BroadsheetPaperSize = options.paperSize ?? 'letter';
  const isNewsprint = options.paperStock !== 'white';
  const backgroundHex = isNewsprint ? '#f7f3ea' : '#ffffff';
  const bgRgb: [number, number, number] = isNewsprint ? [247, 243, 234] : [255, 255, 255];

  const targetScale = element.scrollHeight > 7000 ? 1.35 : 1.75;
  const canvas = await captureBroadsheetCanvas(element, backgroundHex, targetScale);
  const slices = sliceCanvasIntoPages(canvas, paperSize, backgroundHex);

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: paperSize === 'A4' ? 'a4' : 'letter',
    compress: true,
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const marginX = 28.8;
  const marginTop = 28.8;
  const printableWidth = pageWidth - marginX * 2;
  const totalPages = Math.max(1, slices.length);

  slices.forEach((slice, pageIndex) => {
    if (pageIndex > 0) {
      pdf.addPage();
    }

    pdf.setFillColor(bgRgb[0], bgRgb[1], bgRgb[2]);
    pdf.rect(0, 0, pageWidth, pageHeight, 'F');
    pdf.addImage(
      slice.dataUrl,
      'JPEG',
      marginX,
      marginTop,
      printableWidth,
      slice.renderedSliceHeightPt
    );

    pdf.setFont('times', 'italic');
    pdf.setFontSize(8.5);
    pdf.setTextColor(82, 78, 70);
    pdf.text(
      `The Kalyan Chronicle · Saragadam Kalyan Engineering Broadsheet · Page ${pageIndex + 1} of ${totalPages}`,
      pageWidth / 2,
      pageHeight - 12,
      { align: 'center' }
    );
  });

  const filename = `The-Kalyan-Chronicle-${paperSize}-${new Date().toISOString().slice(0, 10)}.pdf`;
  pdf.save(filename);
  return filename;
}
