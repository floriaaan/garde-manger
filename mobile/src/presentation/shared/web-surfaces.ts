import { Platform } from 'react-native'

/**
 * The browser surfaces nobody drew.
 *
 * DESIGN.md's "Browser defaults are part of the design": the parts of a web
 * build that ship with the user agent's own look belong to no design system,
 * and theming them is the cheapest signal that a page was built rather than
 * assembled. `pointerCursor` covers the cursor and the button text alignment;
 * these are the ones that can only be expressed as CSS state selectors, which a
 * React Native style object cannot carry.
 *
 * **Keyboard focus is the load-bearing one.** `react-native-web` renders every
 * `Pressable` with `outline: none`, so before this the only keyboard-visible
 * focus anywhere in the app was `FormField`'s lime border — every card, chip,
 * pill and the bottom nav were invisible to a tabbing user. `:focus-visible`
 * rather than `:focus` so a mouse press never draws a ring.
 *
 * Injected once, at the root, from the committed palette rather than a
 * hardcoded blue.
 */
export function installWebSurfaces(accent: string, ink: string, focusColor: string): void {
  if (Platform.OS !== 'web') return
  const doc = typeof document === 'undefined' ? null : document
  if (!doc) return

  const ID = 'garde-manger-web-surfaces'
  const existing = doc.getElementById(ID)
  const style = existing instanceof HTMLStyleElement ? existing : doc.createElement('style')
  style.id = ID
  style.textContent = `
    :root { accent-color: ${accent}; }
    *:focus { outline: none; }
    /* No radius of its own: a modern outline follows the element's own
       border-radius, so the ring hugs a 999px pill and a 24px card alike
       instead of imposing a shape this system never chose. */
    *:focus-visible {
      outline: 3px solid ${focusColor};
      outline-offset: 2px;
    }
    ::selection { background: ${accent}; color: ${ink}; }
    input::placeholder, textarea::placeholder { opacity: 1; }
  `
  if (!existing) doc.head.appendChild(style)
}
