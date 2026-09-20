---
target: tâches asynchrones mobile
total_score: 25
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:/Users/floriaaan/dev/fridge-ai/mobile/src/presentation/job/tasks-screen.tsx"
target_fingerprint: "sha256:4476600ebed2724156169dbcd01745e17690dad5d90fb8f585a2d36ff9c293ac"
target_path: /Users/floriaaan/dev/fridge-ai/mobile/src/presentation/job/tasks-screen.tsx
timestamp: 2026-09-20T16-35-16Z
slug: src-presentation-job-tasks-screen-tsx
---
Method: DEGRADED single-context. Target: async tasks UI (mobile). Score 25/40 (Acceptable). Detector: 0 findings.
P1 Cards indistinct, no time/status (layout). P1 Failures poorly recoverable, raw backend message, toast only "échec" (clarify).
P2 Triple signal pill/dot/banner, dot lacks count and finished state (distill). P2 Partial job stacks 3 full-width buttons (polish).
P3 "En attente…" unexplained; pill bottom:96 hard-coded (adapt).
Personas: Casey (no timestamps), Sam (no live announcement, color-only status), Alex (no bulk dismiss).
