/**
 * Same shape as `toast.ts`: application code (`use-ai-subscribe`) calls
 * `celebrate` from anywhere, `ConfettiHost` (presentation, mounted once at the
 * root) is the subscriber that plays the burst. No host mounted, nothing plays.
 */
const bursts = new Set<() => void>()

export function celebrate(): void {
  bursts.forEach((fire) => fire())
}

export function subscribeConfetti(fire: () => void): () => void {
  bursts.add(fire)
  return () => void bursts.delete(fire)
}
