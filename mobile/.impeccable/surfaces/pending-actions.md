# Pending actions

MODE: Operate

TARGET: `src/presentation/shared/network-status-banner.tsx`, `src/presentation/shared/pending-actions-screen.tsx`, route `/pending-actions`.

PURPOSE: Let a household member inspect changes saved on this device while offline and understand which are waiting, retrying or blocked.

DIRECTION: Extend the incumbent Sunlit Pantry world from `DESIGN.md` with a bolder hierarchy scoped to this modal. The offline banner opens a native `presentation: 'modal'` route with `AppShell` modal navigation. A local 32pt heading uses the existing web heading font at weight 600 and native system type at weight 800. Reuse the soft palette, shared `Pressable`, `PillButton` and existing clock, trash, Wi-Fi, check, chevron and close icons. Native navigation owns the transition. A labelled 48pt Close control returns to the previous route; direct entry falls back to home. No new visual system or assets.

COMPOSITION: The heading and queue count precede a scrolling list. Each separated row names the affected item in 18pt/800 type, then identifies collection and operation and displays changed field values in 16pt/700 type. Existing cream 38pt icon squares carry a trash glyph for deletions and a clock for edits. Written waiting/retrying status pills use `soonBg`/`soonText`; blocked pills use `expiredBg`/`expiredText`. Blocked rows explain conflict, missing item or refusal in place. Separation uses the existing `creamPillEdge` token.

STATES: Offline banner is actionable; restored connectivity is informational and dismisses after 3.5 seconds. Banner height respects Reduce Motion. The queue exposes loading, empty, load failure with retry, waiting, retrying and blocked states. Close remains available in each queue state. Field labels, dates, currency and status copy follow the existing translation and locale helpers.

BEHAVIOR: Fake and real connectors use the same queue, replay pipeline and UI copy. There is no demo-specific banner, queue description or modal branch. Fake queue storage is in memory, matching the fake server's lifetime; its seeded initial actions are actual queued mutations that replay through the shared pipeline rather than static presentation rows.

EVIDENCE: Source inspection confirms the final heading/row hierarchy, status pills, shared components, modal routing, 48pt Close and row separation. Connector wiring and fake storage source confirm the common queue pipeline and mutable in-memory seed. Inherited visual reference: `screenshots/composer/iphone-light-default.png`, evidence for the existing modal world only. No fresh render validation, capture, build, test, lint or typecheck was performed under AGENTS.md; source inspection and this reference do not prove runtime replay, the pending-actions surface's native rendering or transition quality.

CONTEXT: Preexisting `design-sidecar-stale` and `config-build-path-unset` findings remain unchanged. Preserve `DESIGN.md` and `.impeccable/design.json`; this brief records only the new surface.
