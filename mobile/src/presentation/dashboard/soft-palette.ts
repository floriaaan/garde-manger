/**
 * "Dashboard soft gamifié" — brief pinned by the user 2026-08-27, replacing
 * the previously built "ticket de caisse" direction outright (redesign, not
 * refinement); pushed toward Material Expressive on 2026-08-27 (more color,
 * motion, expressive asymmetric shapes) per follow-up feedback. Every value
 * below is contrast-checked against WCAG 2.1 (≥4.5:1 body text, ≥3:1
 * large/bold) against the surface it sits on — see the commit that
 * introduced this file for the arithmetic. Secondary text on a colored
 * card is always tinted from that card's own hue, never flat neutral gray;
 * plain neutral gray is reserved for labels sitting directly on the
 * near-white background, which the craft floor's "never gray on colored
 * surfaces" rule does not cover.
 *
 * DARK MODE (2026-08-28): a real second design pass, not a palette-swap
 * invert. An early attempt at this literally inverted `brandDeep` to a
 * light lamp-lit amber so the hero would stay "the bright surface" —
 * reasonable-sounding, and wrong: it broke the hero's white text and the
 * hero-pill badges' light status text (soonOnDark/expiredOnDark), both
 * tuned for a dark hero, both dropping under 4.5:1 against a light one.
 * Caught and reverted. The actual fix needed less: `brandDeep` stays
 * byte-for-byte identical to light mode. It's already dark and warm
 * enough (L≈0.10) to read as the lit surface once the *ground* drops to
 * near-black (L≈0.004) around it — the metaphor (a warm pantry at night,
 * one lamp lit) comes from redesigning the ground, ink, layoutSurface,
 * and blob glow, not from flipping every token. Shadows do genuinely
 * invert though: a dark drop-shadow is invisible on an already-dark
 * ground, so dark.shadowCool/shadowWarm are warm light glows.
 */
import { useColorScheme } from 'react-native'
import type { ColorSchemeName } from 'react-native'

