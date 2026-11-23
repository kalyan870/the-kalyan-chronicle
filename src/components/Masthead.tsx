import { Archive, Download } from 'lucide-react';
import { KALYAN_PROFILE } from '../data/chronicleData';
import { BroadsheetQrCode } from './BroadsheetQrCode';

interface MastheadProps {
  editionDate: string;
  publicRepoCount: number;
  onDownloadPdf: () => void;
  exportingPdf: boolean;
  pdfMessage: string | null;
  scanDossierUrl: string;
  onOpenArchive?: () => void;
}

export function Masthead({
  editionDate,
  publicRepoCount,
  onDownloadPdf,
  exportingPdf,
  pdfMessage,
  scanDossierUrl,
  onOpenArchive,
}: MastheadProps) {
  return (
    <section id="top" className="pt-8 pb-6 border-b border-[var(--color-rule-strong)]">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-3 text-xs text-[var(--color-ink-muted)] font-mono tabular-nums">
        <span>Vol. IV · No. 11 · Engineering Monograph</span>
        <span>{editionDate}</span>
        <span>Vignan VIIT CSE · {publicRepoCount} Public Repos</span>
      </div>

      <div className="broadsheet-double-rule py-6 flex flex-col lg:flex-row items-center justify-between gap-6">
        <div className="min-w-0 w-full text-center lg:text-left flex-1">
          <p className="text-xs uppercase tracking-[0.22em] text-[var(--color-press-red)] font-medium mb-2">
            Special Personal Edition · AI Engineering &amp; Full-Stack Systems
          </p>
          <h1 className="font-display w-full max-w-full whitespace-normal text-[clamp(1.35rem,6vw,3rem)] lg:text-[3.75rem] font-extrabold tracking-tight text-[var(--color-ink)] leading-[1.04]">
            <span className="block lg:inline">THE KALYAN</span>{' '}
            <span className="block lg:inline lg:ml-3">CHRONICLE</span>
          </h1>
          <p className="mt-2.5 text-sm sm:text-base text-[var(--color-ink-muted)] max-w-2xl mx-auto lg:mx-0 italic">
            A Broadsheet Dossier on Saragadam Kalyan — Portfolio, LinkedIn, Highlighted Projects, Verified Certificates &amp; Full-Stack Execution
          </p>
        </div>

        <div className="shrink-0 border border-[var(--color-rule)] bg-[var(--color-paper-surface)] p-2.5 max-w-xs">
          <BroadsheetQrCode
            url={scanDossierUrl}
            size={74}
            label="Scan Full Edition QR"
            sublabel="Opens live paper, portfolio, LinkedIn, projects & 12 certificates"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 pt-3 text-xs text-[var(--color-ink-muted)]">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-semibold text-[var(--color-ink)]">{KALYAN_PROFILE.name}</span>
          <span aria-hidden="true">·</span>
          <span>{KALYAN_PROFILE.headline}</span>
          <span aria-hidden="true">·</span>
          <span>{KALYAN_PROFILE.location}</span>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {KALYAN_PROFILE.links.map((item) => (
            <a
              key={item.label}
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className="underline decoration-[var(--color-rule)] underline-offset-4 hover:text-[var(--color-press-red)] hover:decoration-[var(--color-press-red)] transition-colors whitespace-nowrap"
            >
              {item.label}
            </a>
          ))}

          {onOpenArchive && (
            <button
              type="button"
              onClick={onOpenArchive}
              className="no-print inline-flex items-center gap-1.5 border border-[var(--color-rule)] bg-[var(--color-paper-surface)] px-3 py-1.5 text-xs font-medium text-[var(--color-ink)] hover:bg-[var(--color-paper-alt)] transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Archive className="h-3.5 w-3.5 shrink-0 text-[var(--color-press-red)]" aria-hidden="true" />
              <span>Back Issues</span>
            </button>
          )}

          <button
            type="button"
            onClick={onDownloadPdf}
            disabled={exportingPdf}
            className="no-print inline-flex items-center gap-1.5 border border-[var(--color-rule-strong)] bg-[var(--color-paper-surface)] px-3 py-1.5 text-xs font-medium text-[var(--color-ink)] hover:bg-[var(--color-paper-alt)] disabled:opacity-60 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Download className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{exportingPdf ? 'Generating PDF…' : 'Download as PDF'}</span>
          </button>
        </div>
      </div>

      {pdfMessage && (
        <p className="no-print mt-2 text-xs font-mono text-[var(--color-press-red)] text-right">
          {pdfMessage}
        </p>
      )}
    </section>
  );
}
