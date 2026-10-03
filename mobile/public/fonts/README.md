# Web fonts

These files are served from the app's own `/fonts/` path. No request to Google
Fonts is needed at runtime. Only normal Latin and Latin Extended faces are
included, covering the app's French and English text.

- Plus Jakarta Sans: variable weights 200–800, copied from the repository's
  existing `@fontsource-variable/plus-jakarta-sans` package (5.3.0).
  Source: https://github.com/google/fonts/tree/main/ofl/plusjakartasans
- Spectral: weight 600, official Google Fonts WOFF2 files (v15), retrieved via
  https://fonts.googleapis.com/css2?family=Spectral:wght@600&display=swap
  Source: https://github.com/google/fonts/tree/main/ofl/spectral

Both families use the SIL Open Font License; their licenses are included here.

## Browser acceptance check

After deploying the web export, check Chrome, Firefox and Safari:

1. Disable the cache in developer tools and do a full reload on `/welcome`.
   In **Rendered Fonts**, confirm Spectral for the hero title and Plus Jakarta
   Sans for its supporting text and wordmark. On a signed-in screen, confirm
   the same pairing for `ScreenHeader` and ordinary Tamagui text.
2. Filter the Network panel to fonts. Requested WOFF2 files must return 200
   from the application's origin. Verify accents and ligatures with
   `Échéance, œufs, foyer, français`. Opening a missing `/fonts/missing.woff2`
   on the production server must return 404, not the SPA HTML document.
3. Throttle the network, reload, then block `/fonts/*` and reload again.
   Titles and controls must remain visible and usable with the fallback
   fonts. Check a narrow viewport and 200% zoom for truncation.

The CSS uses `font-display: swap` and explicit system/Georgia fallbacks.
These browser checks require a running export; source inspection alone does
not establish network success or the font actually rendered by a browser.