export interface SoftPalette {
  gradientTop: string
  gradientBottom: string
  ink: string
  inkSecondary: string
  brandDeep: string
  brandDeepText: string
  brandDeepTextSecondary: string
  // Pure white used as an icon/text color on saturated fills (StatCard
  // icon chips, NavCard titles) — tokenized so a future dark-mode pass
  // has one place to change instead of hunting down raw "#FFFFFF"
  // literals (an audit finding: 8+ existed before this token did).
  onDark: string
  /** Secondary text on a saturated fill (a NavCard subtitle) — white at 85%, which still clears 4.5:1 on navcard-teal/violet. */
  onDarkSecondary: string
  // The hero card's two status-pill colors (soon/expired), tuned
  // specifically for its dark warm background — distinct from
  // soonText/expiredText below, which are tuned for the light pastel
  // freshBg/soonBg/expiredBg fills instead. Folding these two in is an
  // audit fix: they existed as bare hex literals with no token at all.
  soonOnDark: string
  expiredOnDark: string
  /**
   * The status pills that sit *on* the hero card (and on the recipe detail's
   * hero) — a translucent black wash rather than a solid fill, so the ember
   * glow still reads through them. It existed four times as a bare
   * `rgba(0,0,0,0.28)` literal, which is exactly the drift `onDark` was
   * tokenized to stop; `soonOnDark`/`expiredOnDark` above are contrast-tuned
   * against this value, so the three have to move together.
   */
  heroPillFill: string
  layoutSurface: string
  // The shopping list's paper-list surface + its dashed tear-line between
  // rows — a deliberate, screen-scoped exception to the system's "no
  // borders" rule (see DESIGN.md Shapes), not a drift from it.
  // expo-blur's `tint` for the mobile bottom nav's frosted glass pill — an
  // audit caught this hardcoded to `'light'` regardless of scheme, so the
  // pill stayed a light frosted glass even against a dark-mode ground.
  blurTint: 'light' | 'dark'
  paperCard: string
  paperRule: string
  paperBindingStrip: string
  paperHole: string
  paperRing: string
  penMark: string
  // The fridge screen's appliance surfaces — a second disclosed, screen-scoped
  // material exception, the same kind as the shopping list's legal pad above.
  // Deliberately COOL where the rest of the system is warm: an enamel cabinet
  // reads as an appliance precisely because it is the one cold surface in a
  // warm pantry, and the two never sit on the same screen.
  cabinetEnamel: string
  cabinetLiner: string
  cabinetSeal: string
  /** The interior light wash across the top of the liner. Carries its own alpha: the dark theme's lamp is dimmer than the light theme's, and one shared opacity could not say that. */
  cabinetColdLight: string
  /** A shelf's glass plate, and the front lip that catches the light under it. */
  shelfGlass: string
  shelfEdge: string
  /** A product sitting on a shelf. */
  cabinetRowSurface: string
  /** Text on the liner — secondary is tinted cool from the liner's own hue, never flat gray. */
  cabinetInk: string
  cabinetInkSecondary: string
  // Two shadow colors, not one — a warm shadow reads right on the warm
  // layoutSurface/hero surfaces, a cooler one on the mint/white ground.
  // Named per the "Warm-Shadow-on-Warm-Ground" rule in DESIGN.md.
  shadowCool: string
  shadowWarm: string
  accentLime: string
  accentLimeText: string
  accentWarm: string
  accentWarmText: string
  blobStrong: string
  blobSoft: string
  chipOrange: string
  chipViolet: string
  chipTeal: string
  navCardTeal: string
  navCardViolet: string
  navCardWarm: string
  navCardRose: string
  chipRose: string
  cream: string
  /**
   * A pill sitting *on* a `cream` card. Not `gradientBottom`: that token is the
   * page/content ground, so in dark mode a `gradientBottom` pill on a `cream`
   * card reads as a hole punched through the row rather than a chip on it.
   */
  creamPill: string
  /**
   * The hairline that makes a `creamPill` visible on a `cream` card.
   *
   * `creamPill` has to stay near-white to keep its label above 4.5:1 — every
   * darker fill trades the text contrast away — which leaves the fill itself at
   * 1.08:1 against the card, i.e. not a pill at all but loose floating text.
   * The shape does the work the fill cannot: ~1.7:1 light, ~2.0:1 dark. A
   * control-sized mark, not an outlined surface — DESIGN.md's border ban is
   * about containers.
   */
  creamPillEdge: string
  creamText: string
  lavender: string
  lavenderText: string
  mintPale: string
  mintPaleText: string
  rosePale: string
  rosePaleText: string
  /** The pale sun-yellow card (Abonnement) — butter, a pastel beside cream/lavender/mint; `chipButter` is its icon chip. */
  butter: string
  butterText: string
  chipButter: string
  fresh: string
  freshBg: string
  freshText: string
  soon: string
  soonBg: string
  soonText: string
  expired: string
  expiredBg: string
  expiredText: string
  cardShadow: string
  /** The dimming layer behind a modal sheet — darker in dark mode, where the sheet itself is dim. */
  scrim: string
  /**
   * The wash behind anything drawn over a live camera feed (close, galerie,
   * hint). Same value in both themes: the feed behind it does not follow the
   * theme, and a bright fridge interior needs ≈5:1 under white text.
   */
  cameraScrim: string
}

