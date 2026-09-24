---
name: Fridge
description: A soft household dashboard for a shared fridge — playful, warm, and built entirely on numbers the foyer can act on.
colors:
  ground-mint: "#E9F6D8"
  ground-white: "#FFFFFF"
  ink: "#16211A"
  ink-secondary: "#6B7280"
  hero-mocha: "#6B5642"
  hero-mocha-text: "#FFFFFF"
  on-dark: "#FFFFFF"
  soon-on-dark: "#F0C46E"
  expired-on-dark: "#F0968A"
  layout-surface: "#EEE6DC"
  shadow-cool: "#0F2B1D"
  shadow-warm: "#3A2E20"
  accent-lime: "#C4E538"
  accent-lime-text: "#0F2B1D"
  accent-warm: "#FF8A3D"
  accent-warm-text: "#3D1B00"
  blob-strong: "#BFEE7A"
  blob-soft: "#EAF8D8"
  chip-orange: "#FF8A3D"
  chip-violet: "#8B7FD1"
  chip-teal: "#2FA88A"
  navcard-teal: "#1F7A62"
  navcard-violet: "#6355A8"
  cream: "#FDF6E8"
  cream-pill: "#FFFFFF"
  cream-pill-edge: "#C9BEA8"
  cream-text: "#7A6B47"
  lavender: "#EFEAFB"
  lavender-text: "#635B85"
  mint-pale: "#E1F3E6"
  mint-pale-text: "#35704E"
  fresh: "#3FAE6B"
  fresh-bg: "#DFF3E4"
  fresh-text: "#1F6B44"
  soon: "#C98A1E"
  soon-bg: "#FBEBC7"
  soon-text: "#8A5A12"
  expired: "#C6493B"
  expired-bg: "#FBDCD4"
  expired-text: "#B23A2E"
  scrim: "rgba(15,43,29,0.40)"
  cabinet-enamel: "#E3EBEE"
  cabinet-liner: "#F2F7F9"
  cabinet-seal: "#D3DFE4"
  cabinet-cold-light: "rgba(191,227,242,0.55)"
  shelf-glass: "rgba(150,196,214,0.42)"
  shelf-edge: "#B4CED8"
  cabinet-row-surface: "#FFFFFF"
  cabinet-ink: "#16211A"
  cabinet-ink-secondary: "#5A6B72"
typography:
  display:
    fontFamily: "System sans-serif (Tamagui defaultConfig — no custom typeface sourced yet)"
    fontSize: "24px"
    fontWeight: 800
    lineHeight: "30px"
  onboarding-display:
    fontFamily: "System sans-serif"
    fontSize: "44px"
    fontWeight: 900
    lineHeight: "52px"
    letterSpacing: "-1px"
  title:
    fontFamily: "System sans-serif"
    fontSize: "20px"
    fontWeight: 800
  body:
    fontFamily: "System sans-serif"
    fontSize: "14px"
    fontWeight: 500
  label:
    fontFamily: "System sans-serif"
    fontSize: "12px"
    fontWeight: 600
rounded:
  sm: "12px"
  md: "18px"
  lg: "24px"
  xl: "28px"
  xxl: "32px"
  pill: "999px"
spacing:
  xs: "6px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  xxl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.accent-lime}"
    textColor: "{colors.accent-lime-text}"
    rounded: "{rounded.pill}"
    padding: "0 24px"
    height: "50px"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.hero-mocha}"
    rounded: "{rounded.pill}"
    height: "50px"
  chip-status:
    backgroundColor: "{colors.fresh-bg}"
    textColor: "{colors.fresh-text}"
    rounded: "{rounded.pill}"
    padding: "4px 8px"
  chip-selectable:
    backgroundColor: "{colors.mint-pale}"
    textColor: "{colors.mint-pale-text}"
    rounded: "{rounded.pill}"
    height: "32px"
    padding: "0 12px"
    hitSlop: "6px 6px"
---

# Design System: Garde-manger

## Overview

**Creative North Star: "The Sunlit Pantry"**

Garde-manger reads as a fitness-app-bright kitchen dashboard: a near-white mint-to-white ground that feels like morning light through a window, one warm-mocha hero surface anchoring the eye like the one wooden shelf in an otherwise bright pantry, and lime accents standing in for fresh produce — the one saturated color the system spends on doing (progress, primary actions), never on decorating. The system went through two corrections to get here: the original hero card was near-black forest green ("too corporate," per feedback) and was warmed into mocha with an ember glow; the desktop layout surround was originally that same dark mocha ("too much brown") and was pulled all the way down to a near-white warm gray so the white content card would still read as the lighter of the two. Both corrections are now load-bearing invariants, not just history — see the Named Rules below.

Status (fresh/soon/expired) is always icon **and** color **and** word — a `StatusChip`/`StatusIcon` pairing carried over from an earlier direction specifically because it survives grayscale and color-blindness, and the team kept it on purpose when the rest of that direction was discarded.

**Key Characteristics:**
- Near-white mint blob ground on mobile; near-white warm-gray "mat" surround with an inset white content card on tablet/desktop — never a flat rectangle gradient, always a soft off-center radial blob.
- Exactly one dark, rich surface (the hero card) carries the "sole high-contrast block" role; everything else is light.
- Lime is reserved for interactive/progress meaning, never decoration.
- Exception: the AI quota bar (`AiQuotaHint`) fills with `mint-pale-text`, not lime — lime on a white or pastel surface is ~1.3:1, and a progress fill still has to clear 3:1. Its track is `ink` at 22 %. On the dark paywall the price and check marks are `on-dark`; lime there belongs to the CTA alone.
- Asymmetric corner radii (each major card gets its own, slightly different, corner set) instead of one uniform radius everywhere.
- Every status is icon + color + word, never color alone.
- Every pressable spring-scales on hover (web) and press (all platforms) — a felt, not just visual, response.

## Colors

Warm and near-white by design; color is spent deliberately (lime for action, one warm accent, a handful of pastels) rather than spread evenly across the surface.

### Primary
- **Accent Lime** (`#C4E538`): every interactive/progress element — primary buttons, the FAB, the sidebar's active nav pill, progress fills. Never used decoratively. Pairs with **Accent Lime Text** (`#0F2B1D`) for on-lime labels (≈10.6:1 contrast).

### Secondary
- **Hero Mocha** (`#6B5642`): the one deliberately dark, rich surface in the whole system (the "AUJOURD'HUI DANS TON FRIGO" hero card, the auth-screen equivalent, status toast). Carries white text (`#FFFFFF`, ≈6.9:1) and a low-opacity warm-orange ember glow in one corner for warmth.
- **Accent Warm** (`#FF8A3D`): the second bold hue — the hero card's ember glow (`HeroWarmGlow`), nowhere else. Paired text `#3D1B00` (≈10.6:1) for anything ever set on it. It used to also fill a tilted "12j sans gaspi" streak badge; that badge is gone (2026-09-05) because no "days without waste" concept exists in the domain, so nothing could compute it — it rendered a fixture number to every foyer.

