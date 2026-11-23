# Security Summary

**Reviewed Files**: 26
**Issues Resolved**: 6

### Issues Resolved
| Area | File | Line | What Was Happening | Impact | Status | How It Was Fixed |
|---|---|---|---|---|---|---|
| Browser Content Policy & Frame Isolation | `src/server/security.ts` | 7 | Content Security Policy, cross-origin opener protections, and strict feature permissions were disabled globally on HTTP responses. | Medium | Fixed | Enabled a scoped `Content-Security-Policy`, `same-origin-allow-popups`, `originAgentCluster`, `xPermittedCrossDomainPolicies: none`, and expanded `Permissions-Policy`. |
| Cross-Origin Request Protection | `src/server/createApp.ts` | 869 | Browser-initiated `POST`/`DELETE` requests with mismatched `Origin` headers were accepted on API and A2A routes. | Medium | Fixed | Added `enforceSameOriginMutations` to reject cross-origin mutating browser requests with HTTP `403`. |
| Host Header Validation | `src/server/createApp.ts` | 165 | Discovery manifests and unsubscribe links trusted raw request `Host` headers without character or hostname validation. | Medium | Fixed | Added `resolveSafeBaseUrl` with strict hostname regex validation and trusted `APP_URL` fallback. |
| Media Asset & Email Log Isolation | `src/server/createApp.ts` | 1419 | Authenticated media listing, media registration, and signed download routes could access records across signed-in callers. | High | Fixed | Enforced caller-namespaced key checks (`media/<userId>/`) and owner filtering on `media` records and `newsletterLogs`. |
| External Feed & Email URL Filtering | `src/utils/safeUrl.ts` | 1 | External repository, RSS feed, citation, and email links did not uniformly enforce `http:`/`https:` schemes. | High | Fixed | Added `toSafeExternalHref` at GitHub/Substack ingestion, HTML newsletter generation, and React link rendering (`rel="noopener noreferrer"`). |
| Token Bounds & Remote Key Timeouts | `src/server/authGate.ts` | 121 | Remote signing certificate and JWKS fetches lacked timeouts, and oversized JWT strings were parsed before size bounds. | Low | Fixed | Added `AbortSignal.timeout(5000)` on signing-key fetches and rejected tokens over `8192` bytes. |

### Safeguards Verified
| Area | File | How It's Protected |
|---|---|---|
| API Keys & Secrets | `.env.example`, `src/server/authGate.ts` | Private credentials (`GEMINI_API_KEY`, `DATABASE_URL`, `CLERK_SECRET_KEY`, `R2_SECRET_ACCESS_KEY`, `RESEND_API_KEY`, `CRON_SECRET`) are loaded exclusively on the server via `process.env`. |
| SQL & NoSQL Integrity | `src/server/neonDb.ts`, `firestore.rules` | Postgres queries use parameterized tagged templates (`neon`) and Firestore rules enforce owner identity, verified email, immutable timestamps, and strict field allowlists. |
| AI Input & Output Controls | `src/server/aiGuardrails.ts`, `src/server/ragMemory.ts` | Blocks Unicode tag smuggling, directional overrides, NFKC homoglyph obfuscation, Base64-encoded injections, and delimiter escapes while scrubbing HTML/tracking links and secrets in streamed responses. |
| Archive Path Confinement | `src/server/createApp.ts` | Resolves local archive paths with `path.resolve` and verifies containment inside `.local-r2-archive/` alongside strict prefix key validation. |
| Rate Limiting & Payload Caps | `src/server/security.ts`, `src/server/createApp.ts` | Limits JSON bodies to `256kb`, enforces general, write, AI-inference, and newsletter-subscription rate limits, and disables `X-Powered-By`. |
| Dependency Audit (`bun audit`) | `package.json`, `bun.lock` | Audited transitive packages: transitive advisories exist only inside upstream tooling/SDK sub-trees (`@grpc/grpc-js` under `firebase`, `glob`/`minimatch` under `eslint` and `vite-plugin-pwa`); no private secrets or insecure runtime patterns exist in application code. |

