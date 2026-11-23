import { QRCodeSVG } from 'qrcode.react';

export function buildSectionQrUrl(sectionHash?: string): string {
  if (typeof window === 'undefined') {
    return 'https://kalyannexus.vercel.app/';
  }
  const cleanHash = sectionHash ? `#${sectionHash.replace(/^#/, '')}` : '';
  return `${window.location.origin}/?dossier=scan${cleanHash}`;
}

interface BroadsheetQrCodeProps {
  url: string;
  size?: number;
  label: string;
  sublabel?: string;
  compact?: boolean;
}

export function BroadsheetQrCode({
  url,
  size = 112,
  label,
  sublabel,
  compact = false,
}: BroadsheetQrCodeProps) {
  const effectiveSize = compact ? Math.min(size, 48) : size;
  const isExternal = /^https?:\/\//i.test(url);

  return (
    <a
      href={url}
      target={isExternal ? '_blank' : undefined}
      rel={isExternal ? 'noreferrer' : undefined}
      className="group inline-flex items-center gap-2.5 text-left hover:opacity-90 transition-opacity"
    >
      <div className="shrink-0 border border-[var(--color-rule-strong)] bg-[#fcfaf4] p-1">
        <QRCodeSVG
          value={url}
          size={effectiveSize}
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
          <p className="text-xs leading-snug text-[var(--color-ink-muted)]">{sublabel}</p>
        )}
        {!compact && (
          <p className="font-mono text-[10px] text-[var(--color-ink-subtle)] break-all">
            {url.replace(/^https?:\/\//, '')}
          </p>
        )}
      </div>
    </a>
  );
}
