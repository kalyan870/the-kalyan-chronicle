import { useEffect, useState, type ReactNode } from 'react';
import {
  ClerkProvider,
  SignInButton,
  SignedIn,
  SignedOut,
  UserButton,
  useAuth,
} from '@clerk/clerk-react';
import { LogIn, LogOut } from 'lucide-react';
import {
  getReaderAuthToken,
  signInReader,
  signOutReader,
  subscribeReaderAuth,
  type ReaderUserSummary,
} from './firebase';

const clerkPublishableKey = (import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || '').trim();

export interface UnifiedReaderAuthState {
  signedIn: boolean;
  verified: boolean;
  provider: 'clerk' | 'google' | 'none';
  displayName: string | null;
}

type ClerkTokenGetter = () => Promise<string | null>;

let activeClerkTokenGetter: ClerkTokenGetter | null = null;
let currentClerkAuthState: UnifiedReaderAuthState = {
  signedIn: false,
  verified: false,
  provider: 'none',
  displayName: null,
};
const clerkAuthListeners = new Set<(state: UnifiedReaderAuthState) => void>();

let lastSyncedToken: string | null = null;

async function syncBackendSessionHandshake(
  token: string | null,
  onNotice?: (msg: string | null) => void
): Promise<void> {
  if (!token || token === lastSyncedToken) return;
  lastSyncedToken = token;
  try {
    const res = await fetch('/api/auth/session', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok && onNotice) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      onNotice(data?.error || 'Backend session verification failed.');
    }
  } catch {
    // Ignore transient offline handshake failure
  }
}

function ClerkTokenBridge() {
  const { isLoaded, isSignedIn, userId, getToken } = useAuth();

  useEffect(() => {
    activeClerkTokenGetter = async () => {
      try {
        return (await getToken()) || null;
      } catch {
        return null;
      }
    };
    const nextState: UnifiedReaderAuthState =
      isLoaded && isSignedIn
        ? {
            signedIn: true,
            verified: true,
            provider: 'clerk',
            displayName: userId || 'Subscriber',
          }
        : {
            signedIn: false,
            verified: false,
            provider: 'none',
            displayName: null,
          };
    currentClerkAuthState = nextState;
    for (const listener of clerkAuthListeners) {
      listener(nextState);
    }
    if (isLoaded && isSignedIn) {
      void getToken()
        .then((tok) => syncBackendSessionHandshake(tok || null))
        .catch(() => undefined);
    } else if (isLoaded && !isSignedIn) {
      lastSyncedToken = null;
    }
    return () => {
      activeClerkTokenGetter = null;
    };
  }, [isLoaded, isSignedIn, userId, getToken]);

  return null;
}

export async function getUnifiedReaderToken(): Promise<string | null> {
  if (clerkPublishableKey && activeClerkTokenGetter) {
    return activeClerkTokenGetter();
  }
  return getReaderAuthToken();
}

export function subscribeUnifiedReaderAuth(
  callback: (state: UnifiedReaderAuthState) => void
): () => void {
  if (clerkPublishableKey) {
    clerkAuthListeners.add(callback);
    callback(currentClerkAuthState);
    return () => {
      clerkAuthListeners.delete(callback);
    };
  }
  return subscribeReaderAuth((user) => {
    if (user?.emailVerified) {
      void getReaderAuthToken()
        .then((tok) => syncBackendSessionHandshake(tok))
        .catch(() => undefined);
    } else if (!user) {
      lastSyncedToken = null;
    }
    callback(
      user
        ? {
            signedIn: true,
            verified: user.emailVerified,
            provider: 'google',
            displayName: user.displayName,
          }
        : {
            signedIn: false,
            verified: false,
            provider: 'none',
            displayName: null,
          }
    );
  });
}

export function AuthShell({ children }: { children: ReactNode }) {
  if (!clerkPublishableKey) {
    return <>{children}</>;
  }
  return (
    <ClerkProvider publishableKey={clerkPublishableKey}>
      <ClerkTokenBridge />
      {children}
    </ClerkProvider>
  );
}

interface ReaderAuthControlProps {
  onAuthNotice?: (msg: string | null) => void;
}

export function ReaderAuthControl({ onAuthNotice }: ReaderAuthControlProps) {
  const [readerUser, setReaderUser] = useState<ReaderUserSummary | null>(null);
  const [authBusy, setAuthBusy] = useState<boolean>(false);

  useEffect(() => {
    if (clerkPublishableKey) return;
    const unsubscribe = subscribeReaderAuth((user) => {
      setReaderUser(user);
      if (user) {
        onAuthNotice?.(null);
      }
    });
    return () => unsubscribe();
  }, [onAuthNotice]);

  if (clerkPublishableKey) {
    return (
      <>
        <SignedOut>
          <SignInButton mode="modal">
            <button
              type="button"
              aria-label="Sign in as reader"
              className="inline-flex items-center gap-1.5 border border-[var(--color-rule)] bg-[var(--color-paper-surface)] px-2.5 sm:px-3 py-2 text-xs font-medium text-[var(--color-ink)] hover:bg-[var(--color-paper-alt)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-press-red)] transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <LogIn className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>Sign In</span>
            </button>
          </SignInButton>
        </SignedOut>
        <SignedIn>
          <div className="inline-flex items-center border border-[var(--color-rule)] bg-[var(--color-paper-surface)] p-0.5">
            <UserButton />
          </div>
        </SignedIn>
      </>
    );
  }

  async function handleToggleSignIn() {
    if (authBusy) return;
    setAuthBusy(true);
    onAuthNotice?.(null);
    try {
      if (readerUser) {
        await signOutReader();
      } else {
        const res = await signInReader();
        if (!res.ok && res.error) {
          onAuthNotice?.(res.error);
        }
      }
    } finally {
      setAuthBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleToggleSignIn()}
      disabled={authBusy}
      aria-label={readerUser ? `Signed in as ${readerUser.displayName}. Sign out` : 'Sign in as reader'}
      title={
        readerUser
          ? `${readerUser.email || readerUser.displayName} — Click to sign out`
          : 'Sign in to save reading sessions'
      }
      className="inline-flex items-center gap-1.5 border border-[var(--color-rule)] bg-[var(--color-paper-surface)] px-2.5 sm:px-3 py-2 text-xs font-medium text-[var(--color-ink)] hover:bg-[var(--color-paper-alt)] disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-press-red)] transition-colors cursor-pointer whitespace-nowrap shrink-0"
    >
      {readerUser ? (
        <>
          <LogOut className="h-3.5 w-3.5 shrink-0 text-[var(--color-press-red)]" aria-hidden="true" />
          <span className="hidden sm:inline max-w-[110px] truncate">{readerUser.displayName}</span>
          <span className="sm:hidden">Sign Out</span>
        </>
      ) : (
        <>
          <LogIn className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{authBusy ? 'Signing In…' : 'Sign In'}</span>
        </>
      )}
    </button>
  );
}
