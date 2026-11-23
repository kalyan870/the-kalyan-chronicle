import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDocFromServer,
  getDocs,
  getFirestore,
  limit,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

export interface ReaderUserSummary {
  uid: string;
  displayName: string;
  email: string | null;
  emailVerified: boolean;
}

function toReaderSummary(user: User | null): ReaderUserSummary | null {
  if (!user) return null;
  return {
    uid: user.uid,
    displayName: (user.displayName || user.email?.split('@')[0] || 'Chronicle Reader').trim(),
    email: user.email,
    emailVerified: user.emailVerified,
  };
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testConnection(): Promise<boolean> {
  if (!auth.currentUser || !auth.currentUser.emailVerified) {
    return true;
  }
  try {
    await getDocFromServer(doc(db, 'readers', auth.currentUser.uid));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
      return false;
    }
    return true;
  }
}

export async function getFirebaseIdTokenIfSignedIn(): Promise<string | null> {
  try {
    if (!auth.currentUser) return null;
    return await auth.currentUser.getIdToken();
  } catch {
    return null;
  }
}

export const getReaderAuthToken = getFirebaseIdTokenIfSignedIn;

export function subscribeReaderAuth(callback: (user: ReaderUserSummary | null) => void): () => void {
  return onAuthStateChanged(auth, (user) => {
    callback(toReaderSummary(user));
  });
}

export async function signInReader(): Promise<{ ok: boolean; user?: ReaderUserSummary; error?: string }> {
  try {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const credential = await signInWithPopup(auth, provider);
    const summary = toReaderSummary(credential.user);
    if (credential.user.emailVerified) {
      const uid = sanitizeId(credential.user.uid);
      if (uid === credential.user.uid) {
        const readerRef = doc(db, 'readers', uid);
        try {
          const snap = await getDocFromServer(readerRef);
          if (!snap.exists()) {
            const displayName =
              (credential.user.displayName || 'Edition Reader').trim().slice(0, 80) || 'Edition Reader';
            await setDoc(readerRef, {
              userId: uid,
              displayName,
              createdAt: serverTimestamp(),
            });
          }
        } catch {
          // Non-fatal if profile sync is deferred until next query
        }
      }
    }
    return { ok: true, user: summary || undefined };
  } catch (error) {
    const code = (error as { code?: string } | null)?.code || '';
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
      return { ok: false, error: 'Sign-in window closed before completing.' };
    }
    if (code === 'auth/popup-blocked') {
      return { ok: false, error: 'Browser blocked the sign-in popup. Please allow popups for this tab.' };
    }
    return { ok: false, error: 'Unable to complete sign-in right now.' };
  }
}

export async function signOutReader(): Promise<void> {
  try {
    await signOut(auth);
  } catch {
    // Ignore sign-out errors
  }
}

function sanitizeId(raw: string): string {
  const clean = raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
  return clean || 'default_session';
}

