let pendingSignIns = 0
let generation = 0

/** Responses from before/during sign-in cannot revoke the incoming session. */
export function sessionInvalidationGuard(): () => boolean {
  const startedAt = generation
  const pendingAtStart = pendingSignIns > 0
  return () => !pendingAtStart && pendingSignIns === 0 && startedAt === generation
}

export function beginSignIn(): () => void {
  pendingSignIns += 1
  generation += 1
  return () => { pendingSignIns -= 1 }
}
