# Household synchronization conflicts (#85)

## Rules

| Entity/action | Resolution |
| --- | --- |
| Product edit: name, quantity, location, category, dates, barcode, categories, price | Absolute assignments guarded by the server row's `updatedAt`. First conditional write wins; stale versions return HTTP 409 `sync_conflict`. |
| Shopping edit: name, quantity, checked | Same version rule. Quantity is an absolute replacement, never a delta; concurrent totals are not added or silently overwritten. |
| Product/shopping deletion vs edit | Delete wins. PATCH uses an atomic UPDATE, never an upsert. A deletion between read and write rejects the edit. Repeated DELETE/not-found succeeds. |
| Successive edits by one device | Replay in order. The acknowledged server version advances later local edits only when the editable server state matches the earlier intended result. |
| Lost acknowledgement | Read the authoritative row first. Already matching assignments succeed without another write. Unrelated remote changes do not implicitly rebase later local intent. |
| Missing row on replay | Retain edits as failed intent; remove the row from cache, including on cold start. Never turn an edit into a creation. |
| Server-only fields | IDs, household, creation/update timestamps, receipt/image metadata, shopping source and HA bookmarks cannot be patched by mobile. Conditional updates preserve them. |
| Different rows | Replay independently, except a transport outage pauses the server queue. |

The conflict boundary is the whole editable row, including edits to different
fields. This deliberately refuses an ambiguous merge. The recovery toast offers
**Réappliquer**: it reads the latest row, then durably rebases the retained local
assignments only after the user's explicit choice. If another device changes the
row again before PATCH, the server refuses again. A deleted row cannot be
reapplied. The original base and assignments remain stored across restart and
account changes; `queue.failures()` exposes scoped intent and
`discardFailure(id)` can explicitly abandon it. Later edits/deletes already
queued for the same row become failed intent too, so they cannot bypass the
conflict. New user edits are separate actions against the refreshed cache.

`expectedUpdatedAt` is optional for compatibility with older online clients.
Every server PATCH still conditionally compares its read version at write time.
Versions advance by at least one millisecond and the exact value is persisted
and returned. No schema migration or tombstone is needed for this queue:
existing IDs are immutable, creation is never queued, and UPDATE cannot insert.
The wire/storage queue shape remains compatible with #84's persisted entries.

Creation, imports, outcomes, recipe cooking/state, jobs and Home Assistant
reconciliation remain online operations outside this offline queue. Recipe
state already updates only supplied columns without upsert. This policy does
not promise offline replay for those actions. Persistent synchronization status
and the broader reliability suite remain #86 and #87.

Coverage is authored in the queue/connector tests, both PATCH use-case tests,
and both database repository tests. Per AGENTS.md, tests, builds, lint and
typechecks are not automatically executed.
