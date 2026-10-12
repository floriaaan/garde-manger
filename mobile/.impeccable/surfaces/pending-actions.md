# Pending actions

MODE: Operate

TARGET: `src/presentation/shared/network-status-banner.tsx`, `src/presentation/shared/pending-actions-screen.tsx`, route `/pending-actions`.

PURPOSE: Let a household member inspect changes saved on this device while offline and understand which are waiting, retrying or blocked.

DIRECTION: Extend the incumbent Sunlit Pantry world from `DESIGN.md`. The offline banner opens a native `presentation: 'modal'` route with `AppShell` modal navigation and `ScreenHeader`. Reuse the soft palette, shared `Pressable`, `PillButton` and existing clock, trash, Wi-Fi, check, chevron and close icons. Native navigation owns the transition. A labelled 48pt Close control returns to the previous route; direct entry falls back to home. No new visual system or assets.

COMPOSITION: A named header and queue count precede a scrolling list. Each separated row names the affected item, collection and operation, then displays changed field values and a written status. Deletions use the trash glyph; edits use the clock. Blocked rows explain conflict, missing item or refusal in place. Separation uses the existing `creamPillEdge` token.

STATES: Offline banner is actionable; restored connectivity is informational and dismisses after 3.5 seconds. Banner height respects Reduce Motion. The queue exposes loading, empty, load failure with retry, waiting, retrying and blocked states. Close remains available in each queue state. Field labels, dates, currency and status copy follow the existing translation and locale helpers.

EVIDENCE: Source inspection confirms shared components, modal routing, 48pt Close and row separation. Inherited visual reference: `screenshots/composer/iphone-light-default.png`, evidence for the existing modal world only. No fresh render validation, capture, build, test, lint or typecheck was performed under AGENTS.md; this reference does not prove the pending-actions surface's native rendering or transition quality.

CONTEXT: Preexisting `design-sidecar-stale` and `config-build-path-unset` findings remain unchanged. Preserve `DESIGN.md` and `.impeccable/design.json`; this brief records only the new surface.
