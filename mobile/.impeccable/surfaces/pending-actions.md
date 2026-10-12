# Pending actions

MODE: Operate

TARGET: `src/presentation/shared/pending-actions-screen.tsx`, offline banner and `/pending-actions` native modal.

PURPOSE: Inspect locally saved household changes and distinguish automatic delivery from changes needing attention.

STATES: Loading, empty, read failure with retry, waiting, retrying and blocked. Fake and real modes share copy and queue/replay behavior; fake storage is in memory and seeded actions replay. Close and native dismissal remain available. Banner height respects Reduce Motion.

EVIDENCE: Source inspected; no runtime validation, builds, tests, lint or typechecks. Inherited composer capture establishes incumbent context only. Read-only simctl found zero booted simulators; no fresh native rendering or transition proof. Preserve DESIGN.md/design.json; preexisting `design-sidecar-stale` and `config-build-path-unset` remain unresolved.

REVIEW: Finish reviewer returned ship at source-inspection scope; no material fixes identified. Native rendering and accessibility remain unverified at runtime.

## Direction contract

THESIS: Le reçu des changements is one continuous local change ledger with before/after assignments and a separate recovery section.

OWN-WORLD: Existing cream, ink, mint and rose tokens, typography and outline icons. Scoped `AppShell` surfaceColor override; default shell behavior remains. No raster assets ship.

STORY: See what is saved, understand intended changes, then distinguish automatic delivery from intent requiring attention.

FIRST VIEWPORT: Compact 26pt heading, count and 48pt Close precede a mint saved-state strip. SectionList rows show muted 16pt old values → bold 22pt new values and textual waiting states. Failures form a rose À vérifier group with tinted secondary text. Content scrolls natively.

FORM: Grounded candidate 4, seed afe70049, explicitly selected receipt, buildPath code. Generated critique reference: `/Users/floriaaan/.codex/generated_images/01a131db-9c6f-7240-bfd4-d18ed0fee2a5/exec-a56f4285-5f77-4735-87b3-fb1a9a20c52e.png`; not runtime evidence or a shipping raster.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
