export type ToastVariant = 'error' | 'info' | 'success'

export interface ToastMessage {
  id: number
  message: string
  variant: ToastVariant
  /** One tap-through, e.g. "Relire" — the toast dismisses itself once it is pressed. */
  action?: { label: string; onPress: () => void }
}

/**
 * A user-facing notification port, same shape as `telemetry.ts` next door:
 * infrastructure (`http-client.ts`) calls `showToast` directly — plain
 * application code, no component tree to read a context from — and
 * `ToastHost` (presentation, allowed to depend on this layer) is the one
 * subscriber, mounted once at the app root. Calling `showToast` before
 * `ToastHost` mounts or after it unmounts drops the message rather than
 * queuing it — showing nothing beats crashing to show it.
 */
let currentId = 0
let listener: ((toast: ToastMessage) => void) | null = null

export function showToast(
  message: string,
  variant: ToastVariant = 'error',
  action?: ToastMessage['action'],
): void {
  listener?.({ id: ++currentId, message, variant, action })
}

export function subscribeToast(next: (toast: ToastMessage) => void): () => void {
  listener = next
  return () => {
    listener = null
  }
}
