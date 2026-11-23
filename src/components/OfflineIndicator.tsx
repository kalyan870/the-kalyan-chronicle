import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export function OfflineIndicator() {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="no-print fixed bottom-4 left-4 right-4 sm:right-auto z-50 flex items-center gap-2.5 border border-[var(--color-press-red)] bg-[var(--color-paper-surface)] px-3.5 py-2 text-xs font-medium text-[var(--color-ink)] shadow-lg"
    >
      <WifiOff className="h-3.5 w-3.5 shrink-0 text-[var(--color-press-red)]" aria-hidden="true" />
      <span>Offline Edition — Reading latest cached broadsheet.</span>
    </div>
  );
}
