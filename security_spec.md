# Firestore Security Rules Specification

## Data Invariants
1. All documents default to deny-all (`allow read, write: if false`).
2. Reader profiles (`/readers/{userId}`) contain zero PII (no email/phone) and are readable/writable only by verified (`email_verified == true`) owner `request.auth.uid == userId`.
3. A `ReaderSession` (`/readers/{userId}/sessions/{sessionId}`) must exist and have `ownerId == request.auth.uid` before any child `ReaderMemory` document can be created or read (`get()` Master Gate).
4. Once `ReaderSession.status` becomes `'archived'` (terminal state), no client update may transition or mutate it further.
5. Every `createdAt` / `updatedAt` timestamp must strictly equal `request.time`.
6. Every document ID must match `^[a-zA-Z0-9_\\-]+$` and stay `<= 128` characters.

## Adversarial Payloads Denied (`PERMISSION_DENIED`)
1. Unauthenticated read or write on `/readers/user1`
2. Unverified email user (`email_verified: false`) writing `/readers/user1`
3. Shadow field injection (`isAdmin: true`) on `/readers/user1` create
4. Identity spoofing (`ownerId: 'victim-uid'`) when signed in as `'attacker-uid'`
5. Oversized ID (`'a'.repeat(300)`) on `/readers/{userId}/sessions/{sessionId}`
6. Orphaned memory write under a non-existent parent session
7. Client-forged `createdAt` timestamp not equal to `request.time`
8. Updating immutable `ownerId` or `createdAt` on an existing `ReaderSession`
9. Updating an already-archived (`status == 'archived'`) session
10. Unbounded or oversized `citations` array (`> 6` items) on `ReaderMemory`
11. Arbitrary field injection (`extraRole: 'editor'`) on `ReaderSession` update
12. Blanket collection query without `ownerId == request.auth.uid` constraint
