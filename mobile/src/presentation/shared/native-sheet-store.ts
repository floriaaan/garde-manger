import type { ReactNode } from 'react'
import { router } from 'expo-router'

type Sheet = { owner: symbol; content: ReactNode; onClose: () => void; session: string }
let sheet: Sheet | null = null
let nextSession = 0
let lastClosedSession: string | null = null
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((listener) => listener())

/** Callbacks stay in memory, never in navigation params. Each presentation owns its dismissal. */
export const nativeSheetStore = {
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => { listeners.delete(listener) }
  },
  getSnapshot: () => sheet,
  wasClosed: (session: string) => lastClosedSession === session,
  show(next: Omit<Sheet, 'session'>) {
    const opening = sheet === null
    const session = sheet?.session ?? String(++nextSession)
    sheet = { ...next, session }
    emit()
    if (opening) router.push({ pathname: '/action-sheet', params: { session } })
  },
  close(owner?: symbol) {
    if (!sheet || (owner && sheet.owner !== owner)) return
    const closing = sheet
    lastClosedSession = closing.session
    sheet = null
    emit()
    router.back()
    closing.onClose()
  },
  dismissed(session: string) {
    // An older sheet can finish its native dismissal after the next one opened.
    if (sheet?.session !== session) return
    const closing = sheet
    lastClosedSession = closing.session
    sheet = null
    emit()
    closing.onClose()
  },
}