const light: SoftPalette = {
  gradientTop: '#E9F6D8',
  gradientBottom: '#FFFFFF',
  ink: '#16211A',
  inkSecondary: '#6B7280',
  // Kept dark on purpose — this is the hero card's "sole high-contrast
  // block" (and the auth screens', and status text). Only the *layout
  // surround* (below) got the "too dark, want near-white" softening; the
  // hero staying rich is what makes it a hero.
  brandDeep: '#6B5642',
  brandDeepText: '#FFFFFF',
  brandDeepTextSecondary: 'rgba(255,255,255,0.82)',
  onDark: '#FFFFFF',
  onDarkSecondary: 'rgba(255,255,255,0.85)',
  // ~5.4:1 and ~4.6:1 against a rgba(0,0,0,0.28) overlay on brandDeep —
  // see the commit that tuned these when brandDeep was softened; both
  // dropped below 4.5:1 against the lighter mocha at the overlay's
  // original rgba(255,255,255,0.14).
  soonOnDark: '#F0C46E',
  expiredOnDark: '#F0968A',
  heroPillFill: 'rgba(0,0,0,0.28)',
  // The tablet/desktop layout surround (sidebar included) — near-white
  // with a warm brown tint, deliberately much lighter than brandDeep. The
  // content panel (gradientBottom, #FFFFFF) must read as lighter still —
  // that's the whole "mat around a print" effect — so keep this one a
  // clear step below pure white, never at or above it.
  layoutSurface: '#EEE6DC',
  blurTint: 'light',
  // Legal-pad yellow, not off-white — the follow-up feedback asked for
  // the notepad cue committed to, not hinted at. Still soft/muted (not
  // neon/highlighter yellow) so it reads as paper, not a warning sticker.
  paperCard: '#F7EFC0',
  paperRule: 'rgba(107,86,66,0.18)',
  paperBindingStrip: '#EEDFA0',
  paperHole: '#C9B76B',
  paperRing: '#D8D8D8',
  penMark: '#2F7D4F',
  // Enamel body a clear step darker than the liner it frames, so the cabinet
  // reads as a box with a lit inside rather than one flat cool rectangle.
  cabinetEnamel: '#E3EBEE',
  cabinetLiner: '#F2F7F9',
  cabinetSeal: '#D3DFE4',
  cabinetColdLight: 'rgba(191,227,242,0.55)',
  shelfGlass: 'rgba(150,196,214,0.42)',
  shelfEdge: '#B4CED8',
  cabinetRowSurface: '#FFFFFF',
  cabinetInk: '#16211A',
  // ≈5.3:1 on the liner, ≈5.5:1 on a white row.
  cabinetInkSecondary: '#5A6B72',
  shadowCool: '#0F2B1D',
  shadowWarm: '#3A2E20',
  accentLime: '#C4E538',
  accentLimeText: '#0F2B1D',
  accentWarm: '#FF8A3D',
  accentWarmText: '#3D1B00',
  blobStrong: '#BFEE7A',
  blobSoft: '#EAF8D8',
  chipOrange: '#FF8A3D',
  chipViolet: '#8B7FD1',
  chipTeal: '#2FA88A',
  // Darker than chip* on purpose: these carry white *text* (NavCard titles),
  // which needs ≥4.5:1, not the ~3:1 graphics floor a bare icon on chip*
  // gets away with. chipTeal/chipViolet fail 4.5:1 with white text (~2.9:1).
  navCardTeal: '#1F7A62',
  navCardViolet: '#6355A8',
  navCardWarm: '#A84E1A',
  navCardRose: '#A8375A',
  chipRose: '#D9628A',
  cream: '#FDF6E8',
  creamPill: '#FFFFFF',
  creamPillEdge: '#C9BEA8',
  creamText: '#7A6B47',
  lavender: '#EFEAFB',
  lavenderText: '#635B85',
  mintPale: '#E1F3E6',
  mintPaleText: '#35704E',
  rosePale: '#FBE4EC',
  rosePaleText: '#9C3D63',
  butter: '#FFF1BF',
  butterText: '#7A5A00',
  chipButter: '#A86F0E',
  fresh: '#3FAE6B',
  freshBg: '#DFF3E4',
  freshText: '#1F6B44',
  soon: '#C98A1E',
  soonBg: '#FBEBC7',
  soonText: '#8A5A12',
  expired: '#C6493B',
  expiredBg: '#FBDCD4',
  expiredText: '#B23A2E',
  cardShadow: 'rgba(15,43,29,0.14)',
  scrim: 'rgba(15,43,29,0.40)',
  cameraScrim: 'rgba(0,0,0,0.58)',
}

