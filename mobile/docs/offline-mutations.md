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
empty list. Conflict policy is defined in
[household-sync-conflicts.md](household-sync-conflicts.md).

The offline banner opens `/pending-actions` as a native modal. Its local-only
query lists scoped pending and failed intent and updates after durable queue edits.
The modal uses AppShell's shared `BlobBackground` with standard
ink and cream tokens. The shared `ScreenHeader` aligns its icon, title/count
and trailing 48pt Close; “Tes changements sont conservés” follows below.
Shared chips stay pinned above the list and distinguish all actions,
“À envoyer” and “À vérifier” with Layers, Clock and TriangleAlert icons.
`IdentityCard` rows use cream surfaces in both themes, with matching supporting
text and icon-chip tokens; the displayed changes remain read-only.
Mirrored asymmetric corners and 24pt spacing separate cards on the shared ground. Every modified field
is visible with labeled “Avant” and “Ta modification” values; deletion names
the affected collection. Delivery states pair an icon, semantic color and word,
and retained failures show their reason. The modal remains open as connectivity
returns, so completed actions disappear from the list. Source inspection confirms the shared design
components; fresh native rendering and transition fidelity remain unverified.
Each card offers a quiet cancellation button confirmed through `ActionSheet`.
Cancellation removes that scoped intent only after the queue write succeeds,
restores its cached item while preserving later pending field assignments, and
updates the modal. Retained failures preserve the authoritative cached row.
An action already being sent cannot be cancelled. Storage failure retains the
intent and reports an error; cancellation does not undo a server change that
may already have been applied before a lost acknowledgement. Tests were authored
but not run, and no fresh native rendering was performed.
Fake mode supplies twelve initial in-memory actions (nine pending, three conflicts),
covering quantities, checkboxes, locations, dates, prices, names and deletion,
and uses the same overlays,
local mutations and reconnect replay as the real connector. Its offline simulation
pauses replay until connectivity is restored. Session and
household cache observers reuse their domain query functions with `enabled: false`.

Focused coverage is authored in `mutation-queue.test.ts`,
`offline-connector.test.ts`, `mutation-queue-storage.test.ts`, and `http-client.test.ts`. Per AGENTS.md, these tests,
builds, lint, and typechecks are not executed automatically.

## Synchronization status (#86)

The measured network banner also shows scoped pending changes, actual delivery,
and action-required failures, with French/English copy and accessible live status.
It remains absent during normal online use with an empty queue. After reconnecting,
dismissal starts only once the queue is empty: pending delivery and retained
conflicts keep the banner visible. Conflicts require an explicit human decision;
reconnection never resolves them. Temporary transport
failures stay pending and never request sign-in. Details reuse `/pending-actions`,
including its existing field comparison, filters and cancellation workflow.

A quiet retry is available after automatic delivery fails. It preserves the saved
patch/deletion and clears ordinary failures durably before replaying dependent
changes in order. Buttons wait while offline or sending. Conflict cards show their explicit Overwrite button only when connectivity is
confirmed online. Cancellation stays available offline. Overwrite opens the shared
ActionSheet and reads through the original transport to compare current household
values with each saved assignment. The human confirms the affected fields before
#85's reapplication flow runs; a changed server version rejects the reviewed intent
and asks for another review. Unrelated values remain intact. Reconnect alone never invokes it. Deleted-row recovery
remains separate; a missing row is never recreated by overwrite. Action buttons
use the compact shared pill size and sit together in a wrapping row. Saved intent remains inspectable after
a restart even when it is no longer overlaid onto the authoritative row.

Focused coverage is authored in the queue, banner and pending-actions tests.
No tests, build, lint, typecheck or native rendering were run for this rebase.

The modal displays global acknowledged delivery progress for the current in-memory
queue batch. Conflicts and temporary failures remain incomplete; cancellation
resolves an action without counting it as synchronized. The denominator stays stable
and the counter names sent and canceled actions separately. A new batch resets completed counts,
and accounts/households/servers have separate counters. Restarts begin a new
progress count for retained actions. Only the action currently being sent or explicitly retried/overwritten displays
an indeterminate progress bar, including the fresh-row preparation of overwrite.
The atomic endpoint reports no intermediate percentage. Waiting and
blocked actions have no item bar; acknowledged rows leave the list. Existing shared progress bars preserve accessible values and Reduce Motion.

When the modal has observed actions in the current account/household/server and
that scoped queue becomes empty, delivery-only completion shows a short “All sorted!”
checkmark pop. Canceled-only and mixed outcomes use neutral wording and static motion,
with explicit synchronized/canceled counts. Retained conflicts/errors prevent completion.
Opening an already-empty queue or changing scopes does not trigger the success
state. New actions interrupt it and cancel dismissal. The timer runs only while
the modal is focused. Normal delivery closes after 1.8 seconds, Reduce Motion uses
3.5 seconds and screen readers get at least 8 seconds; Android respects its recommended
accessibility timeout. Touching or focusing the confirmation suspends automatic
navigation, while Close lets the user skip the delay. Settings has a permanent
Synchronization entry to reopen changes and the last scoped in-memory outcome.

Unavailable local storage explains reopening the app instead of offering an ineffective
queue reload. Offline/sending guidance explains disabled controls. Expired sessions
offer an explicit session check and route to sign-in when necessary; only a confirmed
session in the same account/server/household can retry retained authentication failures.
Cancellation confirmation also becomes unavailable if delivery starts after it opens.

Audit hardening limits Overwrite to the selected card's retained conflict; other
conflicts on the same entity remain blocked for their own human decision. Delivery
status stays continuous across a replay batch, while only the actually sending
row (or its idle preparation) displays item progress. Status announcements are
phase-based; counters stay readable without announcing every acknowledgement.
Idle/backoff/conflict-only replay does not notify observers, and the local action
list refetches only when its entry references change, not for sending-state changes.
