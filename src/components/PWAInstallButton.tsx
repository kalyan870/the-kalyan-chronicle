import { useState } from 'react';
import { Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export function PWAInstallButton() {
  const { isInstallable, isInstalled, isIOS, isAndroid, install } = usePWAInstall();
  const [guideMode, setGuideMode] = useState<'ios' | 'android' | null>(null);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={() => void install()}
        aria-label="Install The Kalyan Chronicle app"
        className="inline-flex items-center gap-1.5 border border-[var(--color-rule-strong)] bg-[var(--color-paper-surface)] px-2.5 sm:px-3 py-2 text-xs font-medium text-[var(--color-ink)] hover:bg-[var(--color-paper-alt)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-press-red)] transition-colors cursor-pointer whitespace-nowrap shrink-0"
      >
        <Smartphone className="h-3.5 w-3.5 shrink-0 text-[var(--color-press-red)]" aria-hidden="true" />
        <span>Install App</span>
      </button>
    );
  }

  if (isIOS || isAndroid) {
    return (
      <>
        <button
          type="button"
          onClick={() => setGuideMode(isIOS ? 'ios' : 'android')}
          aria-label="Install app on mobile device"
          className="inline-flex items-center gap-1.5 border border-[var(--color-rule-strong)] bg-[var(--color-paper-surface)] px-2.5 sm:px-3 py-2 text-xs font-medium text-[var(--color-ink)] hover:bg-[var(--color-paper-alt)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-press-red)] transition-colors cursor-pointer whitespace-nowrap shrink-0"
        >
          <Smartphone className="h-3.5 w-3.5 shrink-0 text-[var(--color-press-red)]" aria-hidden="true" />
          <span>Install App</span>
        </button>

        {guideMode && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-sm border-2 border-[var(--color-rule-strong)] bg-[var(--color-paper)] p-5 space-y-3 shadow-xl">
              <div className="flex items-start justify-between gap-3 border-b border-[var(--color-rule)] pb-2">
                <div>
                  <p className="text-[11px] uppercase tracking-widest text-[var(--color-press-red)] font-medium">
                    Mobile App Edition
                  </p>
                  <h3 className="font-display text-lg font-bold text-[var(--color-ink)]">
                    {guideMode === 'ios' ? 'Install on iPhone / iPad' : 'Install on Android'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setGuideMode(null)}
                  aria-label="Close install instructions"
                  className="text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] cursor-pointer"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>

              {guideMode === 'ios' ? (
                <ol className="space-y-1.5 text-xs text-[var(--color-ink)] list-decimal pl-4 leading-relaxed">
                  <li>
                    Tap the <strong>Share</strong> icon in the Safari toolbar.
                  </li>
                  <li>
                    Scroll down and select <strong>Add to Home Screen</strong>.
                  </li>
                  <li>Launch The Kalyan Chronicle as a standalone offline-ready app.</li>
                </ol>
              ) : (
                <ol className="space-y-1.5 text-xs text-[var(--color-ink)] list-decimal pl-4 leading-relaxed">
                  <li>
                    Open this page directly in <strong>Chrome</strong> on Android (outside embedded preview if shown).
                  </li>
                  <li>
                    Tap Chrome’s menu (<strong>⋮</strong>) and choose <strong>Install app</strong> or{' '}
                    <strong>Add to Home screen</strong>.
                  </li>
                  <li>
                    Once installed, the latest cached broadsheet edition remains readable offline.
                  </li>
                </ol>
              )}

              <button
                type="button"
                onClick={() => setGuideMode(null)}
                className="w-full bg-[var(--color-press-red)] py-2 text-xs font-medium text-[#FCF9F5] hover:bg-[#701D16] transition-colors cursor-pointer"
              >
                Got It
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
}
