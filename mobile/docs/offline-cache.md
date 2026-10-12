# Offline cold starts

The root layout loads the selected server, then restores the read cache before
mounting query observers. Normal TanStack Query revalidation follows hydration;
failed requests keep the restored data. This cache does not queue mutations or
grant server permissions: every write still requires server authorization.

The version 1 snapshot contains the last active server URL, account ID and
household ID. Identity fields are projected explicitly, and the account must
appear among the household members. It restores the household context, product
lists (including filters), product details, outcome statistics and shopping
items, preserving each read's update timestamp. Only previously loaded data is
available offline. Images are not downloaded by this cache.

Native storage uses an app document file through the existing Expo FileSystem
dependency; web uses localStorage. The file is private to the app but is not an
encrypted credential store. Authentication cookies/tokens, passwords, invite
codes, provider credentials, Home Assistant configuration, linked accounts,
receipt/scan payloads, jobs and mutation state must never enter this snapshot.
Fake/demo mode does not read or write the production snapshot.

Only one active context is retained. Sign-out, confirmed session absence,
account changes, household changes/removal and server changes discard the old
snapshot and cancel/remove old reads. Server changes keep persistence active
for the new instance. Leaving a household or deleting an account also clears
the snapshot through the existing query-cache clear. A temporary network error
does not invalidate it. Storage errors are reported and degrade to memory-only
operation rather than blocking startup.

The schema version is explicit. Corrupt, incompatible or context-mismatched
snapshots are discarded, never partially migrated. Any incompatible change to
the read DTOs or snapshot layout must increment the version; the server then
repopulates it through normal reads. Future migrations must validate the full
context before restoring data.
