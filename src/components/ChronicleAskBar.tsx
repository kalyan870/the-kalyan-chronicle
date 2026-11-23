import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import {
  BookOpen,
  CornerDownLeft,
  ExternalLink,
  History,
  Plus,
  RotateCcw,
  Search,
} from 'lucide-react';
import {
  archiveReaderSession,
  listReaderSessions,
  loadReaderSessionMemories,
  syncReaderSessionTurn,
  type ReaderSessionSummary,
} from '../lib/firebase';
import { getUnifiedReaderToken, subscribeUnifiedReaderAuth } from '../lib/authClient';
import { toSafeExternalHref } from '../utils/safeUrl';

interface CitationItem {
  id: string;
  title: string;
  section: string;
  url?: string;
}

interface EditionThreadTurn {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: CitationItem[];
  telemetry?: {
    latencyMs: number;
    corpusCount: number;
    citedCount: number;
    retrievalMode: 'synthesized' | 'grounded-index';
  };
}

const SESSION_STORAGE_KEY = 'kalyan_chronicle_reader_session_v1';

const SUGGESTED_QUESTIONS = [
  'What is InterviewIQ AI built with?',
  'Summarize verified certificates',
  'Tell me about his internships',
];

function createFreshSessionId(): string {
  return `ed_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function getOrCreateReaderSessionId(): string {
  if (typeof window === 'undefined') return 'default-edition-session';
  try {
    const existing = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (existing && /^[a-zA-Z0-9_-]{4,80}$/.test(existing)) {
      return existing;
    }
    const created = createFreshSessionId();
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, created);
    return created;
  } catch {
    return 'default-edition-session';
  }
}

export function ChronicleAskBar() {
  const [sessionId, setSessionId] = useState<string>(() => getOrCreateReaderSessionId());
  const [query, setQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [turns, setTurns] = useState<EditionThreadTurn[]>([]);

  const [signedInVerified, setSignedInVerified] = useState<boolean>(false);
  const [canBrowseSavedThreads, setCanBrowseSavedThreads] = useState<boolean>(false);
  const [pastSessions, setPastSessions] = useState<ReaderSessionSummary[]>([]);
  const [showSessions, setShowSessions] = useState<boolean>(false);
  const [loadingSessions, setLoadingSessions] = useState<boolean>(false);
  const wasSignedInRef = useRef<boolean>(false);

  const refreshSavedSessions = useCallback(async () => {
    setLoadingSessions(true);
    try {
      const list = await listReaderSessions();
      setPastSessions(list);
    } catch {
      // Non-fatal if session index cannot be refreshed
    } finally {
      setLoadingSessions(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeUnifiedReaderAuth((authState) => {
      const verified = authState.signedIn && authState.verified;
      const supportsCloudHistory = verified && authState.provider === 'google';

      if (wasSignedInRef.current && !authState.signedIn) {
        const nextId = createFreshSessionId();
        setTurns([]);
        setError(null);
        setSessionId(nextId);
        try {
          window.sessionStorage.setItem(SESSION_STORAGE_KEY, nextId);
        } catch {
          // Ignore storage failures
        }
      }
      wasSignedInRef.current = authState.signedIn;

      setSignedInVerified(verified);
      setCanBrowseSavedThreads(supportsCloudHistory);
      if (supportsCloudHistory) {
        void refreshSavedSessions();
      } else {
        setPastSessions([]);
        setShowSessions(false);
      }
    });
    return () => unsubscribe();
  }, [refreshSavedSessions]);

  useEffect(() => {
    let active = true;
    async function restoreThread() {
      try {
        const headers: Record<string, string> = {};
        const idToken = await getUnifiedReaderToken();
        if (idToken) {
          headers.Authorization = `Bearer ${idToken}`;
        }
        const res = await fetch(`/api/rag/memory?sessionId=${encodeURIComponent(sessionId)}`, {
          headers,
        });
        if (!res.ok) return;
        const data = (await res.json()) as {
          messages?: Array<{
            id: string;
            role: 'user' | 'assistant';
            content: string;
            citations?: CitationItem[];
          }>;
        };
        if (active && Array.isArray(data.messages)) {
          setTurns(data.messages);
        }
      } catch {
        // Offline or initial load
      }
    }
    void restoreThread();
    return () => {
      active = false;
    };
  }, [sessionId]);

  async function handleSelectSession(targetSessionId: string) {
    setShowSessions(false);
    setError(null);
    setSessionId(targetSessionId);
    try {
      window.sessionStorage.setItem(SESSION_STORAGE_KEY, targetSessionId);
    } catch {
      // Ignore storage failures
    }

    try {
      const storedTurns = await loadReaderSessionMemories(targetSessionId);
      if (storedTurns.length > 0) {
        setTurns(
          storedTurns.map((t) => ({
            id: t.id,
            role: t.role,
            content: t.content,
            citations: t.citationTitles.map((title, idx) => ({
              id: `${t.id}_cit_${idx}`,
              title,
              section: '#project-index',
            })),
          }))
        );
        return;
      }
    } catch {
      // Fall back to server session memory endpoint handled by useEffect
    }
  }

  function handleStartNewSession() {
    const nextId = createFreshSessionId();
    setShowSessions(false);
    setError(null);
    setTurns([]);
    setSessionId(nextId);
    try {
      window.sessionStorage.setItem(SESSION_STORAGE_KEY, nextId);
    } catch {
      // Ignore storage failures
    }
  }

  async function submitQuestion(text: string) {
    const clean = text.trim();
    if (!clean || loading) return;

    setLoading(true);
    setError(null);

    const userTurnId = `u_${Date.now()}`;
    const assistantTurnId = `a_${Date.now() + 1}`;
    const userTurn: EditionThreadTurn = {
      id: userTurnId,
      role: 'user',
      content: clean,
    };

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const idToken = await getUnifiedReaderToken();
      if (idToken) {
        headers.Authorization = `Bearer ${idToken}`;
      }

      const streamRes = await fetch('/api/rag/stream', {
        method: 'POST',
        headers,
        body: JSON.stringify({ query: clean, sessionId }),
      });

      const contentType = streamRes.headers.get('content-type') || '';
      if (streamRes.ok && contentType.includes('text/event-stream') && streamRes.body) {
        const assistantPlaceholder: EditionThreadTurn = {
          id: assistantTurnId,
          role: 'assistant',
          content: '',
          citations: [],
        };
        setTurns((prev) => [...prev, userTurn, assistantPlaceholder].slice(-8));
        setQuery('');

        const reader = streamRes.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let finalAnswer = '';
        let finalCitations: CitationItem[] = [];
        let finalTelemetry: EditionThreadTurn['telemetry'];

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const frames = buffer.split('\n\n');
          buffer = frames.pop() || '';

          for (const frame of frames) {
            const eventLine = frame.split('\n').find((l) => l.startsWith('event: '));
            const dataLine = frame.split('\n').find((l) => l.startsWith('data: '));
            if (!dataLine) continue;
            const eventType = eventLine ? eventLine.slice(7).trim() : 'message';
            const payload = JSON.parse(dataLine.slice(6)) as {
              text?: string;
              answer?: string;
              citations?: CitationItem[];
              telemetry?: EditionThreadTurn['telemetry'];
              error?: string;
            };

            if (eventType === 'citations' && Array.isArray(payload.citations)) {
              finalCitations = payload.citations;
              setTurns((prev) =>
                prev.map((t) =>
                  t.id === assistantTurnId ? { ...t, citations: finalCitations } : t
                )
              );
            } else if (eventType === 'delta' && payload.text) {
              finalAnswer += payload.text;
              const snapshot = finalAnswer;
              setTurns((prev) =>
                prev.map((t) => (t.id === assistantTurnId ? { ...t, content: snapshot } : t))
              );
            } else if (eventType === 'done') {
              if (payload.answer) finalAnswer = payload.answer;
              if (Array.isArray(payload.citations)) finalCitations = payload.citations;
              if (payload.telemetry) finalTelemetry = payload.telemetry;
              setTurns((prev) =>
                prev.map((t) =>
                  t.id === assistantTurnId
                    ? {
                        ...t,
                        content: finalAnswer,
                        citations: finalCitations,
                        telemetry: finalTelemetry,
                      }
                    : t
                )
              );
            } else if (eventType === 'error') {
              setError(payload.error || 'Streaming lookup interrupted.');
            }
          }
        }

        if (finalAnswer) {
          void syncReaderSessionTurn({
            sessionId,
            userContent: clean,
            assistantContent: finalAnswer,
            citationTitles: finalCitations.map((c) => c.title),
          })
            .then(() => refreshSavedSessions())
            .catch(() => undefined);
        }
        return;
      }

      // Standard JSON fallback
      const res = streamRes.ok
        ? streamRes
        : await fetch('/api/rag/query', {
            method: 'POST',
            headers,
            body: JSON.stringify({ query: clean, sessionId }),
          });

      const data = (await res.json()) as {
        ok?: boolean;
        answer?: string;
        citations?: CitationItem[];
        telemetry?: EditionThreadTurn['telemetry'];
        error?: string;
      };

      if (!res.ok || !data.ok) {
        setError(data.answer || data.error || 'Unable to process your edition lookup.');
      } else {
        const assistantTurn: EditionThreadTurn = {
          id: assistantTurnId,
          role: 'assistant',
          content: data.answer || '',
          citations: data.citations || [],
          telemetry: data.telemetry,
        };
        setTurns((prev) => [...prev, userTurn, assistantTurn].slice(-8));
        setQuery('');
        void syncReaderSessionTurn({
          sessionId,
          userContent: clean,
          assistantContent: data.answer || '',
          citationTitles: (data.citations || []).map((c) => c.title),
        })
          .then(() => refreshSavedSessions())
          .catch(() => undefined);
      }
    } catch {
      setError('Edition desk is temporarily unreachable. Please retry when online.');
    } finally {
      setLoading(false);
    }
  }

  async function handleClearThread() {
    setError(null);
    setTurns([]);
    try {
      const headers: Record<string, string> = {};
      const idToken = await getUnifiedReaderToken();
      if (idToken) {
        headers.Authorization = `Bearer ${idToken}`;
      }
      await fetch(`/api/rag/memory?sessionId=${encodeURIComponent(sessionId)}`, {
        method: 'DELETE',
        headers,
      });
      if (canBrowseSavedThreads) {
        void archiveReaderSession(sessionId)
          .then(() => refreshSavedSessions())
          .catch(() => undefined);
      }
    } catch {
      // Ignore clear failure
    }
  }

  function handleFormSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    void submitQuestion(query);
  }

  return (
    <div className="no-print mt-6 border border-[var(--color-rule-strong)] bg-[var(--color-paper-surface)] p-4 sm:p-5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-rule)] pb-2.5">
        <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-[var(--color-press-red)] font-medium">
          <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Edition Desk &amp; Archive Lookup</span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {canBrowseSavedThreads && (
            <button
              type="button"
              onClick={() => {
                const nextOpen = !showSessions;
                setShowSessions(nextOpen);
                if (nextOpen) {
                  void refreshSavedSessions();
                }
              }}
              aria-expanded={showSessions}
              className="inline-flex items-center gap-1 text-xs text-[var(--color-ink-muted)] hover:text-[var(--color-press-red)] cursor-pointer"
            >
              <History className="h-3 w-3" aria-hidden="true" />
              <span>
                Past Inquiries{pastSessions.length > 0 ? ` (${pastSessions.length})` : ''}
              </span>
            </button>
          )}

          {signedInVerified && (
            <button
              type="button"
              onClick={handleStartNewSession}
              className="inline-flex items-center gap-1 text-xs text-[var(--color-ink-muted)] hover:text-[var(--color-press-red)] cursor-pointer"
            >
              <Plus className="h-3 w-3" aria-hidden="true" />
              <span>New Inquiry</span>
            </button>
          )}

          {turns.length > 0 && (
            <button
              type="button"
              onClick={() => void handleClearThread()}
              className="inline-flex items-center gap-1 text-xs text-[var(--color-ink-muted)] hover:text-[var(--color-press-red)] cursor-pointer"
            >
              <RotateCcw className="h-3 w-3" aria-hidden="true" />
              <span>Clear Thread</span>
            </button>
          )}
        </div>
      </div>

      {canBrowseSavedThreads && showSessions && (
        <div className="border border-[var(--color-rule)] bg-[var(--color-paper)] p-3 space-y-2">
          <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-[var(--color-ink-subtle)]">
            <span>Saved Reader Inquiries</span>
            {loadingSessions && <span className="font-mono">Loading…</span>}
          </div>
          {pastSessions.length === 0 ? (
            <p className="text-xs text-[var(--color-ink-muted)]">
              No saved inquiries yet. Ask a question while signed in to archive your reading thread.
            </p>
          ) : (
            <ul className="divide-y divide-[var(--color-rule)] max-h-44 overflow-y-auto">
              {pastSessions.map((sess) => {
                const isCurrent = sess.id === sessionId;
                const dateLabel =
                  sess.updatedAtMs > 0
                    ? new Date(sess.updatedAtMs).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })
                    : 'Saved';
                return (
                  <li key={sess.id}>
                    <button
                      type="button"
                      onClick={() => void handleSelectSession(sess.id)}
                      className={`w-full flex items-center justify-between gap-3 py-1.5 px-1 text-left text-xs transition-colors cursor-pointer ${
                        isCurrent
                          ? 'font-semibold text-[var(--color-press-red)]'
                          : 'text-[var(--color-ink)] hover:text-[var(--color-press-red)]'
                      }`}
                    >
                      <span className="truncate">{sess.title}</span>
                      <span className="font-mono text-[11px] text-[var(--color-ink-subtle)] shrink-0">
                        {isCurrent ? 'Active' : dateLabel}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      <form onSubmit={handleFormSubmit} className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search
            className="h-3.5 w-3.5 text-[var(--color-ink-subtle)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            maxLength={800}
            aria-label="Ask this edition about Saragadam Kalyan's work"
            placeholder="Ask about projects, internships, architecture, commits, or certificates…"
            className="w-full border border-[var(--color-rule)] bg-[var(--color-paper)] pl-8 pr-3 py-2 text-xs text-[var(--color-ink)] focus:outline-2 focus:outline-[var(--color-press-red)]"
          />
        </div>
        <button
          type="submit"
          disabled={loading || query.trim().length < 2}
          className="inline-flex items-center justify-center gap-1.5 bg-[var(--color-press-red)] px-4 py-2 text-xs font-medium text-[#FCF9F5] hover:bg-[#701D16] disabled:opacity-55 transition-colors cursor-pointer whitespace-nowrap"
        >
          <span>{loading ? 'Consulting Desk…' : 'Ask Edition'}</span>
          <CornerDownLeft className="h-3 w-3" aria-hidden="true" />
        </button>
      </form>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-[var(--color-ink-muted)]">
        <span className="uppercase tracking-wider text-[10px] text-[var(--color-ink-subtle)]">
          Quick Queries:
        </span>
        {SUGGESTED_QUESTIONS.map((sample) => (
          <button
            key={sample}
            type="button"
            onClick={() => {
              setQuery(sample);
              void submitQuestion(sample);
            }}
            className="underline decoration-[var(--color-rule)] underline-offset-4 hover:text-[var(--color-press-red)] cursor-pointer text-left"
          >
            {sample}
          </button>
        ))}
      </div>

      {error && (
        <p className="text-xs text-[var(--color-press-red)] border-t border-[var(--color-rule)] pt-2">
          {error}
        </p>
      )}

      {turns.length > 0 && (
        <div className="border-t border-[var(--color-rule)] pt-3 space-y-3 max-h-72 overflow-y-auto">
          {turns.slice(-4).map((turn) => (
            <div
              key={turn.id}
              className={
                turn.role === 'user'
                  ? 'text-xs font-semibold text-[var(--color-ink)]'
                  : 'text-xs leading-relaxed text-[var(--color-ink)] bg-[var(--color-paper)] border-l-2 border-[var(--color-press-red)] pl-3 py-1.5 space-y-1.5'
              }
            >
              {turn.role === 'user' ? (
                <p>Reader Inquiry: {turn.content}</p>
              ) : (
                <>
                  <p>{turn.content}</p>
                  {turn.citations && turn.citations.length > 0 && (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-mono text-[var(--color-ink-muted)]">
                      <span>Sources:</span>
                      {turn.citations.map((cit) =>
                        cit.url ? (
                          <a
                            key={cit.id}
                            href={toSafeExternalHref(cit.url, '#project-index')}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-0.5 underline underline-offset-2 hover:text-[var(--color-press-red)]"
                          >
                            <span>{cit.title}</span>
                            <ExternalLink className="h-2.5 w-2.5" aria-hidden="true" />
                          </a>
                        ) : (
                          <a
                            key={cit.id}
                            href={toSafeExternalHref(cit.section, '#project-index')}
                            className="underline underline-offset-2 hover:text-[var(--color-press-red)]"
                          >
                            {cit.title}
                          </a>
                        )
                      )}
                    </div>
                  )}
                  {turn.telemetry && (
                    <p className="text-[10px] font-mono text-[var(--color-ink-subtle)]">
                      Retrieval telemetry: {turn.telemetry.latencyMs}ms · {turn.telemetry.citedCount}/{turn.telemetry.corpusCount} indexed sources ·{' '}
                      {turn.telemetry.retrievalMode === 'synthesized' ? 'AI synthesized' : 'Deterministic match'}
                    </p>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
