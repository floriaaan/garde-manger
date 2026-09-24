/**
 * Authored SVG icons, one consistent stroke and weight (round cap/join,
 * strokeWidth 2, 24×24 viewBox) — the Lucide icon set's path data
 * (ISC-licensed), vendored directly against `react-native-svg` because
 * `@tamagui/lucide-icons-2` (2.7.7, the tamagui-2 rename of
 * `@tamagui/lucide-icons`) ships its icons without declaring
 * `react-native-svg` as a dependency of its own package.json, which pnpm's
 * strict node_modules linking makes unresolvable for Metro in this
 * monorepo. Drawing the icons this screen needs directly is a five-line
 * fix; depending on a package that cannot resolve its own runtime import is
 * not.
 */
import { Circle, Path, Polyline, Rect, Svg } from 'react-native-svg'

interface IconProps {
  size: number
  color: string
}

type IconSegment = {
  d?: string
  cx?: string
  cy?: string
  r?: string
  points?: string
  /** Lucide draws several glyphs from `<rect>`; expressing those as path data loses the rounded corners. */
  rect?: { x: string; y: string; width: string; height: string; rx?: string }
}

function icon(paths: IconSegment[]) {
  return function DashboardIcon({ size, color }: IconProps) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        {paths.map((p, i) =>
          p.d ? (
            <Path key={i} d={p.d} stroke={color} />
          ) : p.points ? (
            <Polyline key={i} points={p.points} stroke={color} />
          ) : p.rect ? (
            <Rect key={i} {...p.rect} stroke={color} fill="none" />
          ) : (
            <Circle key={i} cx={p.cx} cy={p.cy} r={p.r} stroke={color} />
          ),
        )}
      </Svg>
    )
  }
}

export const XIcon = icon([{ d: 'M18 6 6 18' }, { d: 'm6 6 12 12' }])
export const CircleCheckIcon = icon([{ cx: '12', cy: '12', r: '10' }, { d: 'm9 12 2 2 4-4' }])
export const CheckIcon = icon([{ d: 'M20 6 9 17l-5-5' }])
export const BadgeCheckIcon = icon([
  { d: 'M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z' },
  { d: 'm9 12 2 2 4-4' },
])
export const CircleXIcon = icon([{ cx: '12', cy: '12', r: '10' }, { d: 'm15 9-6 6' }, { d: 'm9 9 6 6' }])
export const TriangleAlertIcon = icon([
  { d: 'm21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3' },
  { d: 'M12 9v4' },
  { d: 'M12 17h.01' },
])
export const ShoppingCartIcon = icon([
  { cx: '8', cy: '21', r: '1' },
  { cx: '19', cy: '21', r: '1' },
  { d: 'M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12' },
])
export const ChefHatIcon = icon([
  {
    d: 'M17 21a1 1 0 0 0 1-1v-5.35c0-.457.316-.844.727-1.041a4 4 0 0 0-2.134-7.589 5 5 0 0 0-9.186 0 4 4 0 0 0-2.134 7.588c.411.198.727.585.727 1.041V20a1 1 0 0 0 1 1Z',
  },
  { d: 'M6 17h12' },
])
export const FlameIcon = icon([
  {
    d: 'M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z',
  },
])
export const ScanLineIcon = icon([
  { d: 'M3 7V5a2 2 0 0 1 2-2h2' },
  { d: 'M17 3h2a2 2 0 0 1 2 2v2' },
  { d: 'M21 17v2a2 2 0 0 1-2 2h-2' },
  { d: 'M7 21H5a2 2 0 0 1-2-2v-2' },
  { d: 'M7 12h10' },
])
export const WalletIcon = icon([
  {
    d: 'M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1',
  },
  { d: 'M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4' },
])
export const PackageIcon = icon([
  {
    d: 'M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z',
  },
  { d: 'M12 22V12' },
  { points: '3.29 7 12 12 20.71 7' },
  { d: 'm7.5 4.27 9 5.15' },
])
export const TrendingUpIcon = icon([
  { points: '22 7 13.5 15.5 8.5 10.5 2 17' },
  { points: '16 7 22 7 22 13' },
])
export const LeafIcon = icon([
  { d: 'M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z' },
  { d: 'M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12' },
])

// Sidebar/AppShell "Accueil" nav item — the dashboard's own destination,
// distinct from the "Frigo" tab (FridgeListScreen), which previously
// borrowed this slot's active state incorrectly (see app-shell.tsx).
export const HomeIcon = icon([
  { d: 'M3 9.5 12 3l9 6.5' },
  { d: 'M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5' },
])

// Settings screen: account card.
export const UserIcon = icon([{ cx: '12', cy: '7', r: '4' }, { d: 'M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2' }])

// Settings screen: "Historique des tickets" row.
export const ReceiptIcon = icon([
  { d: 'M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z' },
  { d: 'M8 7h8' },
  { d: 'M8 11h8' },
  { d: 'M8 15h5' },
])

