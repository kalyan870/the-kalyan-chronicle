import { useCallback, useEffect, useState } from 'react';
import { Archive, BookmarkPlus, BookOpenCheck, CalendarClock, X } from 'lucide-react';
import type { SavedEditionRecord } from '../data/chronicleData';
import type { DigestState } from './DailyDigestSection';
import { getUnifiedReaderToken, subscribeUnifiedReaderAuth } from '../lib/authClient';

interface AutomationRunItem {
  id: string;
  triggerSource: string;
  status: string;
  editionKey: string;
  commitCount: number;
  substackCount: number;
  newsletterSent: boolean;
  durationMs: number;
  summary: string;
  createdAt: string;
}

interface EditionSnapshotDetail {
  key: string;
  title: string;
  notes?: string;
  savedBy?: string;
  savedAt?: string;
  digest?: DigestState;
}

interface EditionArchiveModalProps {
  open: boolean;
  onClose: () => void;
  onLoadSnapshot?: (snapshotDigest: DigestState, editionTitle: string) => void;
}

function formatArchiveTimestamp(iso: string): string {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return iso;
  return dt.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function EditionArchiveModal({
  open,
  onClose,
  onLoadSnapshot,
}: EditionArchiveModalProps) {
  const [editions, setEditions] = useState<SavedEditionRecord[]>([]);
  const [runs, setRuns] = useState<AutomationRunItem[]>([]);
  const [scheduleLabel, setScheduleLabel] = useState<string>('Daily 07:00 UTC');
  const [loadingList, setLoadingList] = useState<boolean>(false);
  const [listError, setListError] = useState<string | null>(null);

  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [detail, setDetail] = useState<EditionSnapshotDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [signedIn, setSignedIn] = useState<boolean>(false);
  const [archiving, setArchiving] = useState<boolean>(false);
  const [archiveNotice, setArchiveNotice] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeUnifiedReaderAuth((authState) => {
      setSignedIn(authState.signedIn);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  const fetchArchiveIndex = useCallback(async (preferredKey?: string) => {
    setLoadingList(true);
    setListError(null);
    setDetail(null);
    setDetailError(null);

    try {
      const [editionsRes, runsRes] = await Promise.all([
        fetch('/api/r2/editions'),
        fetch('/api/automation/runs'),
      ]);

      if (!editionsRes.ok) {
        throw new Error(`Status ${editionsRes.status}`);
      }
      const editionsData = (await editionsRes.json()) as {
        editions?: SavedEditionRecord[];
      };
      const list = Array.isArray(editionsData.editions) ? editionsData.editions : [];

      let runsList: AutomationRunItem[] = [];
      let sched = 'Daily 07:00 UTC';
      if (runsRes.ok) {
        const runsData = (await runsRes.json()) as {
          runs?: AutomationRunItem[];
          scheduleLabel?: string;
        };
        runsList = Array.isArray(runsData.runs) ? runsData.runs : [];
        if (runsData.scheduleLabel) sched = runsData.scheduleLabel;
      }

      setEditions(list);
      setRuns(runsList.slice(0, 6));
      setScheduleLabel(sched);
      if (preferredKey && list.some((e) => e.key === preferredKey)) {
        setSelectedKey(preferredKey);
      } else if (list.length > 0) {
        setSelectedKey(list[0].key);
      } else {
        setSelectedKey(null);
      }
    } catch {
      setListError('Unable to load archived broadsheet issues right now.');
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setArchiveNotice(null);
    void fetchArchiveIndex();
  }, [open, fetchArchiveIndex]);

  useEffect(() => {
    if (!open || !selectedKey) {
      setDetail(null);
      return;
    }
    let active = true;

    async function fetchEditionDetail() {
      setLoadingDetail(true);
      setDetailError(null);
      try {
        const res = await fetch(
          `/api/r2/editions/detail?key=${encodeURIComponent(selectedKey!)}`
        );
        if (!res.ok) {
          throw new Error(`Status ${res.status}`);
        }
        const payload = (await res.json()) as EditionSnapshotDetail;
        if (active) {
          setDetail(payload);
        }
      } catch {
        if (active) {
          setDetail(null);
          setDetailError('Snapshot body is unavailable for this issue.');
        }
      } finally {
        if (active) {
          setLoadingDetail(false);
        }
      }
    }

    void fetchEditionDetail();
    return () => {
      active = false;
    };
  }, [open, selectedKey]);

  async function handleArchiveCurrentIssue() {
    if (archiving) return;
    setArchiving(true);
    setArchiveNotice(null);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const token = await getUnifiedReaderToken();
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
      const todayLabel = new Date().toISOString().slice(0, 10);
      const res = await fetch('/api/r2/editions', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          title: `Reader Snapshot — ${todayLabel}`,
          notes: 'Saved directly from Back Issues broadsheet archive.',
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        record?: SavedEditionRecord;
      };
      if (!res.ok || !data.ok || !data.record) {
        setArchiveNotice({
          ok: false,
          text:
            res.status === 401
              ? 'Please sign in from the top bar to archive new issues.'
              : data.error || 'Could not archive the current issue right now.',
        });
        return;
      }
      setArchiveNotice({
        ok: true,
        text: `Archived "${data.record.title}" into Back Issues.`,
      });
      await fetchArchiveIndex(data.record.key);
    } catch {
      setArchiveNotice({
        ok: false,
        text: 'Network error saving issue snapshot. Please retry.',
      });
    } finally {
      setArchiving(false);
    }
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="edition-archive-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="no-print fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-3 sm:p-6"
    >
      <div className="w-full max-w-4xl max-h-[88vh] flex flex-col border border-[var(--color-rule-strong)] bg-[var(--color-paper)] text-[var(--color-ink)] shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-rule-strong)] bg-[var(--color-paper-surface)] px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <Archive className="h-4 w-4 text-[var(--color-press-red)]" aria-hidden="true" />
            <div>
              <h2
                id="edition-archive-title"
                className="font-display text-lg sm:text-xl font-bold leading-tight"
              >
                Back Issues &amp; Morning Press Archive
              </h2>
              <p className="text-[11px] font-mono text-[var(--color-ink-muted)]">
                Automated Schedule: {scheduleLabel} · {editions.length} Saved Issues
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {signedIn && (
              <button
                type="button"
                onClick={() => void handleArchiveCurrentIssue()}
                disabled={archiving}
                className="inline-flex items-center gap-1.5 border border-[var(--color-rule-strong)] bg-[var(--color-paper)] px-3 py-1.5 text-xs font-medium text-[var(--color-ink)] hover:bg-[var(--color-paper-alt)] disabled:opacity-60 transition-colors cursor-pointer whitespace-nowrap"
              >
                <BookmarkPlus className="h-3.5 w-3.5 text-[var(--color-press-red)]" aria-hidden="true" />
                <span>{archiving ? 'Archiving…' : 'Archive Current Issue'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              aria-label="Close back issues archive"
              className="border border-[var(--color-rule)] p-1.5 text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] hover:bg-[var(--color-paper-alt)] cursor-pointer"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        {archiveNotice && (
          <div
            className={`border-b border-[var(--color-rule)] px-5 py-2 text-xs font-mono ${
              archiveNotice.ok
                ? 'bg-[var(--color-paper-alt)] text-[var(--color-ink)]'
                : 'bg-[var(--color-paper-alt)] text-[var(--color-press-red)]'
            }`}
          >
            {archiveNotice.text}
          </div>
        )}

        <div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-12">
          {/* Left column: Saved Editions + Press Sync Ledger */}
          <div className="md:col-span-5 border-b md:border-b-0 md:border-r border-[var(--color-rule)] bg-[var(--color-paper-surface)] p-4 space-y-5">
            <div className="space-y-2">
              <p className="text-[11px] uppercase tracking-widest text-[var(--color-press-red)] font-semibold">
                Archived Broadsheet Editions
              </p>

              {loadingList ? (
                <p className="text-xs font-mono text-[var(--color-ink-muted)] py-3">
                  Loading saved editions…
                </p>
              ) : listError ? (
                <p className="text-xs text-[var(--color-press-red)] py-2">{listError}</p>
              ) : editions.length === 0 ? (
                <p className="text-xs text-[var(--color-ink-muted)] py-2">
                  No back issues have been archived yet. Daily automated editions will appear here.
                </p>
              ) : (
                <ul className="divide-y divide-[var(--color-rule)] border-t border-b border-[var(--color-rule)] max-h-60 overflow-y-auto">
                  {editions.map((ed) => {
                    const active = ed.key === selectedKey;
                    return (
                      <li key={ed.key}>
                        <button
                          type="button"
                          onClick={() => setSelectedKey(ed.key)}
                          className={`w-full text-left px-2.5 py-2 transition-colors cursor-pointer ${
                            active
                              ? 'bg-[var(--color-paper-alt)] border-l-2 border-[var(--color-press-red)]'
                              : 'hover:bg-[var(--color-paper)]'
                          }`}
                        >
                          <div className="text-xs font-semibold text-[var(--color-ink)] truncate">
                            {ed.title}
                          </div>
                          <div className="mt-0.5 flex items-center justify-between gap-2 text-[11px] font-mono text-[var(--color-ink-subtle)]">
                            <span>{formatArchiveTimestamp(ed.savedAt)}</span>
                            <span>
                              {ed.repoCount} repos · {ed.commitCount} commits
                            </span>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="space-y-2 pt-1">
              <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-[var(--color-ink-subtle)] font-semibold">
                <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Recent Morning Press Runs</span>
              </div>
              {runs.length === 0 ? (
                <p className="text-xs text-[var(--color-ink-muted)]">
                  No automated sync runs logged in this session.
                </p>
              ) : (
                <ul className="space-y-2 max-h-44 overflow-y-auto">
                  {runs.map((run) => (
                    <li
                      key={run.id}
                      className="border border-[var(--color-rule)] bg-[var(--color-paper)] p-2 text-[11px] space-y-0.5"
                    >
                      <div className="flex items-center justify-between font-mono">
                        <span className="uppercase text-[var(--color-press-red)] font-semibold">
                          {run.status}
                        </span>
                        <span className="text-[var(--color-ink-subtle)]">
                          {formatArchiveTimestamp(run.createdAt)}
                        </span>
                      </div>
                      <p className="text-[var(--color-ink-muted)] leading-snug">{run.summary}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Right column: Selected Snapshot Inspector */}
          <div className="md:col-span-7 p-5 space-y-4">
            {!selectedKey ? (
              <p className="text-xs text-[var(--color-ink-muted)]">
                Select an archived issue from the left ledger to inspect its snapshot.
              </p>
            ) : loadingDetail ? (
              <p className="text-xs font-mono text-[var(--color-ink-muted)]">
                Retrieving issue snapshot…
              </p>
            ) : detailError ? (
              <p className="text-xs text-[var(--color-press-red)]">{detailError}</p>
            ) : detail ? (
              <>
                <div className="border-b border-[var(--color-rule)] pb-3 space-y-1.5">
                  <p className="text-[11px] font-mono uppercase tracking-wider text-[var(--color-press-red)]">
                    Edition Snapshot · {detail.savedAt ? formatArchiveTimestamp(detail.savedAt) : 'Archived'}
                  </p>
                  <h3 className="font-display text-2xl font-bold text-[var(--color-ink)]">
                    {detail.title}
                  </h3>
                  {detail.notes && (
                    <p className="text-xs text-[var(--color-ink-muted)] leading-relaxed">
                      {detail.notes}
                    </p>
                  )}
                </div>

                {detail.digest ? (
                  <div className="space-y-4 text-xs">
                    <div className="grid grid-cols-3 gap-2 font-mono text-center">
                      <div className="border border-[var(--color-rule)] bg-[var(--color-paper-surface)] p-2">
                        <div className="text-base font-bold text-[var(--color-ink)]">
                          {detail.digest.profile?.publicRepos ?? 54}
                        </div>
                        <div className="text-[10px] uppercase text-[var(--color-ink-subtle)]">
                          Public Repos
                        </div>
                      </div>
                      <div className="border border-[var(--color-rule)] bg-[var(--color-paper-surface)] p-2">
                        <div className="text-base font-bold text-[var(--color-ink)]">
                          {detail.digest.commits?.length ?? 0}
                        </div>
                        <div className="text-[10px] uppercase text-[var(--color-ink-subtle)]">
                          Commits Logged
                        </div>
                      </div>
                      <div className="border border-[var(--color-rule)] bg-[var(--color-paper-surface)] p-2">
                        <div className="text-base font-bold text-[var(--color-ink)]">
                          {detail.digest.substackPosts?.length ?? 0}
                        </div>
                        <div className="text-[10px] uppercase text-[var(--color-ink-subtle)]">
                          Substack Notes
                        </div>
                      </div>
                    </div>

                    {detail.digest.commits && detail.digest.commits.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-[11px] uppercase tracking-wider font-semibold text-[var(--color-ink)]">
                          Archived Commit Highlights
                        </p>
                        <ul className="space-y-1.5 border-l-2 border-[var(--color-rule-strong)] pl-3">
                          {detail.digest.commits.slice(0, 4).map((c) => (
                            <li key={`${c.sha}-${c.repo}`}>
                              <span className="font-mono text-[var(--color-press-red)] font-semibold">
                                {c.sha}
                              </span>{' '}
                              <span className="text-[var(--color-ink-muted)]">· {c.repo}</span>
                              <div className="text-[var(--color-ink)]">{c.message}</div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {onLoadSnapshot && (
                      <div className="pt-2">
                        <button
                          type="button"
                          onClick={() => {
                            onLoadSnapshot(detail.digest!, detail.title);
                            onClose();
                          }}
                          className="inline-flex items-center gap-2 bg-[var(--color-press-red)] px-4 py-2 text-xs font-medium text-[#FCF9F5] hover:bg-[#701D16] transition-colors cursor-pointer"
                        >
                          <BookOpenCheck className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Load This Issue Into Broadsheet</span>
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-[var(--color-ink-muted)]">
                    Metadata record available; full digest payload was not stored on this entry.
                  </p>
                )}
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
