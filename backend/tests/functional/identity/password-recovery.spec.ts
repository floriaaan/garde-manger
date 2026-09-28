import { test } from '@japa/runner'
import { auth } from '#infrastructure/auth/better-auth/instance'

test.group('password recovery', (group) => {
  const messages: { email: string; url: string }[] = []
  group.setup(async () => {
    const context = await auth.$context
    const options = context.options.emailAndPassword!
    const original = options.sendResetPassword
    options.sendResetPassword = async ({ user, url }) => {
      messages.push({ email: user.email, url })
    }
    return () => {
      options.sendResetPassword = original
    }
  })

  test('reset hides account existence, revokes sessions and consumes its token once', async ({
    client,
    assert,
  }) => {
    const email = 'password-recovery@example.com'
    const signup = await client.post('/api/auth/sign-up/email').json({
      email,
      password: 'old-password-123',
      name: 'Alice',
    })
    signup.assertStatus(200)
    const cookie = signup.headers()['set-cookie']
    if (!cookie) throw new Error('set-cookie header missing')
    const known = await client.post('/api/auth/request-password-reset').json({
      email,
      redirectTo: 'gardemanger://reset-password',
    })
    const unknown = await client.post('/api/auth/request-password-reset').json({
      email: 'missing-recovery@example.com',
      redirectTo: 'gardemanger://reset-password',
    })
    known.assertStatus(200)
    unknown.assertStatus(200)
    assert.deepEqual(known.body(), unknown.body())
    assert.lengthOf(messages, 1)
    const message = messages[0]
    if (!message) throw new Error('Password reset email missing')
    const token = new URL(message.url).pathname.split('/').pop()
    if (!token) throw new Error('Password reset token missing from email URL')
    const reset = await client.post('/api/auth/reset-password').json({
      token,
      newPassword: 'new-password-456',
    })
    reset.assertStatus(200)
    const session = await client.get('/api/session').headers({ cookie })
    session.assertBodyContains({ user: null })
    const reuse = await client.post('/api/auth/reset-password').json({
      token,
      newPassword: 'different-password-789',
    })
    reuse.assertStatus(400)
    const oldLogin = await client
      .post('/api/auth/sign-in/email')
      .json({ email, password: 'old-password-123' })
    oldLogin.assertStatus(401)
    const newLogin = await client
      .post('/api/auth/sign-in/email')
      .json({ email, password: 'new-password-456' })
    newLogin.assertStatus(200)
  })
})
