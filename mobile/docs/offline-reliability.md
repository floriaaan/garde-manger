# Offline and reconnect reliability (#87)

## Automated coverage

The focused command is `pnpm --filter garde-manger-mobile run test:offline`.
`task mobile:check` includes this focused suite, so the `mobile-check` CI job
runs it through the same command. The general mobile test suite remains
disabled in that task. No backend, device, credentials,
or real network connection is required: HTTP responses and transport failures
are injected at `fetch`, storage round-trips through JSON, and timers/reconnect
signals are controlled by the tests.

| Contract | Coverage (under `mobile/src/`) |
| --- | --- |
| Offline cold start restores session, household, inventory and shopping with original timestamps | `application/shared/offline-cache.test.ts` |
| Cold start applies durable pending edits after restoring the read snapshot | `application/sync/offline-connector.test.ts` |
| Online → offline → online sends no writes offline and drains the queue once on reconnect | `application/sync/offline-reliability.test.ts` |
| 500, HTML 503 and rejected timeout reads retain data; writes retain optimism and survive a queue restart until recovery | `application/sync/offline-reliability.test.ts` |
| Failed freshness refresh, focus/reconnect revalidation and stale connectivity events | `application/shared/query-freshness.test.tsx`, `application/shared/use-connectivity.test.tsx` |
| Unavailable session stays cached; authoritative absence/401 invalidates it; native session timeout preserves credentials | `application/identity/session.query.test.tsx`, `infrastructure/http/http-client.test.ts`, `infrastructure/http/http-fridge-connector.test.ts` |
| Real 401 during replay clears the persisted read snapshot and stops subsequent writes | `application/sync/offline-reliability.test.ts` |
| Account/household/server switching clears old reads, isolates pending work and ignores an in-flight response from the old scope | `application/shared/offline-cache.test.ts`, `application/sync/mutation-queue.test.ts` |
| Concurrent enqueue/replay, persisted backoff and lost-response retries use absolute assignments | `application/sync/mutation-queue.test.ts` |
| Pending fields overlay remote changes without replacing unrelated fields; remote deletion completes DELETE and permanently refuses PATCH | `application/sync/offline-reliability.test.ts` |
| Storage failure/corruption never silently discards a queue or reports an unsaved write as accepted | `application/sync/mutation-queue.test.ts`, `infrastructure/storage/mutation-queue-storage.test.ts`, `infrastructure/storage/offline-cache-storage.test.ts` |

These tests describe the current conflict contract, not a new merge policy:
pending absolute fields win locally until replay; a remote not-found response
for an edit is retained as a permanent failure and the next server read removes
the row. Same-field conflict resolution remains the scope of #85. Offline
creation, imports, scans and AI jobs are not queued (#84).
The rejected-timeout cases exercise transport failure handling; the bounded
session timeout is tested separately in `http-fridge-connector.test.ts`.

## Device QA matrix

Run each row on a physical iOS device and a physical Android device with the
same release/staging build. Use a test account in a household with at least two
products and two shopping items; first open the inventory and shopping list
online to seed the cache. Use a second member/device for concurrent changes.
Use a controlled staging proxy for HTTP failures; airplane mode alone cannot
simulate a reachable network with an unavailable server. Do not use the debug
connectivity simulation to prove network behavior: it is visual only.

| Scenario and steps | Expected result on both platforms | iOS | Android |
| --- | --- | --- | --- |
| Seed data → enable airplane mode (Wi-Fi also off) → force-close → relaunch | Cached context and lists appear without login; previously unopened data may be unavailable | ☐ | ☐ |
| Online → airplane mode → edit quantity/check an item/delete a product → reconnect | Actions appear immediately; unrelated rows remain; server converges after reconnect without duplicates | ☐ | ☐ |
| Queue edits/deletes offline → force-close → relaunch offline → reconnect | Optimistic edits/deletes survive restart and replay in order | ☐ | ☐ |
| Proxy returns 500/HTML 503 on reads and writes, then restores service while app stays foreground | Cached lists/session remain; pending edits survive; automatic retry eventually drains work | ☐ | ☐ |
| Drop transport during reads/replay (including after a write has committed), then recover | No logout or lost edit; repeated PATCH/DELETE produces the same final state | ☐ | ☐ |
| Reconnect while backgrounded, then foreground the app | No background replay is required; foreground revalidates and resumes pending work | ☐ | ☐ |
| Revoke the session on the server → reconnect | Confirmed refusal prompts login, removes old household reads, stops subsequent queued writes | ☐ | ☐ |
| Queue an edit in A → switch household/account/server to B → reconnect; return to A | B never displays or sends A's pending data; A's work remains scoped to A | ☐ | ☐ |
| A edits a checkbox offline; B changes its name/quantity online; A reconnects | Unrelated remote fields remain after revalidation; A's checkbox converges | ☐ | ☐ |
| A deletes offline; B already deleted online; A reconnects | Delete completes without retry loop or resurrection | ☐ | ☐ |
| A edits offline; B deletes online; A reconnects | Edit refusal is surfaced, stops retrying, and the next read removes the row | ☐ | ☐ |

Record build/commit, OS/device, scenario, result and any defect link. Checkboxes
above are a reusable execution sheet, not evidence that device QA has run.
