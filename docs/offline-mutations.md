# Offline mutation delivery (#84)

The real mobile connector queues shopping-item edits (including checkbox and
quantity changes), shopping-item deletions, product edits, and product deletions.
These hooks run with `networkMode: 'always'`, so local actions remain available
when TanStack Query knows the device is disconnected. Fake/demo mode is unchanged.

The queue is stored in the native document directory or browser localStorage.
Storage errors refuse the action instead of pretending it was saved. Native
writes use a temporary file; startup recovers that file if a replacement was
interrupted. A corrupt queue is preserved and reported, never silently reset.
Each entry includes its server, user, household, original row, absolute patch
(or deletion), retry count, and retry deadline. Pending rows are restored into
the query cache once session and household are available, and overlaid on reads.

Replay runs serially on reconnect, foreground, session/household restoration,
and a five-second foreground timer. Temporary transport errors and HTTP
408/429/5xx retry with exponential backoff capped at five minutes. Later actions
on the same entity wait behind a retrying action. Unrelated actions can continue
after a permanent refusal, which is saved and shown in a toast; the affected row
is restored locally. Confirmed authentication revocation still invalidates the
session and stops replay. Queues from another account, household, or server are
neither displayed nor replayed.

Replay is at least once: a response lost after a server commit can cause a retry.
PATCH carries absolute values, never increments; repeated DELETE treats the
matching not-found response as success. No create endpoint is queued, so replay
cannot create duplicate entities. Failed entries remain for diagnosis and are
not automatically retried; the user can submit a corrected action.

Creation, imports, product outcomes, scans, and AI jobs remain online operations.
Full offline cold starts (including session/household and unrelated cached rows)
depend on #82. Freshness and conflict policy belong to #83/#85, and persistent
sync status UI belongs to #86.

Focused coverage is authored in `mutation-queue.test.ts`,
`offline-connector.test.ts`, `mutation-queue-storage.test.ts`, and `http-client.test.ts`. Per AGENTS.md, these tests,
builds, lint, and typechecks are not executed automatically.
