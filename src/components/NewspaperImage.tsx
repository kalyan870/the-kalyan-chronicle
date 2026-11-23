import { useEffect, useRef, useState } from 'react';
import { FileImage } from 'lucide-react';
import { publicAssetUrl } from '../utils/publicAssetUrl';

interface NewspaperImageProps {
  src: string;
  alt: string;
  caption: string;
  aspectClass?: string;
  imgClassName?: string;
  priority?: boolean;
}

export function NewspaperImage({
  src,
  alt,
  caption,
  aspectClass = 'aspect-[4/3]',
  imgClassName = 'object-cover object-center',
  priority = false,
}: NewspaperImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const resolvedSrc = publicAssetUrl(src);

  useEffect(() => {
    setLoaded(false);
    setFailed(false);
    const img = imgRef.current;
    if (img && img.complete) {
      if (img.naturalWidth > 0) {
        setLoaded(true);
      } else if (img.currentSrc) {
        setFailed(true);
        setLoaded(true);
      }
    }
  }, [resolvedSrc]);

  return (
    <div className="space-y-2 print-avoid-break">
      <div
        className={`relative w-full overflow-hidden border border-[var(--color-rule-strong)] bg-[var(--color-paper-alt)] ${aspectClass}`}
      >
        {!loaded && !failed && (
          <div
            aria-hidden="true"
            className="no-print absolute inset-0 z-10 flex flex-col justify-between bg-[var(--color-paper-alt)] p-4 animate-pulse"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="h-2.5 w-20 bg-[var(--color-rule)]/70" />
              <div className="h-2.5 w-12 bg-[var(--color-rule)]/50" />
            </div>
            <div className="mx-auto flex flex-col items-center gap-2 text-[var(--color-ink-subtle)]">
              <FileImage className="h-7 w-7 stroke-[1.35] opacity-60" />
              <span className="font-mono text-[10px] uppercase tracking-widest opacity-75">
                Loading Plate…
              </span>
            </div>
            <div className="space-y-1.5">
              <div className="h-2 w-3/4 bg-[var(--color-rule)]/60" />
              <div className="h-2 w-1/2 bg-[var(--color-rule)]/45" />
            </div>
          </div>
        )}

        {!failed ? (
          <img
            ref={imgRef}
            src={resolvedSrc}
            alt={alt}
            loading={priority ? 'eager' : 'lazy'}
            fetchPriority={priority ? 'high' : 'auto'}
            decoding="async"
            referrerPolicy="no-referrer"
            onLoad={() => setLoaded(true)}
            onError={() => {
              setFailed(true);
              setLoaded(true);
            }}
            className={`h-full w-full transition-opacity duration-300 ${
              loaded ? 'opacity-100' : 'opacity-0'
            } ${imgClassName}`}
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-6 text-center text-[var(--color-ink-muted)]">
            <FileImage className="h-8 w-8 stroke-[1.5]" aria-hidden="true" />
            <p className="font-display text-sm font-semibold text-[var(--color-ink)]">{alt}</p>
            <p className="text-xs max-w-sm">Archival broadsheet plate placeholder</p>
          </div>
        )}
      </div>
      <figcaption className="text-xs italic text-[var(--color-ink-muted)] leading-snug">
        {caption}
      </figcaption>
    </div>
  );
}