export const CameraIcon = icon([
  { d: 'M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z' },
  { cx: '12', cy: '13', r: '3' },
])

// Camera overlays: pick from the photo library.
export const ImageIcon = icon([
  { rect: { x: '3', y: '3', width: '18', height: '18', rx: '2' } },
  { cx: '9', cy: '9', r: '2' },
  { d: 'm21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21' },
])

// Camera overlays: import a PDF receipt instead of a photo.
export const FileTextIcon = icon([
  { d: 'M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z' },
  { d: 'M14 2v4a2 2 0 0 0 2 2h4' },
  { d: 'M10 9H8' },
  { d: 'M16 13H8' },
  { d: 'M16 17H8' },
])

// Settings screen: sign-out button.
export const LogOutIcon = icon([
  { d: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4' },
  { points: '16 17 21 12 16 7' },
  { d: 'M21 12H9' },
])

// Settings screen: "Historique des tickets" row chevron.
export const ChevronRightIcon = icon([{ d: 'm9 18 6-6-6-6' }])
// The Recettes composer's disclosure — rotates 180° when the panel opens.
export const ChevronDownIcon = icon([{ d: 'm6 9 6 6 6-6' }])

// Dashboard header: the Réglages entry (Lucide `settings-2` — the gear's
// tooth path reads as mush at 19px, the sliders shape survives).
export const SettingsIcon = icon([
  { d: 'M20 7h-9' },
  { d: 'M14 17H5' },
  { cx: '17', cy: '17', r: '3' },
  { cx: '7', cy: '7', r: '3' },
])

// Household screen: the members list.
export const UsersIcon = icon([
  { d: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2' },
  { cx: '9', cy: '7', r: '4' },
  { d: 'M22 21v-2a4 4 0 0 0-3-3.87' },
  { d: 'M16 3.13a4 4 0 0 1 0 7.75' },
])

// Household screen: regenerating the invite code.
export const RefreshIcon = icon([
  { d: 'M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8' },
  { d: 'M21 3v5h-5' },
  { d: 'M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16' },
  { d: 'M8 16H3v5' },
])

// BackButton. Was the literal character `←` set in a Text — a unicode glyph
// standing in for an icon, so it carried the font's own weight and baseline
// instead of this file's 2px round stroke, and shifted shape per platform.
export const ServerIcon = icon([
  { rect: { x: '2', y: '2', width: '20', height: '8', rx: '2' } },
  { rect: { x: '2', y: '14', width: '20', height: '8', rx: '2' } },
  { d: 'M6 6h.01' },
  { d: 'M6 18h.01' },
])

// Réglages: notifications.
export const BellIcon = icon([
  { d: 'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9' },
  { d: 'M10.3 21a1.94 1.94 0 0 0 3.4 0' },
])

export const ArrowLeftIcon = icon([{ d: 'M19 12H5' }, { d: 'm12 19-7-7 7-7' }])

// Home Assistant's sync-direction rows ("Vers Home Assistant").
export const ArrowRightIcon = icon([{ d: 'M5 12h14' }, { d: 'm12 5 7 7-7 7' }])

// Search fields (the fridge list's own filter field).
export const SearchIcon = icon([{ cx: '11', cy: '11', r: '8' }, { d: 'm21 21-4.3-4.3' }])

// "+ Ajouter" buttons — same reason as ArrowLeftIcon: the `+` was typed, not drawn.
export const PlusIcon = icon([{ d: 'M5 12h14' }, { d: 'M12 5v14' }])

// Form labels: the expiry date field and its shortcut chips.
export const CalendarIcon = icon([
  { d: 'M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z' },
  { d: 'M3 10h18' },
  { d: 'M8 2v4' },
  { d: 'M16 2v4' },
])

// Form label: the free-text product name.
export const PencilIcon = icon([
  {
    d: 'M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z',
  },
  { d: 'm15 5 4 4' },
])

// Form label: category, and the OpenFoodFacts category suggestions.
export const TagIcon = icon([
  {
    d: 'M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z',
  },
  { cx: '7.5', cy: '7.5', r: '.5' },
])

// Form label: quantity + unit.
export const ScaleIcon = icon([
  { d: 'm16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z' },
  { d: 'm2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z' },
  { d: 'M7 21h10' },
  { d: 'M12 3v18' },
  { d: 'M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2' },
])

// The three storage locations — used on the location chips, the fridge
// screen's compartment filters, and each shelf's own header. One icon per
// location everywhere, so "Congélateur" is recognisable before it is read.
export const RefrigeratorIcon = icon([
  { d: 'M5 6a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z' },
  { d: 'M5 10h14' },
  { d: 'M15 7v6' },
])
export const SnowflakeIcon = icon([
  { d: 'M12 2v20' },
  { d: 'm4.93 4.93 14.14 14.14' },
  { d: 'M19.07 4.93 4.93 19.07' },
  { d: 'm9 5 3-3 3 3' },
  { d: 'm15 19-3 3-3-3' },
  { d: 'M2 12h20' },
])
export const ArchiveIcon = icon([
  { d: 'M20 3H4a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1z' },
  { d: 'M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8' },
  { d: 'M10 12h4' },
])

// "Tout" — the compartment filter that clears the other three.
export const LayersIcon = icon([
  {
    d: 'M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z',
  },
  { d: 'm22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65' },
  { d: 'm22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65' },
])

// The recipe composer's six group labels. Six different questions in one
// scroll is exactly the case where an icon distinguishes — the same argument
// that put a glyph on FormField's label and on ScreenHeader. The chips inside
// each group carry none: four identical clocks down a row is decoration.
export const UtensilsIcon = icon([
  { d: 'M16 2v20' },
  { d: 'M19 2a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3' },
  { d: 'M3 2v7a4 4 0 0 0 8 0V2' },
  { d: 'M7 2v20' },
])
export const ClockIcon = icon([{ cx: '12', cy: '12', r: '10' }, { d: 'M12 6v6l4 2' }])
export const GlobeIcon = icon([
  { cx: '12', cy: '12', r: '10' },
  { d: 'M2 12h20' },
  { d: 'M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z' },
])

// "À éviter" — deliberately not CircleXIcon, which is the committed "date
// dépassée" status glyph and would read as an error on a field that is only
// ever an optional preference.
export const BanIcon = icon([{ cx: '12', cy: '12', r: '10' }, { d: 'm4.9 4.9 14.2 14.2' }])

// Recipe generation — the one place in the app where "the AI made this" is
// the honest label for what the button does.
export const SparklesIcon = icon([
  {
    d: 'M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z',
  },
  { d: 'M20 3v4' },
  { d: 'M22 5h-4' },
])

// Receipt review: the shop the ticket came from.
export const StoreIcon = icon([
  { d: 'm2 7 1.5-4A1 1 0 0 1 4.45 2h15.1a1 1 0 0 1 .95.69L22 7' },
  { d: 'M2 7h20v2a3 3 0 0 1-6 0 3 3 0 0 1-4 0 3 3 0 0 1-4 0 3 3 0 0 1-6 0z' },
  { d: 'M4 12v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8' },
])

// Dashboard: the "Accès rapide" section, whose content is literally a grid of
// two nav tiles.
export const EllipsisIcon = icon([
  { cx: '12', cy: '12', r: '1' },
  { cx: '19', cy: '12', r: '1' },
  { cx: '5', cy: '12', r: '1' },
])

export const LayoutGridIcon = icon([
  { d: 'M4 3h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z' },
  { d: 'M15 3h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z' },
  { d: 'M4 14h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-5a1 1 0 0 1 1-1z' },
  { d: 'M15 14h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1v-5a1 1 0 0 1 1-1z' },
])

export const QrCodeIcon = icon([
  { rect: { x: '3', y: '3', width: '5', height: '5', rx: '1' } },
  { rect: { x: '16', y: '3', width: '5', height: '5', rx: '1' } },
  { rect: { x: '3', y: '16', width: '5', height: '5', rx: '1' } },
  { d: 'M21 16h-3a2 2 0 0 0-2 2v3' },
  { d: 'M21 21v.01' },
  { d: 'M12 7v3a2 2 0 0 1-2 2H7' },
  { d: 'M3 12h.01' },
  { d: 'M12 3h.01' },
  { d: 'M12 16v.01' },
  { d: 'M16 12h1' },
  { d: 'M21 12v.01' },
  { d: 'M12 21v-1' },
])

export const ClipboardIcon = icon([
  { rect: { x: '8', y: '2', width: '8', height: '4', rx: '1' } },
  { d: 'M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2' },
])

export const CopyIcon = icon([
  { rect: { x: '8', y: '8', width: '14', height: '14', rx: '2' } },
  { d: 'M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2' },
])

export const ShareIcon = icon([
  { cx: '18', cy: '5', r: '3' },
  { cx: '6', cy: '12', r: '3' },
  { cx: '18', cy: '19', r: '3' },
  { d: 'M8.59 13.51 15.42 17.49' },
  { d: 'M15.41 6.51 8.59 10.49' },
])

// Mon compte: delete-account action.
export const TrashIcon = icon([
  { d: 'M3 6h18' },
  { d: 'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6' },
  { d: 'M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2' },
])

// Mon compte: change-password action.
export const LockIcon = icon([
  { rect: { x: '3', y: '11', width: '18', height: '11', rx: '2' } },
  { d: 'M7 11V7a5 5 0 0 1 10 0v4' },
])

// Mon compte: linked connection methods section.
export const LinkIcon = icon([
  { d: 'M9 17H7A5 5 0 0 1 7 7h2' },
  { d: 'M15 7h2a5 5 0 1 1 0 10h-2' },
  { d: 'M8 12h8' },
])

// Foyer: "Transférer la propriété" action.
export const ArrowLeftRightIcon = icon([
  { d: 'M8 3 4 7l4 4' },
  { d: 'M4 7h16' },
  { d: 'M16 21l4-4-4-4' },
  { d: 'M20 17H4' },
])
