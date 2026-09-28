// The share extension wakes the app with a dataUrl URL. Its payload is read
// by useShareIntent in _layout; Expo Router must not try to render it as a page.
export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  if (/^(?:gardemanger:\/\/)?dataurl=/i.test(path.replace(/^\//, ''))) return '/'
  return path
}
