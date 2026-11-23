import assert from 'assert';
import fs from 'fs';

interface BlueprintSchema {
  entities: Record<
    string,
    {
      title: string;
      type: string;
      properties: Record<string, { type: string; minLength?: number; maxLength?: number; pattern?: string }>;
      required?: string[];
    }
  >;
  firestore: Record<string, { schema: string | { $ref: string }; description: string }>;
}

export function runFirestoreRulesVerification(): { checks: number; collections: number } {
  const rules = fs.readFileSync('firestore.rules', 'utf-8');
  const blueprint = JSON.parse(fs.readFileSync('firebase-blueprint.json', 'utf-8')) as BlueprintSchema;

  // Pillar 0 & 4.1: Rules version & global deny catch-all
  assert.ok(rules.includes("rules_version = '2';"), 'Missing rules_version = 2');
  assert.ok(
    /match\s+\/\{document=\*\*\}\s*\{\s*allow\s+read,\s*write:\s*if\s+false;\s*\}/.test(rules),
    'Missing default-deny catch-all rule'
  );

  // Pillar 2 & 3: Path variable validation and strict allowlist helpers
  assert.ok(rules.includes('function isValidId(id)'), 'Missing isValidId helper');
  assert.ok(rules.includes("id.matches('^[a-zA-Z0-9_\\\\-]+$')"), 'Missing strict ID regex guard');
  assert.ok(rules.includes('function isVerifiedUser()'), 'Missing email verification helper');
  assert.ok(rules.includes('request.auth.token.email_verified == true'), 'Missing email_verified check');
  assert.ok(rules.includes('function isValidReaderProfile('), 'Missing ReaderProfile validator');
  assert.ok(rules.includes('function isValidReaderSession('), 'Missing ReaderSession validator');
  assert.ok(rules.includes('function isValidReaderMemory('), 'Missing ReaderMemory validator');

  // Pillar 1 & 5: Master Gate on subcollection + bounded array guard
  assert.ok(
    rules.includes('get(/databases/$(database)/documents/readers/$(userId)/sessions/$(sessionId)).data.ownerId == request.auth.uid'),
    'Missing parent session Master Gate on /memories/'
  );
  assert.ok(rules.includes('data.citations.size() <= 6'), 'Missing bounded citations array guard');
  assert.ok(rules.includes('data.citations[0] is string'), 'Missing array element type check');

  // Pillar 6: Zero PII fields stored inside /readers/{userId}
  const readerProps = Object.keys(blueprint.entities.ReaderProfile?.properties || {});
  assert.ok(!readerProps.includes('email') && !readerProps.includes('phone'), 'ReaderProfile must not contain PII');

  // Pillar 8: No blanket `allow list: if isSignedIn();` and no `get()` inside `allow list`
  assert.ok(!/allow\s+list:\s*if\s+isSignedIn\(\)\s*;/.test(rules), 'Forbidden blanket allow list detected');
  const listBlocks = rules.match(/allow\s+list:[^;]+;/g) || [];
  assert.ok(listBlocks.length === 3, `Expected 3 allow list blocks, found ${listBlocks.length}`);
  for (const block of listBlocks) {
    assert.ok(block.includes('resource.data.'), `allow list must evaluate resource.data: ${block}`);
    assert.ok(!block.includes('get(') && !block.includes('exists('), `Forbidden DB lookup in allow list: ${block}`);
  }

  // Immutable fields, terminal state locking & server request.time enforcement
  assert.ok(rules.includes("existing().status != 'archived'"), 'Missing terminal archived status lock');
  assert.ok(rules.includes('incoming().createdAt == request.time'), 'Missing server createdAt enforcement');
  assert.ok(rules.includes('incoming().updatedAt == request.time'), 'Missing server updatedAt enforcement');
  assert.ok(rules.includes("affectedKeys().hasOnly(['displayName'])"), 'Missing update affectedKeys allowlist on ReaderProfile');

  // Blueprint collection sync verification
  const collectionPaths = Object.keys(blueprint.firestore);
  assert.ok(collectionPaths.includes('/readers/{userId}'), 'Missing /readers/{userId} in blueprint');
  assert.ok(collectionPaths.includes('/readers/{userId}/sessions/{sessionId}'), 'Missing sessions path in blueprint');
  assert.ok(
    collectionPaths.includes('/readers/{userId}/sessions/{sessionId}/memories/{memoryId}'),
    'Missing memories path in blueprint'
  );
  assert.ok(rules.includes('match /readers/{userId}'), 'Missing /readers/{userId} match block');
  assert.ok(rules.includes('match /sessions/{sessionId}'), 'Missing /sessions/{sessionId} match block');
  assert.ok(rules.includes('match /memories/{memoryId}'), 'Missing /memories/{memoryId} match block');

  return { checks: 14, collections: collectionPaths.length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const res = runFirestoreRulesVerification();
  console.log(`[PASS] Firestore Rules & Blueprint Verification -> checks=${res.checks}, collections=${res.collections}`);
}
