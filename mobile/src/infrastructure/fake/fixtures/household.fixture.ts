import type { Household } from '../../../domain/identity/household.js'

/**
 * `inviteCode` is eight characters of `[A-Z0-9]`, because that is the only
 * shape the backend accepts (`invite-code.vo.ts`). It used to read
 * `FRIDGE-4KQ2` — eleven characters with a hyphen — so the fake taught every
 * screen built against it a format the real server rejects, and the eight-cell
 * join field is developed entirely against this fixture.
 */
export const fakeHousehold: Household = {
  id: 'fake-household-1',
  name: 'Appartement des loulous',
  inviteCode: 'K4Q2M7XP',
  role: 'owner',
  members: [
    { userId: 'fake-user-1', name: 'Thomas C.', image: `https://api.dicebear.com/10.x/initial-face/svg?seed=${encodeURIComponent('Thomas C.')}&animationVariant=medium`, role: 'owner', joinedAt: '2026-08-01T09:00:00.000Z' },
    { userId: 'fake-user-2', name: 'Camille', image: `https://api.dicebear.com/10.x/initial-face/svg?seed=${encodeURIComponent('Camille')}&animationVariant=medium`, role: 'member', joinedAt: '2026-08-04T18:30:00.000Z' },
  ],
}

/**
 * The same foyer, from a member's side of the wire rather than the owner's:
 * `role: 'member'`, and no `inviteCode` — the backend omits that field for
 * anyone but the owner (`toHouseholdDto`), which is what `HouseholdScreen`'s
 * invite section gates on. Exists because `FakeFridgeConnector` otherwise had
 * no way at all to hand a test a member session: `signInSocial`/`signInEmail`
 * always restore `fakeHousehold`, whose `role` is hardcoded to `'owner'`.
 * Pass this to the connector's `fixtureHousehold` constructor option to
 * render any owner-gated screen as a member instead.
 */
export const fakeHouseholdAsMember: Household = {
  id: fakeHousehold.id,
  name: fakeHousehold.name,
  role: 'member',
  members: fakeHousehold.members.map((member) => ({ ...member })),
}
