import { useState } from 'react';
import { Check, Printer, Share2, Terminal, X } from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';
import { ReaderAuthControl } from '../lib/authClient';

interface TopBarProps {
  onPrint: () => void;
  onOpenWorkbench?: () => void;
  printing?: boolean;
  printNotice?: string | null;
  onDismissNotice?: () => void;
}

export function TopBar({
  onPrint,
  onOpenWorkbench,
  printing = false,
  printNotice = null,
  onDismissNotice,
}: TopBarProps) {
  const [shareState, setShareState] = useState<'idle' | 'shared' | 'copied'>('idle');
  const [authError, setAuthError] = useState<string | null>(null);

  async function handleShare() {
    const shareUrl = window.location.href;
    const shareData = {
      title: document.title || 'The Kalyan Chronicle — Engineering Broadsheet',
      text: 'Read The Kalyan Chronicle — live engineering broadsheet, latest projects, and daily workflow digest by Saragadam Kalyan.',
      url: shareUrl,
    };

    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share(shareData);
        setShareState('shared');
        setTimeout(() => setShareState('idle'), 2200);
        return;
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
      }
    }

    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(shareUrl);
        setShareState('copied');
        setTimeout(() => setShareState('idle'), 2200);
        return;
      }
    } catch {
      // Fall through to execCommand fallback
    }

    try {
      const tempInput = document.createElement('textarea');
      tempInput.value = shareUrl;
      tempInput.setAttribute('readonly', '');
      tempInput.style.position = 'fixed';
      tempInput.style.opacity = '0';
      document.body.appendChild(tempInput);
      tempInput.select();
      const copied = document.execCommand('copy');
      document.body.removeChild(tempInput);
      if (copied) {
        setShareState('copied');
        setTimeout(() => setShareState('idle'), 2200);
      }
    } catch {
      // Restricted context; ignore silently
    }
  }

  return (
    <header className="no-print sticky top-0 z-30 border-b border-[var(--color-rule)] bg-[var(--color-paper)]/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-3 sm:gap-8 px-4 sm:px-6 py-3">
        <a
          href="#top"
          className="font-display text-base sm:text-xl font-bold tracking-tight text-[var(--color-ink)] whitespace-nowrap shrink-0"
        >
          The Kalyan Chronicle
        </a>

        <nav
          aria-label="Newspaper sections"
          className="hidden lg:flex items-center gap-6 text-sm font-medium text-[var(--color-ink-muted)]"
        >
          <a
            href="#front-page"
            className="hover:text-[var(--color-ink)] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Front Page
          </a>
          <a
            href="#daily-digest"
            className="hover:text-[var(--color-ink)] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Daily Digest
          </a>
          <a
            href="#workflow-shift"
            className="hover:text-[var(--color-ink)] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Workflow Shift
          </a>
          <a
            href="#package-audit"
            className="hover:text-[var(--color-ink)] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Package Audit
          </a>
          <a
            href="#workbench-desk"
            className="hover:text-[var(--color-ink)] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Lab
          </a>
          <a
            href="#project-index"
            className="hover:text-[var(--color-ink)] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Projects &amp; Archives
          </a>
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          <ReaderAuthControl onAuthNotice={setAuthError} />

          {onOpenWorkbench && (
            <button
              type="button"
              onClick={onOpenWorkbench}
              aria-label="Open Developer Workbench"
              className="inline-flex items-center gap-1.5 border border-[var(--color-rule-strong)] bg-[var(--color-paper-surface)] px-2.5 sm:px-3 py-2 text-xs font-medium text-[var(--color-ink)] hover:bg-[var(--color-paper-alt)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-press-red)] transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Terminal className="h-3.5 w-3.5 shrink-0 text-[var(--color-press-red)]" aria-hidden="true" />
              <span className="sm:hidden">Lab</span>
              <span className="hidden sm:inline">Workbench</span>
            </button>
          )}

          <PWAInstallButton />

          <button
            type="button"
            onClick={() => void handleShare()}
            aria-label="Share this edition"
            className="inline-flex items-center gap-1.5 border border-[var(--color-rule-strong)] bg-[var(--color-paper-surface)] px-2.5 sm:px-3.5 py-2 text-xs font-medium text-[var(--color-ink)] hover:bg-[var(--color-paper-alt)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-press-red)] transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            {shareState === 'idle' ? (
              <Share2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            ) : (
              <Check className="h-3.5 w-3.5 shrink-0 text-[var(--color-press-red)]" aria-hidden="true" />
            )}
            <span>
              {shareState === 'shared'
                ? 'Shared'
                : shareState === 'copied'
                  ? 'Copied'
                  : 'Share'}
            </span>
          </button>

          <button
            type="button"
            onClick={onPrint}
            disabled={printing}
            className="inline-flex items-center gap-1.5 sm:gap-2 bg-[var(--color-press-red)] px-2.5 sm:px-4 py-2 text-xs font-medium tracking-wide text-[#FCF9F5] hover:bg-[#701D16] disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-press-red)] transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Printer className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>
              {printing ? (
                'Preparing…'
              ) : (
                <>
                  Print<span className="hidden sm:inline"> Broadsheet</span>
                </>
              )}
            </span>
          </button>
        </div>
      </div>

      {/* Mobile & Android quick section bar */}
      <nav
        aria-label="Mobile section navigation"
        className="lg:hidden border-t border-[var(--color-rule)] bg-[var(--color-paper-surface)] px-4 py-2 flex items-center gap-4 overflow-x-auto text-xs font-medium text-[var(--color-ink-muted)]"
      >
        <a href="#front-page" className="whitespace-nowrap hover:text-[var(--color-press-red)]">
          Front Page
        </a>
        <a href="#daily-digest" className="whitespace-nowrap hover:text-[var(--color-press-red)]">
          Daily Digest
        </a>
        <a href="#workflow-shift" className="whitespace-nowrap hover:text-[var(--color-press-red)]">
          Workflow Shift
        </a>
        <a href="#package-audit" className="whitespace-nowrap hover:text-[var(--color-press-red)]">
          Package Audit
        </a>
        <a href="#workbench-desk" className="whitespace-nowrap hover:text-[var(--color-press-red)]">
          Workbench
        </a>
        <a href="#project-index" className="whitespace-nowrap hover:text-[var(--color-press-red)]">
          Projects
        </a>
        <a href="#classifieds-subscribe" className="whitespace-nowrap text-[var(--color-press-red)] font-semibold">
          Subscribe
        </a>
      </nav>

      {(printNotice || authError) && (
        <div className="border-t border-[var(--color-rule)] bg-[var(--color-paper-alt)] px-4 sm:px-6 py-2">
          <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-3 text-xs font-mono text-[var(--color-press-red)]">
            <span>{authError || printNotice}</span>
            <button
              type="button"
              onClick={() => {
                if (authError) setAuthError(null);
                else if (onDismissNotice) onDismissNotice();
              }}
              aria-label="Dismiss notice"
              className="text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] cursor-pointer shrink-0"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