### Tertiary
- **Chip Teal** (`#2FA88A`) / **Chip Violet** (`#8B7FD1`) / **Chip Orange** (`#FF8A3D`): saturated icon-chip fills inside the pastel stat cards — decorative-graphic use only (icons, not text), so they can stay lighter than the 4.5:1 text floor.
- **NavCard Teal** (`#1F7A62`) / **NavCard Violet** (`#6355A8`): darker siblings of Chip Teal/Violet, used only where the color carries white *text* (the Recettes/Courses tile titles) — the chip versions measure ~2.9:1 with white text and fail; these measure ~5-6:1 and pass.

### Neutral
- **Ground Mint → White** (`#E9F6D8` → `#FFFFFF`): the mobile background, a soft off-center radial blob (`BlobBackground`), never a flat top-to-bottom bar.
- **Layout Surface** (`#EEE6DC`): the tablet/desktop layout surround and sidebar — near-white with a warm-brown tint, always a visible step darker than the content card so the "mat around a print" effect reads.
- **`cream-pill` is the pill that sits *on* a `cream` card** (`#FFFFFF` light, `#3A3324` dark). Not `cream` itself, which would be invisible on the card, and never `gradientBottom`: that token is the page and content-card ground, so in dark mode a `gradientBottom` pill (`#120D08`) on a `cream` card (`#241F17`) reads as a hole punched through the row rather than a chip drawn on it. The relationship, not the hex, is the rule — lighter than the card it sits on, in both modes. In light mode that separation is only 1.08:1, because every darker fill drops the pill's own label under 4.5:1 — so `cream-pill-edge` (`#C9BEA8` light, `#6A5F47` dark) carries a 1px hairline of the label's ink instead, ~1.7:1 light and ~2.0:1 dark. That hairline is a control-sized mark, not an outlined surface: the border ban below is about containers.
- **Ink** (`#16211A`) / **Ink Secondary** (`#6B7280`): primary and secondary text on near-white grounds. Secondary text sitting on a *colored* card (cream/lavender/mint-pale) is never this flat gray — it's tinted from that card's own hue instead (`#7A6B47` on cream, `#635B85` on lavender, `#3D7A57` on mint-pale).
- **Cream** (`#FDF6E8`) / **Lavender** (`#EFEAFB`) / **Mint Pale** (`#E1F3E6`): the three pastel stat-card backgrounds, always used together as a set of three, never alone.

### Status
- **Fresh** `#3FAE6B` / bg `#DFF3E4` / text `#1F6B44`
- **Soon** `#C98A1E` / bg `#FBEBC7` / text `#8A5A12`
- **Expired** `#C6493B` / bg `#FBDCD4` / text `#B23A2E`

Status is derived in exactly one place — `productStatus`/`statusOf` in `src/presentation/dashboard/product-status.ts`. A date already past is `expired`; today through three days out is `soon`; no date at all is `fresh`. The fridge list once carried its own fractional-day copy of this, so the same yoghurt read "Bientôt" on one screen and "Expiré" on the next.

### Scrim
- **Hero pill fill** (`rgba(0,0,0,0.28)`): the status pills that sit *on* a dark hero card — a translucent wash, not a solid fill, so the ember glow still reads through them. `soonOnDark`/`expiredOnDark` are contrast-tuned against this exact value, so the three move together. It shipped four times as a bare literal before it was a token.
- **Scrim** (`rgba(15,43,29,0.40)` light / `rgba(0,0,0,0.62)` dark): the dimming layer behind a modal `ActionSheet`. Always a token, never an inline literal.
- **Camera Scrim** (`rgba(0,0,0,0.58)`, both themes): the wash behind everything drawn over a live camera feed — close, Galerie, the hint pill, a thumbnail's remove badge — always with `onDark` ink. The feed does not follow the theme, so neither does this. It exists because the Galerie pill was a white fill carrying `ink`, which is near-white in dark mode. All three scanners draw their overlay through `CameraChrome` (`src/presentation/shared/camera-chrome.tsx`): close top-left, corner-bracket guide shaped to the subject (ticket / frigo / code-barres) with its one-line hint, and a bottom bar with fixed start / shutter / end slots so the shutter never moves under the thumb.

### Appliance (Garde-manger screen only)
The fridge screen's cabinet is a disclosed, screen-scoped material exception, the same kind as the shopping list's legal pad — see the direction contract at the top of `src/presentation/fridge/fridge-cabinet.tsx`. The section is labelled **Garde-manger** everywhere it is named (tab, sidebar, header, body copy); **Frigo** survives only as one of the three storage locations inside it (Frigo / Congélateur / Placard), which is what `LOCATION_LABELS` still says.

- **Cabinet Enamel** (`#E3EBEE`) / **Cabinet Liner** (`#F2F7F9`): the body and the lit interior it frames. The liner is always the *lighter* of the two, in both themes — the light is inside the fridge.
- **Cabinet Seal** (`#D3DFE4`): the door gasket band along the top edge.
- **Cabinet Cold Light** (`rgba(191,227,242,0.55)` light / `rgba(95,168,199,0.20)` dark): the interior light wash falling from the top of the liner. It carries its own alpha rather than taking a shared `opacity`, because the dark theme's lamp is dimmer than the light theme's.
- **Shelf Glass** (`rgba(150,196,214,0.42)`) / **Shelf Edge** (`#B4CED8`): a shelf's translucent plate and the front lip under it. Two fills, never a stroke.
- **Cabinet Row Surface** (`#FFFFFF`): a product sitting on a shelf.
- **Cabinet Ink** (`#16211A`) / **Cabinet Ink Secondary** (`#5A6B72`): text inside the cabinet. The secondary is cool-tinted from the liner's own hue (≈5.3:1 on the liner, ≈5.5:1 on a row) rather than the system's flat `ink-secondary`, per the same rule the pastel cards follow.

**The Cold-Surface Rule.** These tokens exist to be the one *cold* surface in a warm system, and that inversion is the whole effect — an appliance reads as an appliance because everything around it is a sunlit pantry. They never appear on a screen that also carries the warm hero card, and no warm token is ever used inside the cabinet.

