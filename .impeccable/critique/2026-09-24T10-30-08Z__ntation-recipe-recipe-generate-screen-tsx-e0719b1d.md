---
target: recipe composer (Envie de quoi ?)
total_score: 27
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
target_identity: "file:/Users/floriaaan/dev/fridge-ai/mobile/src/presentation/recipe/recipe-generate-screen.tsx"
target_fingerprint: "sha256:4b73dc96c44f3d7eb92d936718979619d1f67cb36e127efe3d6aa1f5d3dd1dcd"
target_path: /Users/floriaaan/dev/fridge-ai/mobile/src/presentation/recipe/recipe-generate-screen.tsx
timestamp: 2026-09-24T10-30-08Z
slug: ntation-recipe-recipe-generate-screen-tsx-e0719b1d
---
Method: dual-agent (A: design review · B: detector)

## Design Health Score — 27/40 (Good, with fixable gaps)

| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 3 | Folded "Sous la main · 23" counts products, not pins; a pin found via search vanishes when search clears |
| 2 | Match System / Real World | 3 | "Terroir" under "Envie d'ailleurs"; "Pour les enfants" under "En cuisine" |
| 3 | User Control and Freedom | 3 | "Tout effacer" buried at the bottom of the scroll |
| 4 | Consistency and Standards | 2 | Card fill = gradientBottom (DESIGN.md bans); cabinetRowSurface outside the fridge; no android_ripple; "Chargement…" instead of skeleton |
| 5 | Error Prevention | 2 | Végétarien + Végan both selectable; pins keyed by name |
| 6 | Recognition Rather Than Recall | 3 | Header subtitle truncated — "tout est facultatif" half visible |
| 7 | Flexibility and Efficiency | 3 | No submit from keyboard on the wish field |
| 8 | Aesthetic and Minimalist Design | 2 | Same "dates first" message 3×; search shown even for 3 products |
| 9 | Error Recovery | 3 | Fetch failure makes the card say "Rien dans le garde-manger"; stale « Ce soir » copy |
| 10 | Help and Documentation | 3 | Prompt preview is great but 11px |

## Design Specificity Verdict
Authored at the edges (pinning your own dated products, "· ton foyer", verbatim prompt preview, the sheet becoming the wait), generic in the middle (24-chip Affiner any recipe app ships). Product cards sit white-on-white and read as a plain list, not your shelf.
Deterministic scan: 0 findings on both files; detector has weak coverage of RN camelCase style objects, so clean ≠ strong evidence. Browser overlay skipped (native screen).

## Priority Issues
1. [P1] Cards vanish in dark mode / white-on-white in light — CollapsibleCard fill gradientBottom (recipe-generate-screen.tsx:543), PantryProductCard cabinetRowSurface (pantry-product-card.tsx:52). Fix: cream card + creamPill product cards; FormField needs a fill override inside. colorize.
2. [P1] Pin/fetch state holes — summary counts products not pins; search-pinned product hidden after clearing; isError falls through to the empty state; « Ce soir » copy; pins keyed by name. harden.
3. [P1] Flat hierarchy + truncated subtitle — ScreenHeader subtitle numberOfLines=1 clips the thesis; card titles, group headings and field labels all 12/700. Shorten subtitle, card titles 14/800, drop duplicate helper. typeset, distill.
4. [P2] Accessibility — collapsible label hides the summary; header role on non-accessible XStack; "ton foyer" silent; hitSlop-only targets on web (no pressAreaSlop). harden, audit.
5. [P2] No Android press feedback — no android_ripple on the new pressables or Générer. adapt.

## Persona Red Flags
- Casey: Affiner below ~680pt of cards; no keyboard submit; wish and search fields adjacent.
- Sam: folded summaries unannounced; group headers likely not exposed on iOS; Générer caption not in hint.
- Jordan: truncated subtitle; "· 23" unexplained; households of 3/5 never see "ton foyer" (options 1/2/4/6).

## Minor Observations
Identical radii on the two stacked cards; ChefHat in header and button; GenerateButton radii vs DESIGN.md pill spec; selected card drops the Dépassé pill; prompt sentence capitalisation; DESIGN.md stale ("On part de", GeneratingOverlay, onboarding 46px line-height in prose).

## Questions to Consider
- 3 cards + "Voir tout" instead of 8, to bring Affiner above the fold?
- Does Affiner need 24 chips when free text already takes "rapide, sans four, végé"?
- Should these sections be cards at all, or flat sections on the ground?
