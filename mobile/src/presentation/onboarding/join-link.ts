import { t } from '../../i18n/index.js'
/**
 * The link an owner shares, and the code a new member arrives holding.
 *
 * There is no universal link and there will not be one: the instance is
 * self-hosted (PRODUCT.md), so there is no domain this app could claim on the
 * App Store or in an `assetlinks.json`. The share therefore carries two
 * things — the `gardemanger://join?code=…` link for a phone that already has the
 * app, and the eight characters in plain text for every phone that does not.
 * A share message that only carried the link would be useless to exactly the
 * person it is meant for: someone who has not installed anything yet.
 */
import * as Linking from 'expo-linking'
import { INVITE_CODE_LENGTH, countCodeCharacters, normalizeInviteCode } from '../../domain/identity/invite-code.js'

/** `gardemanger://join?code=K4Q2M7XP` on a device; a localhost/origin URL on web. */
export function buildJoinLink(inviteCode: string): string {
  return Linking.createURL('join', { queryParams: { code: normalizeInviteCode(inviteCode) } })
}

export function buildShareMessage(householdName: string, inviteCode: string): string {
  const code = normalizeInviteCode(inviteCode)
  return [
    t('onboarding.join_on_garde_manger', { value1: householdName }),
    `Code : ${code}`,
    buildJoinLink(code),
  ].join('\n')
}

/**
 * Pulls a code out of whatever the scanner, the router or the clipboard handed
 * us — a full link, a bare code, or a code still wearing the sentence it was
 * sent in.
 *
 * Three readings, narrowest first, because a wider one applied to a whole
 * message produces a confident wrong answer rather than nothing:
 *
 * 1. the link's own `code` parameter, so `…/join?code=K4Q2M7XP` is not read as
 *    the letters of the host and the path;
 * 2. a standalone eight-character word, which is how a code sits inside
 *    `Rejoins « Maison Bellevue » … Code : K4Q2M7XP`;
 * 3. the whole string, but only when it holds exactly eight acceptable
 *    characters in total — that is what makes a hand-written `K4Q2-M7XP` work
 *    without letting a paragraph through.
 *
 * Null rather than a partial code: a field missing two characters is worse
 * than an empty one, because the user has to notice before they can fix it.
 */
export function parseInviteCode(raw: string | string[] | undefined): string | null {
  if (raw === undefined) return null
  const text = Array.isArray(raw) ? raw[0] : raw
  if (!text) return null

  const fromQuery = /[?&]code=([^&\s]+)/i.exec(text)
  if (fromQuery) {
    const queried = normalizeInviteCode(fromQuery[1])
    return queried.length === INVITE_CODE_LENGTH ? queried : null
  }

  const token = /(?:^|[^A-Za-z0-9])([A-Za-z0-9]{8})(?![A-Za-z0-9])/.exec(text)
  if (token) return normalizeInviteCode(token[1])

  if (countCodeCharacters(text) !== INVITE_CODE_LENGTH) return null
  const whole = normalizeInviteCode(text)
  return whole.length === INVITE_CODE_LENGTH ? whole : null
}
