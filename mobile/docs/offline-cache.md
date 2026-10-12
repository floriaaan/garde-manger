# Offline cold starts

The root layout loads the selected server, then restores the read cache before
mounting query observers. The official `@tanstack/react-query-persist-client`
restore/subscribe APIs and `@tanstack/query-async-storage-persister` handle
hydration, dehydration and throttled storage writes. Normal TanStack Query
revalidation follows hydration;
failed requests keep the restored data. This cache does not queue mutations or
grant server permissions: every write still requires server authorization.

The version 2 snapshot contains the last active server URL, account ID and
household ID. Identity fields are projected explicitly, and the account must
appear among the household members. It restores the household context, product
lists (including filters), product details, outcome statistics and shopping
items, preserving each read's update timestamp. Only previously loaded data is
available offline. Images are not downloaded by this cache.

Storage uses `@react-native-async-storage/async-storage` on native and web,
with its Expo SDK-compatible version. Reads, writes and removal are asynchronous.
Writes/removals are serialized so sign-out cannot be followed by a stale write
that was already in flight. This is an unencrypted cache, not a credential store. Authentication cookies/tokens, passwords, invite
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

The schema version is explicit in TanStack’s `buster`, together with the server
URL. Version 1 snapshots from the previous custom format are discarded.
`maxAge` and query `gcTime` are infinite so this cold-start foundation does not
introduce an arbitrary expiry or lose unobserved persisted reads. Freshness and
revalidation remain separate concerns. A generation guard prevents a delayed
write from recreating a discarded context. Corrupt, incompatible or context-mismatched
snapshots are discarded, never partially migrated. Any incompatible change to
the read DTOs or snapshot layout must increment the version; the server then
repopulates it through normal reads. Future migrations must validate the full
context before restoring data.

A persistent, translated status banner reports loss of device connectivity and
shows “Connection restored” for 3.5 seconds after reconnecting. It observes
Expo Network events and refreshes on foreground; an unknown state is silent.
It reports device connectivity, not backend health or completed synchronization.