### Named Rules
**The One Dark Surface Rule.** Exactly one surface per screen is allowed to be rich/dark (the hero card, or the auth card's — no, the auth card is white; the hero-equivalent status toast). Two dark surfaces on one screen means the hierarchy broke; the fix is never "make it lighter," it's "which one loses hero status."

**The Layer Must Lighten Rule.** On tablet/desktop, `layoutSurface` (the surround) must always be visibly darker than `gradientBottom` (the content card). If a future token change makes them equal or inverts them, the inset-card effect the whole layout depends on disappears — this was a real regression once already.

## Typography

**Body/Display Font:** System sans-serif (Tamagui `defaultConfig`'s platform stack) — **no custom typeface has been sourced yet.** The brief calls for "une seule famille sans-serif géométrique" (one geometric sans); that choice is now **Plus Jakarta Sans** (variable, 200–800, OFL), self-hosted through `@fontsource-variable/plus-jakarta-sans` and already live on the landing site (`landing/`). Mobile still renders the system stack until it loads the same family (`expo-font`); the font-family values below stay placeholders until then.

**Character:** Hierarchy is built on size and weight only — never color. A label is always small/regular/secondary-toned above; a value is always larger/bold/ink-toned below.

### Hierarchy
- **Onboarding Display** (900, 44px, 52px line-height, -1px tracking): the pre-auth welcome screen's headline only — the one screen in the app that is a single decisive moment rather than a dense in-app view, so it earns a size above the in-app `display` ceiling rather than reusing it undersized. Sits inside the welcome screen's own hero panel, never loose over the photo.
- **Display** (800, 24px, 30px line-height): the hero headline ("3 produits à surveiller").
- **Title** (800, 20px): screen/card titles ("Content de te revoir", household name).
- **Value** (800, 22px): stat-card numbers (StatCard's `value`).
- **Body** (500–600, 13–14px): form fields, product names, nav labels.
- **Label** (500–700, 10–13px): secondary captions, status chip text, stat-card labels — always uppercase-optional, never colored for hierarchy alone.

### Named Rules
**The Size-and-Weight-Only Rule.** No token in this system uses color to create hierarchy between a label and its value. If a screen needs a label to stand out more, the fix is size or weight, never a brighter ink color.

## Layout

**The header is pinned, never scrolled.** Every screen passes its `ScreenHeader` to `AppShell`'s `header` prop, which renders it *outside* the ScrollView, on the same horizontal measure and max-width as the content beneath it. A screen used to lose its own name three swipes into a long garde-manger or a long ticket. **The pinned block carries no fill and no shadow.** It was given the ground colour plus a header-lift shadow to separate it from the content, but it is a sibling *above* the ScrollView, never a layer over it — nothing passes under it to be separated from, and the opaque fill only punched a flat band across the `BlobBackground`. The ground reads continuously from the title to the last card, exactly as it did when the header still scrolled.

**`AppShell` (`src/presentation/shared/app-shell.tsx`) is the layout contract — every screen renders through it, not a per-screen reimplementation.** An audit (2026-08-30) found this chrome copy-pasted independently across four screens, diverging each time, while two screens skipped it entirely — the mobile bottom nav and FAB worked on the dashboard alone. `AppShell` now owns both breakpoints below and the nav chrome; a screen supplies only its own header/content as children plus a `nav` prop:

- **`{ kind: 'tab', tab, onScan }`** — one of the four top-level sections (Accueil/Garde-manger/Recettes/Courses). Mobile gets the bottom nav; desktop gets the Sidebar with `tab` highlighted.
- **`{ kind: 'stack' }`** — a pushed, non-tab screen (Réglages, Foyer, Historique des tickets). Mobile carries no bottom nav (the screen renders its own `BackButton` in its header instead); desktop still gets the Sidebar, DESIGN.md's tablet/desktop frame being universal rather than per-screen-opt-in, with nothing highlighted since no tab is active.
- **`{ kind: 'modal' }`** — a modally presented screen (the recipe composer, `(tabs)/recipes/generate`). Same ground, safe area and content measure as everything else, but no bottom nav **and no Sidebar at any width**: a modal sits on top of the frame it was opened from, so re-drawing that frame's navigation inside it would offer a way out of a sheet that only Fermer should close.

**A `kind: 'stack'` screen lives at the route root, never inside `src/app/(tabs)/`.** Réglages, Foyer and Historique des tickets used to be files in that group. On iOS the group renders through `NativeTabs`, which only routes to the triggers its layout declares — so `router.push('/settings')` resolved to nothing at all and the app's single entrance to Réglages was dead. Marking a route `hidden` is not the escape hatch: expo-router documents that a hidden tab "cannot be navigated to in any way". The nav shape and the file location have to agree, and `src/presentation/shared/stack-routes.test.tsx` pins it. URLs did not change — `(tabs)` is a group, so `/settings` was already `/settings`.

**Mobile (< 768px):** a single scrolling column, `paddingHorizontal: 20`, capped at the device width. For `kind: 'tab'` screens, a floating glass pill (current section) + a lime FAB sit fixed at the bottom, overlapping the scroll content by design.

**Tablet/desktop (≥ 768px, `TABLET_BREAKPOINT`, exported from `app-shell.tsx`):** a two-pane frame replaces the phone chrome entirely — no floating pill, no FAB. A fixed 220px sidebar (`layoutSurface` background, no card of its own) sits flush against a white content card (`gradientBottom`) that is centered and width-capped at 640px, with a 16px (`$4`) margin of `layoutSurface` visible on every side of the content card, including the edge facing the sidebar. The whole frame — sidebar and content together — is one `overflow:hidden`, `borderRadius:28` box; the sidebar never has its own separate radius/shadow.

`AppShell` wraps children in its own `ScrollView` by default. A screen that owns a virtualized `FlatList` instead (fridge, receipts) passes `scrollable={false}` and builds its list's `contentContainerStyle` from the exported `shellContentStyle()` + `useAppShellLayout()` helpers, so its padding/max-width still matches every other screen exactly.

Every `flex:1` box in a scrollable chain declares `minHeight:0` explicitly — a CSS default (`min-height:auto`) that silently breaks nested scroll containers on web and was the root cause of two real layout bugs during this build.

## Android: Material 3

Android is not the iOS app repainted (2026-09-06, asked for directly). The palette, the type and the shapes are unchanged — Material is a rulebook, not a skin, and its own guidance is that brand expresses *through* its theming. What changes on Android lives in `src/presentation/shared/material.ts`:

- **Color roles, not hexes.** `materialRoles(palette)` answers `surface` / `surfaceContainer` / `secondaryContainer` / `inverseSurface` / `onSurfaceVariant` from the committed palette. A Material component asks for a role; it never invents a colour.
- **Navigation bar, not a floating pill.** `MaterialTabNav` is a full-width 80dp bar on `surfaceContainer`, flush to the bottom edge, with M3's 64×32 active-indicator pill behind the *glyph only* and the label always visible. The FAB moves above it at the trailing edge. iOS keeps `NativeTabs` with SF Symbols; web keeps the frosted glass pill.
- **Ripple, not scale.** `useHoverPress` returns a flat scale on Android; callers pass `android_ripple={ripple(...)}`. A control that both ripples and shrinks reads as two responses to one tap.
- **Tonal elevation.** `surfaceShadow(palette, level, ios)` returns a Material `elevation` on Android and this system's wide soft shadow everywhere else.
- **Snackbar.** `HintBubble` renders M3's left-aligned 4dp rectangle on `inverseSurface` above the navigation bar on Android, and the centered brand pill on iOS/web.
- **Predictive Back is on** (`app.json`), and the orientation lock is gone so the tablet two-pane layout can actually be reached.

## Loading

**A pending screen keeps its shape.** `Skeleton` / `SkeletonRow` / `SkeletonCard` / `SkeletonList` (`src/presentation/shared/skeleton.tsx`) replace the word "Chargement…" everywhere a list or a record is fetching. The blocks are `cream` — this system's quiet surface — pulsing slowly, held still under Reduce Motion. Every block sets `accessibilityElementsHidden`; the surrounding `SkeletonGroup` carries the single label, so a screen reader hears "Chargement du garde-manger" once rather than twelve anonymous rectangles.

The exception is a *number*: the dashboard's stat cards still show `—` while loading rather than a skeleton, because an honest blank is more truthful than a shape that implies a value is coming.

**Every asynchronous action shows it is running.** `AuthButton` swaps its icon for a spinner and its label for `pendingLabel`. A label change alone is a state you have to read.

**A screen that does one thing becomes the wait; it does not raise a popup over itself.** The recipe composer unmounts its form while generating and holds a single centred state — dots, headline, what it is cooking from — on the sheet's own ground. It used to dim itself behind a scrim and float a second rounded card on top: a modal over a modal, whose scrim quietly claims the form is still yours when the question has already been sent and nothing you touch can change the answer. Unmounting also retires the `accessibilityElementsHidden` fence the scrim needed; controls that are gone need no fence. The header keeps naming the screen and drops its close button for the duration, because the call cannot be cancelled.

**The foyer belongs on the foyer's home screen.** `MemberAvatars` (`src/presentation/shared/member-avatars.tsx`) sits beside the household name on the dashboard and the block is the way into Réglages → Foyer. The one thing separating this product from a personal fridge tracker is that several people share the shelf, and it used to render in exactly one place — two taps deep, on a screen nobody opens.

**A wait with no measurable progress gets `PulseDots`, not the OS spinner** (`src/presentation/shared/pulse-dots.tsx`). Three dots in the chip colours (orange / violet / teal), rising and dimming in a 150ms stagger so the row reads as one movement travelling across it; still and fully lit under Reduce Motion, like `Skeleton`'s shimmer. An `ActivityIndicator` is the one thing on screen drawn by the platform instead of by this system, and it lands on the screen whose entire job is a several-second wait. Dots never fade to 0 — a dot at zero reads as a gap in the row, not as a beat. The row carries one `progressbar` label; the dots themselves are not announced. Use a `Skeleton` instead whenever you know the shape of what will land: dots are for time you cannot draw, which on the composer is literal — nothing arrives on that screen at all, the sheet closes onto the recipe.

**A fake that answers instantly hides the state it is meant to exercise.** `FakeFridgeConnector` waits `DEFAULT_AI_LATENCY_MS` (2200) before `generateRecipes` resolves — success *and* failure alike, because a real provider spends the same seconds either way and an error that returns instantly teaches the wrong shape. Tests that want the generated data rather than the wait pass `{ aiLatencyMs: 0 }`. Any future fake that stands in for a slow call gets the same treatment; a loader you cannot see is a loader nobody can judge.

## Elevation & Depth

Hybrid: flat color fields for status/pastel surfaces, wide/soft/low-opacity shadows for anything meant to feel like it's floating (cards, the FAB, the sidebar+content frame). No hard-edged or high-opacity shadows anywhere — the "wide, diffuse, low-opacity" shadow is a direction invariant from the original brief.

### Shadow Vocabulary
- **Card-float** (`shadowColor:'#0F2B1D', offset:{0,10}, opacity:0.1, radius:18-20`): stat cards, the identity cards.
- **List-container** (`shadowColor:'#0F2B1D', offset:{0,8}, opacity:0.06, radius:14`): the lightest of the set — a white panel that holds rows rather than a card that floats. The dashboard's "À consommer en premier" preview and its `ReceiptsRow`, the composer's `CollapsibleCard`s ("Sous la main", "Affiner") — filled `cream`, never `gradientBottom` (the ground itself, invisible in dark mode). Anything sitting on one of those cards (`PantryProductCard`, `FormField surface="card"`) takes `creamPill` + a 1px `creamPillEdge` hairline and no shadow of its own.
- **Hero-lift** (`shadowColor:'#0F2B1D', offset:{0,16}, opacity:0.22, radius:28`): the hero card, NavCards — heavier than card-float because these carry more visual weight.
- **Frame-lift** (`shadowColor:'#3A2E20', offset:{0,10}, opacity:0.16, radius:22`): the desktop content-card-inside-frame shadow — warmer shadow color than the others (`#3A2E20` vs `#0F2B1D`) because it sits against the warm `layoutSurface`, not the mint ground.
- **FAB-lift** (`shadowColor:'#0F2B1D', offset:{0,10}, opacity:0.28, radius:16`): the floating action button, the most elevated single element on the mobile screen.

### Named Rules
**The Warm-Shadow-on-Warm-Ground Rule.** A shadow cast onto `layoutSurface` uses a warm shadow color (`#3A2E20`); a shadow cast onto the mint/white ground uses the cooler `#0F2B1D`. Matching the shadow's undertone to what it falls on is why the frame reads as sitting *in* the surround rather than pasted on top of it.

## Shapes

Every major surface gets its own **asymmetric** corner radius — two opposite corners larger, two smaller — rather than one uniform radius reused everywhere. Three named corner sets rotate across the stat cards and NavCards (`corner="a"|"b"|"c"` in `StatCard`, `"a"|"b"` in `NavCard`) so a row of same-purpose cards still reads as organic, not stamped. The hero card and auth card use a consistent 36/20/36/20 (px) pattern. Full-pill (`999px`) radius is reserved for anything that's a status/action/badge (chips, buttons, the FAB) — never for a content container.

No borders anywhere in the system. Separation between surfaces is color contrast and shadow, never a stroke.

### Named Rules
**The No-Uniform-Radius Rule.** If two adjacent cards in a row share an identical corner radius, that's a miss, not a simplification — pull one of the three named corner sets instead.

## Components

### Buttons (`AuthButton`, the FAB, the sidebar Scanner button)
- **Shape:** full pill (`999px`), height 50px (auth buttons) or 56×56 circle (FAB).
- **Primary:** `accent-lime` background, `accent-lime-text` label, no border.
- **Secondary:** transparent background, 2px `hero-mocha` border, `hero-mocha` label (the PocketID button).
- **Hover / Press:** every button spring-scales via `useHoverPress` — ×1.035 on web hover, ×0.96 on press-in, spring back on release. Disabled state drops opacity to 0.6 and disables the press handler; the label swaps to a `pendingLabel` ("Connexion...", "Inscription...") rather than adding a spinner.

### Browser defaults are part of the design
The parts of a web build nobody drew still carry a look, and it belongs to no design system. Three places answer for them:

- **`installWebSurfaces`** (`src/presentation/shared/web-surfaces.ts`), injected once at the root from the committed palette. It carries what a React Native style object cannot express, because it is a CSS state selector: **`:focus-visible`**, text selection, and `accent-color`. The focus ring is the load-bearing one — `react-native-web` renders every `Pressable` with `outline: none`, so before this the only keyboard-visible focus anywhere in the app was `FormField`'s lime border, and every card, chip, pill and the bottom nav were invisible to a tabbing user. `:focus-visible` rather than `:focus`, so a mouse press never draws a ring, and no radius of its own, so the outline follows whatever shape the control already has.
- **`pressAreaSlop`** (`hover.ts`). This system's single answer to the 44pt touch target is "don't grow the control, grow its press area" — `Chip` is 32pt tall for exactly that reason. **`react-native-web` ignores `hitSlop` entirely**, so on web each of those controls was its drawn size and under the floor, while the code read as compliant. Negative margin plus matching padding is the same trick in CSS: the press box grows, the layout does not move. Spread it *alongside* `hitSlop`, never instead of it. Keep the horizontal expansion small — the chip-row `gap="$3"` rule exists so two facing press areas do not overlap, and a wide expansion re-creates the overlap it prevents. An *absolutely positioned* control takes plain padding and anchors at 0 instead; negative margin would move it.
- **`pointerCursor`** (`hover.ts`), spread by every `Pressable`: it sets `cursor: 'pointer'` **and `textAlign: 'start'`**, because RN Web renders `accessibilityRole="button"` as a real `<button>` and the UA stylesheet centres a button's text. Every card that is also a control — recipe rows, product rows, nav cards — was centring its title and body copy on web only, against a left-aligned layout on every other platform. `start`, not `left`, so the rule follows the writing direction instead of replacing one browser assumption with another. **A new pressable surface adopts `pointerCursor`; it does not re-solve this locally**, and a control nested inside another control is a *sibling* of it in the tree, never a child — a `<button>` inside a `<button>` is invalid HTML.

### Chips
- **Status chip** (`StatusChip`): pill, status-bg fill, status-text label + a matching icon (`CircleCheckIcon`/`TriangleAlertIcon`/`CircleXIcon`) — always icon+color+word together.
- **Selectable chip** (`Chip`, `src/presentation/shared/chip.tsx`): pill, **32pt tall** (`size="dense"` → 28), `accent-lime`/`accent-lime-text` when selected and `mint-pale`/`mint-pale-text` when not, always carrying `accessibilityState={{ selected }}`. Used for locations, units, category suggestions, expiry shortcuts, compartment filters and AI providers — one component now, after three near-identical copies (fridge form, fridge list, settings) had each drifted apart.
  - **Chip rows need `gap="$3"` (12pt).** The slop is what makes the small chip legal, so the spacing between chips became load-bearing: two chips closer than the sum of their facing slops have overlapping press areas, and a tap in the overlap lands on whichever is on top.
  - **The height is not the touch target.** It used to be `minHeight:44`, which made a row of options read as a stack of buttons inside a form — the complaint that produced this component. 44 was the accessibility floor, never a look, so the floor moved onto the press area: the chip carries a symmetric `hitSlop` that pads the tappable region back past 44 in both axes. Any future resize keeps that invariant (pinned by `chip.test.tsx`); shrinking the box without widening the slop is a regression, not a refinement.
  - **An icon only when it distinguishes.** A chip takes an optional 13px glyph tinted to match its label — the three location chips carry theirs everywhere they appear, so "Congélateur" is recognisable before it is read. A row of chips that would all carry the *same* glyph (four date shortcuts, three AI providers) carries none: an identical icon repeated down a row is decoration, and the labels already say it.

### Cards / Containers
- **Hero card / auth card:** asymmetric 36/20/36/20px radius, `hero-mocha` or white fill, hero-lift shadow, a low-opacity warm radial glow (`HeroWarmGlow`) in one corner. The auth card had drifted to 32/20/32/20 and a lighter warm shadow (0.12 opacity, `shadowWarm`) before a pass that brought it back to this exact spec — `shadowCool`, not `shadowWarm`, since the card sits on the mint/photo ground, not `layoutSurface` (see the Warm-Shadow-on-Warm-Ground Rule under Elevation). Sign-in/sign-up's ground (`AuthScreenChrome`'s `background="photo"`) is the same warm kitchen photo the welcome screen opens on, dimmed by `scrim` — reused exactly as documented ("something else has the floor"), not a fresh literal — so the pre-auth funnel reads as one continuous moment; the threshold screen keeps the plain blob ground, unasked. The card's own title runs the `display` scale (24/800) — up from the in-app `title` scale (20/800) it used before, since this is the first screen a signed-out visitor focuses on, not a dense in-app view.
- **Stat card:** flex-1, one of three asymmetric corner sets, pastel fill (cream/lavender/mint-pale), a 36×36 saturated icon chip, card-float shadow. **A StatCard counts; it does not name.** A metric fits in half a phone width, a household name does not — Réglages opened on a StatCard pair and rendered "Le foyer de F…" on every phone.
  - **A card that counts a set of things opens that set.** All three dashboard metrics take `onPress` and spring like a `NavCard`: "Cette semaine" and "Dates dépassées" open the garde-manger already filtered to what they counted, "À racheter" opens the liste de courses. A number that names a group of products and then refuses to show them is a dead end wearing a summary's clothes. `onPress` stays optional so a card that genuinely leads nowhere stays inert instead of springing under the finger and doing nothing.
  - **Every level of a pressable card carries the stretch.** Wrapping the card in a `Pressable` + `Animated.View` moved it two levels off the row, and `flex:1` on the wrappers alone let the row equalise *them* while the pastel fills kept their own content heights — three cards ending at three different baselines on web, where "Dates dépassées" wraps to two lines and the others don't. Both wrappers carry `flex:1` **and** `alignSelf:'stretch'`, and the row states `alignItems="stretch"` rather than relying on the default.
- **Identity card (`IdentityCard`, `src/presentation/settings/identity-card.tsx`):** the StatCard language turned on its side for the things that carry a *name* — full width, the icon chip beside the text instead of above it, its own wider asymmetric corner set (30/16), an optional trailing badge and an optional footer row. Réglages' account and foyer cards; the foyer's carries a `RoleBadge` and `MemberAvatars` (up to three overlapping initials then a "+N" disc, filled `navcard-teal` because they carry white text).
- **Pill button (`PillButton`, `src/presentation/shared/pill-button.tsx`):** the one lime action pill — 44pt, full-pill radius, optional leading glyph tinted to the label, hover/press spring, `alignSelf:'flex-start'` (a Pressable in a YStack stretches, and a pill that stretches stops being a pill). `tone="quiet"` is the `cream` secondary that stands beside it. It replaced five independent implementations that had drifted in padding, hover wiring and stretch behaviour; the chips were consolidated long before the pills were. `AuthButton` stays separate — it is the 50pt full-width form submit of the auth screens.
- **NavCard:** asymmetric corner set, `navcard-teal`/`navcard-violet` fill, an `IllustrationSlot` (blurred radial glow + a bundled 3D illustration or a flat icon fallback tagged "3D · bientôt"), hero-lift shadow, hover/press spring.
- **Internal padding:** `$4` (16px) to `$5` (20px) depending on card size.

### Inputs / Fields (`AuthField`, `FormField`)
Two components, one recipe: `AuthField` on the auth screens, `FormField` (`src/presentation/fridge/form-field.tsx`) everywhere else.
- **Style:** `minHeight` 48 (auth) / 44 (forms) — never a fixed `height`, so large Dynamic Type sizes grow the field instead of clipping it — 12-14px radius, `cream` fill, 2px transparent border, label above.
- **Focus:** border shifts to `accent-lime` (2px) — the only focus treatment in the system; no glow, no shadow change.
- **Error:** `FormField` takes a per-field `error`, which turns the border `expired` and prints the message under that field with `accessibilityLiveRegion="polite"`. `AuthField`'s errors still surface as one `AuthError` coral chip below the stack. A form-wide summary may accompany per-field errors; it must never replace them — an unanchored "un champ est invalide" at the bottom of a long card is not recoverable.
- **Keyboard:** any numeric or date field passes `keyboardType`. Making a user find digits on the alphabetic keyboard while holding groceries is a defect, not a detail.

### Errors on shared state
**A screen that lists shared household state must branch on `isError` before it branches on emptiness.** The same defect shipped four times independently: `ListEmptyComponent` tested `isPending`, then emptiness, and a failed read fell through the gap — so an unreachable server told a foyer "Les étagères sont vides", Réglages said "Aucun foyer", and the receipt history reported zero tickets. On shared state that is not a missing state, it is a confident false claim, made on the screens people open standing in a kitchen on one bar of signal; and the recovery each one offered ("scan something") could not work either. Every such screen now names the failure and offers a `PillButton` retry, and `src/presentation/shared/query-error-branch.test.ts` pins the six list screens so a seventh cannot forget.

### Selecting several products (`SelectionBar`, garde-manger)
**A long press opens a selection; a tap inside it selects instead of navigating.** Long press, not a swipe — the same non-gesture path the shopping list already establishes, and the one a pointer and a screen reader can both reach. The `SelectionBar` *replaces* the title block rather than stacking under it, because a mode has to look like one: the search field and the compartment chips steer a list you are browsing, which is not what you are doing. One `ActionSheet` names the consequence for the rest of the foyer once, for all N products.

This exists because the app had exactly one way for a product to leave the fridge — the detail screen's destructive sheet, one product at a time. A foyer that cooked the recipe the app wrote them still had to open, confirm and dismiss three times to say so, "Dates dépassées: 6" was a link to eighteen interactions, and the count greeting everyone each morning could only ever climb. That turns the home screen from a tool into an accusation.

### Filtered destinations
**A filter that arrives from elsewhere is a URL parameter, and it says its own name.** The dashboard's stat cards open `/(tabs)/fridge?status=week|expired`; the route parses it (`parseExpiryWindow` — anything unrecognised filters nothing) and hands it to the screen as a prop. The screen never copies it into `useState`: a second tap from the dashboard lands on an already-mounted list, and an initial state value does not run twice.

**And it is always removable.** The window is a chip in the garde-manger's own filter row, selected when the parameter is set; pressing the selected one clears it. A list that silently hides two thirds of the fridge is the worst thing a deep link can do, so the control that says *which* filter is on is also the control that turns it off — which is why this axis needs no "Tout" of its own beside the compartments'.

**Two axes, one scrolling line, one separator.** The compartment chips answer *where is it*, the expiry windows answer *how long has it got*, and both can be on at once. They share the single horizontally-scrolling row rather than opening a second permanent one — the row already scrolled (four compartment chips overflow below ~340pt), and a `ChipGroupSeparator` (1×20 hairline, `shelf-edge`) marks the break so six chips do not read as one list of mutually exclusive options. The windows come first, so one arrived at from a dashboard card is selected *and* visible without scrolling. A hairline between two groups of controls is not a container border: DESIGN.md's ban is on outlining surfaces.

**The threshold lives in `product-status.ts`, never inline at the call site.** `matchesExpiryWindow` is used both by the card that counts and by the list it opens — the same reason that file exists at all. The dashboard's old inline copy was `daysLeft > 0 && daysLeft <= 7`, which left a product expiring *today* out of both "Cette semaine" and "Dates dépassées": survivable in a number, not in a link.

### Réglages holds configuration, never content
**A list of what the foyer did is not a setting.** The receipt history sat under a "Données" heading in Réglages — the screen you open to change how the app behaves — as a row with a label and a chevron promising nothing. It is now a `ReceiptsRow` on the dashboard under "Accès rapide", filled `cream` — **never `gradientBottom`, which *is* the ground**: a card in the ground's own colour survives in light mode only because the shadow reads there, and in dark mode the shadow is a faint warm glow, so the row disappeared into the page. It carries the count and the last store scanned so there is a reason to tap it, and the receipts list's empty state offers the scanner instead of a full-stop sentence. A full-width row rather than a third `NavCard`: the two saturated tiles are the tab sections, and a third would claim receipts are a fifth one.

**A setting says what it changes, and a choice of one is not offered.** The AI section is titled by its effect ("Intelligence artificielle", *"Lit tes tickets de caisse et invente tes recettes."*), not by its implementation ("Fournisseur IA"). The provider chips appear only when `availableProviders.length > 1`; one provider with credentials is stated as a fact, none at all says so outright. The gate is never `source` — that field only records whether anyone has picked yet (a stored row always beats the env default, see `env-ai-settings-provider.ts`), so rendering it as "Configuré par l'administrateur" described a lock that does not exist.

### Screen header (`ScreenHeader`, `src/presentation/shared/screen-header.tsx`)
Every screen's title block: an optional `BackButton`, a 38pt tinted square holding the section's own glyph, the 20/800 title, an optional 13/500 subtitle under it, and an optional trailing action pill. **The row is `minHeight:44`, so its height never depends on what is in it** — a header carrying an "Ajouter" pill (44pt) used to stand taller than one without (the title+subtitle block alone measures ~42pt), which put Garde-manger's and Courses' titles a couple of points below Recettes' and made the title jump as you moved between tabs. Six screens each hand-rolled this and none of them carried an icon, so a screen announced itself with a word alone — which is fine on the screen you are looking at and poor across a stack of them. The glyph is always the same one the tab bar and the sidebar use for that section; the fridge overrides the square's `tint` to `cabinet-enamel` so its header reads as part of the appliance below it.

Icons are equally load-bearing inside forms: `FormField` takes an `icon` on its **label**, not inside the input — a glyph in the field competes with the caret and the placeholder for one line, and a five-field form is scanned by its labels.

### Pull-to-refresh (`usePullToRefresh` / `pullToRefreshControl`, `src/presentation/shared/pull-to-refresh.tsx`)
Every screen that reads shared household state can be pulled down to re-read it. This is a product requirement, not a gesture nicety: a fridge is shared, so the list on your phone goes stale the moment a flatmate scans a receipt, and the only ways to re-read it were killing the app or tapping "Réessayer" inside an error card that only appears once the fetch has already failed — there was no way at all to refresh a screen that had loaded fine and simply gone out of date.

- A screen passes `refresh={usePullToRefresh(...)}` to `AppShell`; a screen that owns its own list (`scrollable={false}` — fridge, receipts) hands `pullToRefreshControl(...)` to that list instead.
- **Pass every query the screen shows.** They refetch together; a screen that refreshes half of what it displays is worse than one that refreshes none of it, because the two halves then disagree.
- `refreshing` is local state, never `query.isFetching` — TanStack flips `isFetching` for background refetches the user never asked for, which would make the spinner appear on its own.
- The spinner is `accent-lime`: it is a progress indicator, which is exactly what the accent is reserved for.

### Action sheet (`ActionSheet`)
The app's one modal. Options are separate card-buttons on a `layoutSurface` sheet; a `title` (and optional `description`) names what is being decided, a `destructive` option carries `expired-bg`/`expired-text`, and every sheet ends with an "Annuler" row. Any irreversible action on shared household state — deleting a product or a shopping item, removing a member, leaving a foyer, discarding an unsaved form — goes through one, and its copy names the consequence for the rest of the foyer.

### Scan (`useScanSheet`, `ScanScreen`)
The lime FAB means one thing on every tab: scan a product, or scan a receipt. `useScanSheet` owns both the sheet and the two destinations, and iOS's native "search"-role tab renders the same two choices as a real screen. Nothing in the app opens a different scan affordance per screen.

### Navigation
Owned entirely by `AppShell` (see Layout) — no screen wires its own nav chrome.
- **Mobile:** a floating glass pill (`expo-blur` `BlurView`, `intensity:40`, `tint` following the active color scheme via `palette.blurTint` — a hardcoded `tint="light"` shipped once and stayed a light frosted pill in dark mode until caught) showing the current section, plus the lime FAB, both fixed to the bottom, overlapping scroll content. Present on `kind: 'tab'` screens only.
- **Desktop/tablet sidebar (`Sidebar`, `src/presentation/shared/sidebar.tsx`):** `layoutSurface` fill, no border/shadow of its own (part of the shared frame). Five items — Accueil / Garde-manger / Recettes / Courses, then Réglages (never highlighted: it is a stack screen, not a tab). Active item = full-lime pill with `accent-lime-text` label; inactive items = transparent, `ink` label, `ink-secondary` icon; a `kind: 'stack'` screen shows the sidebar with none active. One `flex:1` spacer pushes the Scanner button to the bottom.

## Do's and Don'ts

### Do:
- **Do** keep `layoutSurface` (`#EEE6DC`) visibly lighter-than-mocha but visibly darker than `gradientBottom` (`#FFFFFF`) — the whole desktop layout depends on that two-step relationship holding.
- **Do** pair every status color with its icon and word (`StatusChip`, `StatusIcon`) — never ship a color-only status indicator.
- **Do** give every new major card its own asymmetric corner set, drawn from (or extending) the existing three-set rotation.
- **Do** set `minHeight:0` on every `flex:1` box in a chain that ends in a `ScrollView` — this is a recurring, real web bug in this codebase, not a style nitpick.
- **Do** honor/press-scale every new Pressable via `useHoverPress` (`src/presentation/shared/hover.ts`) rather than adding a bespoke animation.
- **Do** write expiry in the register of a cook, not a food inspector. `expiryLabel` (`src/presentation/dashboard/product-status.ts`) is the single source of that vocabulary — "À consommer aujourd'hui / demain / sous N j", "Date dépassée de N j", and status words "Frais / En premier / Dépassé". The date is a fact worth stating plainly; "périmé" is a verdict on the food and, by implication, on the household. It matters twice over here because the garde-manger is shared: "3 périmés" on the dashboard was a scoreboard a flatmate reads. The glyph follows the words — a section that merely *lists* what to cook first carries the garde-manger's own `PackageIcon`, never a `TriangleAlertIcon`. The warning glyphs stay where the icon+colour+word rule wants them: on the status pills themselves.
- **Do** give a *group label* its own glyph when a screen stacks several groups that ask different questions (the recipe composer's six: repas / temps / régime / cuisine / en cuisine / portions). This is the same argument that put a glyph on `FormField`'s label and on `ScreenHeader` — and it is the exact complement of the ban below: the labels distinguish, the chips inside one group would not.
- **Do** disclose a placeholder honestly (an unbuilt illustration, an unsent route) — `IllustrationSlot`'s "3D · bientôt" tag exists specifically so an unfinished feature never ships as a silently dead control. The bar rose in 2026-09: a hint is for a genuinely unbuilt feature, never for a control that *could* be wired. "Bientôt disponible" was sitting on the recipe cards, the Recettes FAB and the Courses FAB while every endpoint behind them was already shipped.
- **Do** give every screen its real loading, empty and error states, and put the next action inside the empty one. `return null` while a query settles is a blank white screen with no chrome and nothing to announce; an empty state that only names the void makes the user find their own way out.
- **Do** let a screen ask for something only the user knows, and answer the rest itself. The recipe composer marks the Portions chip that matches `household.members.length` with "· ton foyer" instead of asking a household of three to tap "Pour 4" forever, and its "Sous la main" product cards are pressable so a cook can build the recipe around one of their own products — the one control in that form no generic recipe app can offer. A group of chips that re-asks a standing fact is friction the product created by not consulting itself.
- **Do** show the machine's actual input when the user composed it. The composer prints the sentence it will send ("On demandera : « … »") rather than counting the boxes ticked.
- **Do** confirm anything irreversible through an `ActionSheet` that names the consequence — never by swapping a button in place, which turns an impatient double-tap into a deletion on shared state.
- **Do** give every screen that reads shared household state a pull-to-refresh, and wire *all* of its queries into it — the foyer is the unit of truth, so any screen can be made stale by someone else's phone.
- **Do** put a `kind: 'stack'` screen at the route root, not in `(tabs)/` — the file location and the nav shape must agree or iOS silently drops the route.
- **Do** put a self-contained sub-task behind a `presentation: 'modal'` route with `{ kind: 'modal' }` — the receipt scanner and the recipe composer both. A form six groups deep unfolding inside a list pushes the content it is supposed to sit beside off the screen.
- **Do** give a seconds-long request a loader that names what is happening and what it is working from (`GeneratingOverlay`), not a button that goes quiet. An AI call is the one place in this app where nothing visible happens for several seconds.
- **Do** anchor an absolutely-positioned fill (a glow, an overlay) to an *unpadded* parent, with all four insets pinned. The hero card's `HeroWarmGlow` pinned only `top/left` and asked for `width:100%`, which measured the padded content box: the warm corner stopped 20pt short of the card on every side and read as a floating blob rather than light falling across it.
- **Do** route every screen through `AppShell` rather than reimplementing BlobBackground/SafeAreaView/ScrollView/Sidebar chrome locally — that duplication is exactly what left the mobile FAB and bottom nav working on the dashboard alone.

### Don't:
- **Don't** hand-roll a screen's own responsive shell (breakpoint check, Sidebar wiring, safe-area, background) — extend `AppShell` instead. This was a real, audited regression: four screens each reimplemented it slightly differently, and two skipped it entirely.
- **Don't** use `#0F2B1D`-family near-black greens anywhere — that was the original hero color, rejected as "too corporate/cold," and the whole warm-mocha identity exists specifically to replace it.
- **Don't** use `chip-teal`/`chip-violet`/`chip-orange` behind white *text* — they measure below 4.5:1 with white text; use the darker `navcard-teal`/`navcard-violet` siblings for anything text-bearing.
- **Don't** add a second dark/high-contrast surface to a screen that already has the hero card — one rich surface per screen, always.
- **Don't** add a visible border/stroke to any container — separation comes from shadow and color contrast only. (A field's 2px focus ring is a state, not a container border; the shopping list's dashed tear-line is a disclosed material exception.)
- **Don't** render product counts, household names or any other domain number from a fixture. The dashboard shipped on `dashboard.fixture.ts` for a while: it named every foyer "Foyer Leroux" and kept claiming 12 products after a 20-item receipt import. A number with no source is worse than no number.
- **Do** close the loop the app opened. "Ce soir" recommends a dish to save a product; `CookedAction` on the recipe detail is how the foyer says it worked, and it *consumes* the matched products rather than only counting a cook. Without it the same dish was recommended for the same product the next evening while the dashboard's overdue count climbed — the app could recommend, and never learn. It is deliberately **not** lime: the screen's one primary action is still "ajouter les manquants", and this is what you press after the dish exists. It names what will leave the fridge under its own label, and confirms through the same `ActionSheet` as deletion, because taking food out of a shared garde-manger is destructive on shared state.
- **Do** put a name and a history on anything the foyer shares. A recipe carries `createdBy`, `cookCount`, `lastCookedAt` and `lastCookedBy`; `provenanceLine` (`src/presentation/recipe/attribution.ts`) turns them into the one line a row can spend — **what the foyer did outranks who typed it in** ("Cuisinée 2 fois · Camille, hier" beats "Ajoutée par Camille"), and your own name reads as "toi". The ids resolve against the household's own member list, so a member who has left resolves to *nothing* rather than to a name the foyer no longer knows, and a row that predates attribution says nothing rather than guessing. Four people were generating into one anonymous list whose only order was an invisible timestamp.
- **Do** let one join answer one question for every screen that asks it. `matchPantry` (`src/presentation/recipe/pantry-match.ts`) is the only place that decides whether the foyer owns an ingredient, and `pantrySentence` is the only place that says so in words. The list card computed it with a name heuristic while the detail screen split on `productId !== null` — a field the backend sets to `null` on every AI-generated ingredient, i.e. all of them — so the list promised "2 sur 3 chez toi" and the detail screen then offered to *buy* the spinach it had just said you owned. The same fact was also spelled three ways on one screen ("2 ingrédients sur 3 chez toi" / "2/3 chez toi" / "2 sur 3 chez toi"), which reads as three different facts.
- **Do** say a destructive action is running, and put the row back if it fails. A confirmed deletion removes its row optimistically (`queryClient.setQueryData`), dims and disables it while the server answers, and **restores it** on failure with the failure said in the row's own place — not only in a toast that erases itself in 3.2s. On a library four people share, "I think I deleted our recipe but it's still there" is the anxious case. There is deliberately **no undo**: `FridgeConnector` exposes no way to recreate a recipe, and an "Annuler" that cannot restore is worse than none — the ActionSheet naming the consequence *before* the fact is this action's protection.
- **Do** pin the filter *state* when you cannot pin the filter *controls*. Garde-manger pins its whole search-and-chips block, and the argument holds: scrolling a list must not take away how you steer it. Recettes' first viewport belongs to "Ce soir" — a cook at 19h must not meet a filter bar before their dinner — so only the cost of scrolling is fixed: when a filter is on, a compact pinned bar names each one, counts the results in a live region, and offers the way out from anywhere in the list. When nothing is filtered it does not render. A section heading must never double as that readout: flipping "Toutes les recettes" to "N résultats" in the same slot at the same weight turns a place into a number the eye has to re-parse.
- **Don't** leave a gesture as the only path to an action. The shopping list's edit and delete were swipe-only, which is invisible to a first-timer and unreachable with a screen reader; they now answer to a long press too.
- **Don't** set a unicode glyph where an icon belongs — `←` for a back arrow and `+` for an add button both shipped, and both carried the platform font's weight and baseline instead of this system's 2px round stroke. `ArrowLeftIcon` and `PlusIcon` exist for exactly those two.
- **Don't** repeat one identical icon down a row of chips or list items. An icon that does not distinguish its row from its neighbour is decoration; drop it and let the labels work.
- **Don't** wrap a scrolling rail's cards in a container that clips their shadows. A ScrollView clips on both axes — `overflow-x: auto` implies `overflow-y: auto` — so a soft 28pt blur ended on a hard horizontal line against the rail's edge. Pad the content container by the shadow's reach and pull the same amount back in negative margin: the shadows fall freely, the band does not grow.
- **Don't** size a card that holds words with a fixed constant, or pin its `lineHeight`. `ALTERNATE_WIDTH = 196` around a three-line title, and `lineHeight: 28` under a 22px title, both hold their shape while the OS text size grows and the words stop fitting. Scale them by `PixelRatio.getFontScale()`, capped, so a large-type setting grows the box instead of clipping the sentence.
- **Don't** raise a control's *height* to reach the 44pt touch target when the design wants it smaller — pad the press area with `hitSlop` instead. The chips were 44pt tall for exactly this reason and read as a stack of buttons.
- **Don't** hardcode an SVG gradient `id` as a literal string on a component that can mount more than once in the same DOM (e.g., inside a Stack navigator that keeps prior screens mounted) — use `useId()`. This shipped as a real bug (the sign-up screen's background blob silently failed to render) before being caught.