## PoC Verification

### 1. Cross-Origin Mutating Request Blocked (`Origin` Spoof)

#### Summary
| Field | Value |
|---|---|
| Issue Type | Cross-Origin Mutation Request |
| Impact | Medium |
| Affected File | `src/server/security.ts:68` |
| Test Scenario | `POST /api/rag/query` sent with header `Origin: https://malicious-attacker.example` |

#### How It Was Fixed
Added `enforceSameOriginMutations` middleware in front of `/api/` and `/a2a/` routes to compare browser `Origin` hosts against trusted request hosts and `APP_URL`.

#### Step-by-Step Trace
| Step | What Happens in the Code | Outcome |
|---|---|---|
| 1 | `POST /api/rag/query` enters Express router | Request enters `/api/` middleware stack |
| 2 | Reaches `enforceSameOriginMutations` in `src/server/security.ts:88` | Extracts `originHost` (`malicious-attacker.example`) and compares with valid `requestHosts` |
| 3 | Host mismatch triggers guard response | Returns HTTP `403` (`Cross-origin state-changing request rejected.`) |

#### Conclusion
**Fix Verified** — Cross-origin browser state changes are rejected before reaching route handlers or databases.

### 2. Host Header Injection Blocked on Discovery Endpoints

#### Summary
| Field | Value |
|---|---|
| Issue Type | Untrusted Host Header Reflection |
| Impact | Medium |
| Affected File | `src/server/security.ts:46` |
| Test Scenario | `GET /llms.txt` with `Host: evil.attacker.com/steal?x=1` |

#### How It Was Fixed
Replaced raw `req.get('host')` interpolation with `resolveSafeBaseUrl(req)`, which validates hostnames against `SAFE_HOST_REGEX` and safely falls back when malformed characters appear.

#### Step-by-Step Trace
| Step | What Happens in the Code | Outcome |
|---|---|---|
| 1 | Request reaches `/llms.txt` in `src/server/createApp.ts:2065` | Calls `resolvePublicBaseUrl(req)` -> `resolveSafeBaseUrl(req)` |
| 2 | Host string fails `SAFE_HOST_REGEX` in `src/server/security.ts:61` | Discards injected path/characters (`evil.attacker.com/steal?x=1`) |
| 3 | Uses canonical fallback base URL | Output excludes `evil.attacker.com` (`Status 200`, **Handled Safely**) |

#### Conclusion
**Fix Verified** — Injected `Host` headers cannot poison generated discovery manifests, OpenAPI server URLs, or newsletter unsubscribe links.

### 3. External URL Script Scheme Filtering (`javascript:` Link Prevention)

#### Summary
| Field | Value |
|---|---|
| Issue Type | Unsafe URI Scheme Injection |
| Impact | High |
| Affected File | `src/utils/safeUrl.ts:1` |
| Test Scenario | `toSafeExternalHref('javascript:alert(1)', 'https://github.com/kalyan870')` |

#### How It Was Fixed
Created `toSafeExternalHref` allowing only `http:`, `https:`, single-slash relative paths, or hash anchors across external GitHub/Substack ingestion, HTML newsletter links, and React link bindings.

#### Step-by-Step Trace
| Step | What Happens in the Code | Outcome |
|---|---|---|
| 1 | Candidate URL `'javascript:alert(1)'` passed to `toSafeExternalHref` | Calls `isSafeHttpOrRelativeUrl` |
| 2 | `new URL(...)` detects protocol `javascript:` (`!== 'http:' && !== 'https:'`) | Returns `false` |
| 3 | Fallback URL returned | Returns `'https://github.com/kalyan870'` (**Handled Safely**) |

#### Conclusion
**Fix Verified** — Untrusted external feeds or citations cannot inject executable URI schemes into rendered links or HTML newsletters.
