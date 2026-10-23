---
version: 1
slug: "src-presentation-settings-feedback-screen-tsx"
primary_target: "src/presentation/settings/feedback-screen.tsx"
related_targets: ["src/app/feedback.tsx"]
---

# Feedback — Correspondance

Mode: Operate. Target: the existing feedback screen reached from Settings.
Audience: household members sharing an idea or onboarding difficulty.
Action: prepare an editable, free-form email; nothing is submitted by this screen.
Constraints: preserve the generated envelope asset, existing mailto payload, FR/EN, privacy notice, error/retry, selectable contact address and accessible stack navigation.

## Direction contract

THESIS: One personal invitation, presented as correspondence, replaces disconnected explanatory paragraphs.

OWN-WORLD: Inherit the Sunlit Pantry palette and shared shell. One cream surface, tinted cream text, asymmetric corners, diffuse warm shadow and one lime action. Keep the existing transparent 3D envelope.

STORY: Recognize the invitation, understand the privacy boundary, prepare a draft, then review and send in the email app. Direct contact remains available.

FIRST VIEWPORT: A centred 128pt envelope (96pt on short/large-text viewports) opens the cream sheet. A two-line display headline and short examples precede privacy guidance and a full-width lime action. Draft guidance follows. Announced errors/status and the selectable contact address sit below the sheet. No fixed card height; the shared scroll container handles overflow.

FORM: Correspondance, grounded candidate 4, seed b124c33a; user selected option 1 from three code-led composition mockups. Keep the shared header and native type; Spectral on web.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Finish review

Source review: ship, with no material source findings. Existing PillButton callers keep their previous layout; the feedback action opts into full width and label wrapping. Cream text contrast is 4.85:1 in light mode and 9.81:1 in dark mode; the action label is 10.56:1.

Web computed measurements confirmed a 32px heading with 40px line height and the Spectral/Georgia family, a 339 × 44px action at y=513, selectable contact text, and no document overflow in the actual 427 × 925px viewport. The preview returned 1280 × 800px screenshots despite two requests for 390 × 844px and produced composite images; those screenshots are invalid visual evidence.

Native captures, dark-theme rendering, large text and other device sizes remain unverified. No tests, builds, lint or typechecks were run under AGENTS.md. Documentation review confirms this is an ordinary extension: preserve global DESIGN.md and design.json; keep route-specific decisions here. Raster provenance remains in assets/illustrations/NOTICE.md.