export async function syncReaderSessionTurn(input: {
  sessionId: string;
  userContent: string;
  assistantContent: string;
  citationTitles?: string[];
}): Promise<void> {
  const user = auth.currentUser;
  if (!user || !user.emailVerified) return;

  const uid = sanitizeId(user.uid);
  if (uid !== user.uid) return;

  const safeSessionId = sanitizeId(input.sessionId);
  const readerPath = `readers/${uid}`;
  const sessionPath = `${readerPath}/sessions/${safeSessionId}`;

  const readerRef = doc(db, 'readers', uid);
  try {
    const readerSnap = await getDocFromServer(readerRef);
    if (!readerSnap.exists()) {
      const displayName = (user.displayName || 'Edition Reader').trim().slice(0, 80) || 'Edition Reader';
      await setDoc(readerRef, {
        userId: uid,
        displayName,
        createdAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, readerPath);
  }

  const sessionRef = doc(db, 'readers', uid, 'sessions', safeSessionId);
  try {
    const sessionSnap = await getDocFromServer(sessionRef);
    if (!sessionSnap.exists()) {
      await setDoc(sessionRef, {
        ownerId: uid,
        title: input.userContent.trim().slice(0, 120) || 'Edition Lookup',
        status: 'active',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else if (sessionSnap.data()?.status !== 'active') {
      return;
    } else {
      await updateDoc(sessionRef, {
        title: sessionSnap.data()?.title || input.userContent.trim().slice(0, 120) || 'Edition Lookup',
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, sessionPath);
  }

  const baseTs = Date.now().toString(36);
  const entropy = Math.random().toString(36).replace(/[^a-z0-9]/g, '').slice(0, 6) || '0';
  const userMemId = `u_${baseTs}_${entropy}`;
  const assistantMemId = `a_${baseTs}_${entropy}`;
  const userMemPath = `${sessionPath}/memories/${userMemId}`;
  const assistantMemPath = `${sessionPath}/memories/${assistantMemId}`;

  try {
    await setDoc(doc(db, 'readers', uid, 'sessions', safeSessionId, 'memories', userMemId), {
      ownerId: uid,
      sessionId: safeSessionId,
      role: 'user',
      content: input.userContent.trim().slice(0, 4000) || 'Query',
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, userMemPath);
  }

  const citations = (input.citationTitles || [])
    .filter((c) => typeof c === 'string' && c.trim().length > 0)
    .slice(0, 6)
    .map((c) => c.trim().slice(0, 160));

  try {
    await setDoc(doc(db, 'readers', uid, 'sessions', safeSessionId, 'memories', assistantMemId), {
      ownerId: uid,
      sessionId: safeSessionId,
      role: 'assistant',
      content: input.assistantContent.trim().slice(0, 4000) || 'Response',
      citations,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, assistantMemPath);
  }
}

export interface ReaderSessionSummary {
  id: string;
  title: string;
  updatedAtMs: number;
}

export interface ReaderStoredTurn {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citationTitles: string[];
  createdAtMs: number;
}

function toTimestampMs(val: unknown): number {
  if (val && typeof val === 'object' && 'toMillis' in val && typeof (val as { toMillis: () => number }).toMillis === 'function') {
    return (val as { toMillis: () => number }).toMillis();
  }
  return 0;
}

export async function listReaderSessions(): Promise<ReaderSessionSummary[]> {
  const user = auth.currentUser;
  if (!user || !user.emailVerified) return [];
  const uid = sanitizeId(user.uid);
  if (uid !== user.uid) return [];

  const path = `readers/${uid}/sessions`;
  try {
    const q = query(collection(db, 'readers', uid, 'sessions'), where('ownerId', '==', uid), limit(12));
    const snap = await getDocs(q);
    const items: ReaderSessionSummary[] = snap.docs
      .filter((d) => (d.data() as { status?: unknown }).status !== 'archived')
      .map((d) => {
        const data = d.data() as { title?: unknown; updatedAt?: unknown; createdAt?: unknown };
        return {
          id: d.id,
          title: typeof data.title === 'string' && data.title.trim() ? data.title.trim() : 'Edition Lookup',
          updatedAtMs: toTimestampMs(data.updatedAt) || toTimestampMs(data.createdAt),
        };
      });
    return items.sort((a, b) => b.updatedAtMs - a.updatedAtMs);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function archiveReaderSession(sessionId: string): Promise<void> {
  const user = auth.currentUser;
  if (!user || !user.emailVerified) return;
  const uid = sanitizeId(user.uid);
  if (uid !== user.uid) return;

  const safeSessionId = sanitizeId(sessionId);
  const path = `readers/${uid}/sessions/${safeSessionId}`;
  const sessionRef = doc(db, 'readers', uid, 'sessions', safeSessionId);
  try {
    const snap = await getDocFromServer(sessionRef);
    if (!snap.exists() || snap.data()?.status === 'archived') {
      return;
    }
    await updateDoc(sessionRef, {
      status: 'archived',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function loadReaderSessionMemories(sessionId: string): Promise<ReaderStoredTurn[]> {
  const user = auth.currentUser;
  if (!user || !user.emailVerified) return [];
  const uid = sanitizeId(user.uid);
  if (uid !== user.uid) return [];

  const safeSessionId = sanitizeId(sessionId);
  const path = `readers/${uid}/sessions/${safeSessionId}/memories`;
  try {
    const q = query(
      collection(db, 'readers', uid, 'sessions', safeSessionId, 'memories'),
      where('ownerId', '==', uid),
      limit(30)
    );
    const snap = await getDocs(q);
    const turns: ReaderStoredTurn[] = snap.docs.map((d) => {
      const data = d.data() as {
        role?: unknown;
        content?: unknown;
        citations?: unknown;
        createdAt?: unknown;
      };
      return {
        id: d.id,
        role: data.role === 'assistant' ? 'assistant' : 'user',
        content: typeof data.content === 'string' ? data.content : '',
        citationTitles: Array.isArray(data.citations)
          ? data.citations.filter((c): c is string => typeof c === 'string')
          : [],
        createdAtMs: toTimestampMs(data.createdAt),
      };
    });
    return turns.sort((a, b) => a.createdAtMs - b.createdAtMs);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

if (typeof window !== 'undefined') {
  let connectionChecked = false;
  onAuthStateChanged(auth, (user) => {
    if (!connectionChecked && user?.emailVerified) {
      connectionChecked = true;
      void testConnection();
    }
  });
}

