# Offline mutation delivery (#84)

The real mobile connector queues shopping-item edits (including checkbox and
quantity changes), shopping-item deletions, product edits, and product deletions.
These hooks run with `networkMode: 'always'`, so local actions remain available
when TanStack Query knows the device is disconnected. Fake mode uses the same queue and replay pipeline with in-memory fixture storage.

The queue reuses the local-first AsyncStorage adapter on native and web, under
`garde-manger.mutation-queue-v1`, separate from the read-cache snapshot. Storage
errors refuse the action instead of pretending it was saved. A corrupt queue
is preserved and reported, never silently reset.
Each entry includes its server, user, household, original row, absolute patch
(or deletion), retry count, and retry deadline. Pending rows are restored into
the query cache after the existing read-cache restoration and before query
observers mount. Scope validation reuses the cache's session, household, and
membership checks. Pending changes are overlaid on later reads.

Replay runs serially on reconnect, foreground, session/household restoration,
and a five-second foreground timer. Connectivity comes from the existing Expo
Network hook, which also handles foreground refresh and stale network events.
The debug simulation remains visual only for real transport and pauses fake
replay for offline interaction checks. Temporary transport errors and HTTP
408/429/5xx retry with exponential backoff capped at five minutes. Later actions
on the same entity wait behind a retrying action. Unrelated actions can continue
after a permanent refusal, which is saved and shown in a toast. The authoritative
row is refreshed and the local intent is retained for recovery. Confirmed authentication revocation still invalidates the
session and stops replay. Queues from another account, household, or server are
neither displayed nor replayed.

Replay is at least once: a response lost after a server commit can cause a retry.
PATCH carries absolute values, never increments; repeated DELETE treats the
matching not-found response as success. No create endpoint is queued, so replay
cannot create duplicate entities. Failed entries remain for diagnosis and are
not automatically retried; the user can submit a corrected action.

Creation, imports, product outcomes, scans, and AI jobs remain online operations.
Full offline cold starts reuse the local-first engine already on `develop`:
session, household, and unrelated cached rows stay in its read snapshot. Failed
household reads reject so TanStack retains that snapshot instead of saving an
empty list. Persistent sync status remains a separate concern (#86). Conflict
policy is defined in
[household-sync-conflicts.md](household-sync-conflicts.md).

The offline banner opens `/pending-actions` as a native modal. Its local-only
query lists scoped pending and failed intent, updates after durable queue edits,
and shows the action, affected row, before/after values and delivery state on a
continuous cream ledger. Failed intent is grouped under “À vérifier”. It remains
open as connectivity returns, so completed actions disappear from the list.
Fake mode supplies twelve initial in-memory actions (nine pending, three conflicts),
covering quantities, checkboxes, locations, dates, prices, names and deletion,
and uses the same overlays,
local mutations and reconnect replay as the real connector. Its offline simulation
pauses replay until connectivity is restored. Session and
household cache observers reuse their domain query functions with `enabled: false`.

Focused coverage is authored in `mutation-queue.test.ts`,
`offline-connector.test.ts`, `mutation-queue-storage.test.ts`, and `http-client.test.ts`. Per AGENTS.md, these tests,
builds, lint, and typechecks are not executed automatically.
