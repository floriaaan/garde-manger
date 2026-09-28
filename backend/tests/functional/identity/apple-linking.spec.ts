import { test } from '@japa/runner'
import { apple } from 'better-auth/social-providers'
import { auth } from '#infrastructure/auth/better-auth/instance'

// Only Apple's external identity check is replaced. Session enforcement,
// account linking and persistence exercise the real configured Better Auth.
test.group('Apple account linking', (group) => {
  group.setup(async () => {
    const context = await auth.$context
    const original = context.socialProviders
    context.socialProviders = [
      apple({
        clientId: 'test-apple',
        verifyIdToken: async (token) => ['relay', 'matching'].includes(token),
        getUserInfo: async ({ idToken }) => ({
          user: {
            name: 'Apple user',
            email:
              idToken === 'relay'
                ? 'private@privaterelay.appleid.com'
                : 'implicit-apple@example.com',
            emailVerified: true,
          },
          data: {
            sub: `apple-${idToken}`,
            email_verified: true,
            is_private_email: idToken === 'relay',
            real_user_status: 2,
            name: 'Apple user',
            picture: '',
          },
        }),
      }),
    ]
    return () => {
      context.socialProviders = original
    }
  })

  test('an authenticated user can link a relay address, but another account cannot take it', async ({
    client,
    assert,
  }) => {
    const signup = await client.post('/api/auth/sign-up/email').json({
      email: 'explicit-apple@example.com',
      password: 'test-password-123',
      name: 'Alice',
    })
    signup.assertStatus(200)
    const cookie = signup.headers()['set-cookie']
    if (!cookie) throw new Error('set-cookie header missing')
    assert.isDefined(cookie)
    const linked = await client
      .post('/api/auth/link-social')
      .headers({ cookie })
      .json({
        provider: 'apple',
        idToken: { token: 'relay' },
      })
    linked.assertStatus(200)
    const login = await client.post('/api/auth/sign-in/social').json({
      provider: 'apple',
      idToken: { token: 'relay' },
    })
    login.assertStatus(200)
    assert.equal(login.body().user.id, signup.body().user.id)

    const other = await client.post('/api/auth/sign-up/email').json({
      email: 'other-apple@example.com',
      password: 'test-password-123',
      name: 'Bob',
    })
    other.assertStatus(200)
    const otherCookie = other.headers()['set-cookie']
    if (!otherCookie) throw new Error('set-cookie header missing')
    const takeover = await client
      .post('/api/auth/link-social')
      .headers({ cookie: otherCookie })
      .json({
        provider: 'apple',
        idToken: { token: 'relay' },
      })
    takeover.assertStatus(409)
  })

  test('linking still requires a session', async ({ client }) => {
    const response = await client.post('/api/auth/link-social').json({
      provider: 'apple',
      idToken: { token: 'relay' },
    })
    response.assertStatus(401)
  })

  test('matching email does not implicitly merge an unverified password account', async ({
    client,
  }) => {
    const signup = await client.post('/api/auth/sign-up/email').json({
      email: 'implicit-apple@example.com',
      password: 'test-password-123',
      name: 'Alice',
    })
    signup.assertStatus(200)
    const response = await client.post('/api/auth/sign-in/social').json({
      provider: 'apple',
      idToken: { token: 'matching' },
    })
    response.assertStatus(401)
  })
})