const dark: SoftPalette = {
  // Warm near-black ground, a dim ember-glow blob (not daylight mint) —
  // see BlobBackground/AuthBlobBackground, unchanged code, new colors.
  gradientTop: '#241C12',
  gradientBottom: '#120D08',
  ink: '#F2ECE3',
  inkSecondary: '#B0A597',
  // Deliberately identical to light mode, not inverted: brandDeep
  // (L≈0.10) already sits well above this palette's near-black ground
  // (L≈0.004, ~2.8:1 apart) — warmer-hued and visibly lighter than its
  // surroundings either way, which is what "the one lit surface" thesis
  // actually needs. Inverting it to a light amber (an earlier version of
  // this pass tried that) breaks the hero's white-text pairing and the
  // hero-pill badges' light-colored text (soonOnDark/expiredOnDark),
  // which were tuned for a dark hero and would drop under 4.5:1 against
  // a light one — a real, caught regression, not a hypothetical.
  brandDeep: '#6B5642',
  brandDeepText: '#FFFFFF',
  brandDeepTextSecondary: 'rgba(255,255,255,0.82)',
  onDark: '#FFFFFF',
  onDarkSecondary: 'rgba(255,255,255,0.85)',
  soonOnDark: '#F0C46E',
  expiredOnDark: '#F0968A',
  heroPillFill: 'rgba(0,0,0,0.28)',
  // Content (gradientBottom) stays lighter than the surround
  // (layoutSurface) — the same relative rule as light mode, just shifted
  // into the dark range instead of inverted.
  layoutSurface: '#100C07',
  blurTint: 'dark',
  paperCard: '#2B2410',
  paperBindingStrip: '#3A2F16',
  paperHole: '#4A3B1E',
  paperRing: '#5A5A5A',
  paperRule: 'rgba(242,236,227,0.16)',
  penMark: '#5FCB8B',
  // Same relationship, inverted the way the rest of the dark pass is: the
  // liner is LIGHTER than the body, because the light is inside the fridge.
  cabinetEnamel: '#12171A',
  cabinetLiner: '#1B2226',
  cabinetSeal: '#0C1012',
  cabinetColdLight: 'rgba(95,168,199,0.20)',
  shelfGlass: 'rgba(120,170,190,0.20)',
  shelfEdge: '#324650',
  cabinetRowSurface: '#242D32',
  cabinetInk: '#F2ECE3',
  // ≈6.2:1 on a row, ≈7.2:1 on the liner.
  cabinetInkSecondary: '#9FB0B7',
  // Shadows as warm light glows, not darkened hex — a shadowColor this
  // dark would be invisible against an already-near-black ground.
  shadowCool: '#F4EBD9',
  shadowWarm: '#FFDDB3',
  accentLime: '#C4E538',
  accentLimeText: '#0F2B1D',
  accentWarm: '#FF9A56',
  accentWarmText: '#2A1200',
  // A dim ember glow, not the light-mode's bright mint "sunlight" —
  // matches BlobBackground's own opacities (0.9/0.55) at these darker
  // values instead of reading as a jarring bright patch on black.
  blobStrong: '#4A3820',
  blobSoft: '#2E2415',
  chipOrange: '#FF9A56',
  chipViolet: '#A79BE0',
  chipTeal: '#3FBFA0',
  navCardTeal: '#1F7A62',
  navCardViolet: '#6355A8',
  navCardWarm: '#9E4514',
  navCardRose: '#9E3A5C',
  chipRose: '#E88AAC',
  cream: '#241F17',
  // Lighter than the card, the way white is lighter than cream in daylight —
  // ≈7.5:1 with creamText, ≈5.2:1 with inkSecondary.
  creamPill: '#3A3324',
  creamPillEdge: '#6A5F47',
  creamText: '#D9C79A',
  lavender: '#1E1B2A',
  lavenderText: '#C0B7E6',
  mintPale: '#152A1D',
  mintPaleText: '#8FD3A9',
  rosePale: '#2E1620',
  rosePaleText: '#E2A0BA',
  butter: '#2A2210',
  butterText: '#E9CF8A',
  chipButter: '#A8741A',
  fresh: '#4FC080',
  freshBg: '#153B25',
  freshText: '#7EDCA5',
  soon: '#E0A93C',
  soonBg: '#3B2C10',
  soonText: '#F0C46E',
  expired: '#E2695A',
  expiredBg: '#3B1712',
  expiredText: '#F0968A',
  cardShadow: 'rgba(0,0,0,0.45)',
  scrim: 'rgba(0,0,0,0.62)',
  cameraScrim: 'rgba(0,0,0,0.58)',
}

/** The light palette, for tests that render a palette-taking component outside a screen. */
export const lightPaletteForTests: SoftPalette = light

/** The palette for a scheme, for the few callers that resolve one outside a component tree. */
export function paletteFor(scheme: ColorSchemeName): SoftPalette {
  return scheme === 'dark' ? dark : light
}

export function useSoftPalette(): SoftPalette {
  const scheme = useColorScheme()
  return paletteFor(scheme)
}
