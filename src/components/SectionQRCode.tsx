import { QRCodeSVG } from 'qrcode.react';

export interface SectionQRCodeProps {
  url: string;
  label: string;
  sublabel?: string;
  caption?: string;
  size?: number;
}

export function SectionQRCode({
  url,
  label,
  sublabel,
  caption,
  size = 44,
}: SectionQRCodeProps) {
  const isExternal = /^https?:\/\//i.test(url);

  return (
    <div className="mt-6 pt-4 border-t border-[var(--color-rule)] flex flex-wrap items-center justify-between gap-4 print-avoid-break">
      {caption && (
        <p className="text-xs text-[var(--color-ink-muted)]">{caption}</p>
      )}
      <div className="shrink-0 border border-[var(--color-rule)] bg-[var(--color-paper-surface)] px-2.5 py-1.5">
        <a
          href={url}
          target={isExternal ? '_blank' : undefined}
          rel={isExternal ? 'noreferrer' : undefined}
          className="group inline-flex items-center gap-2.5 text-left hover:opacity-90 transition-opacity"
        >
          <div className="shrink-0 border border-[var(--color-rule-strong)] bg-[#fcfaf4] p-1">
            <QRCodeSVG
              value={url}
              size={size}
              level="M"
              bgColor="#fcfaf4"
              fgColor="#161513"
              marginSize={1}
              role="img"
              aria-label={`QR Code: ${label}`}
              className="block"
            />
          </div>
          <div className="min-w-0 space-y-0.5 text-left">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-press-red)] group-hover:underline underline-offset-2">
              {label}
            </p>
            {sublabel && (
              <p className="text-xs leading-snug text-[var(--color-ink-muted)]">
                {sublabel}
              </p>
            )}
          </div>
        </a>
      </div>
    </div>
  );
}
