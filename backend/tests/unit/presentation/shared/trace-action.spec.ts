import { readFile } from 'node:fs/promises'
import { test } from '@japa/runner'
import { traceAction, type ActionContext } from '#presentation/shared/trace-action'

function fakeContext(overrides: Partial<ActionContext> = {}) {
  const calls: { level: 'info' | 'warn' | 'error'; obj: Record<string, unknown>; msg: string }[] =
    []
  const ctx: ActionContext = {
    logger: {
      info: (obj, msg) => calls.push({ level: 'info', obj, msg }),
      warn: (obj, msg) => calls.push({ level: 'warn', obj, msg }),
      error: (obj, msg) => calls.push({ level: 'error', obj, msg }),
    },
    authenticatedUser: { id: 'user-1' },
    household: { id: 'household-1' },
    params: {},
    ...overrides,
  }
  return { ctx, calls }
}

test.group('traceAction', () => {
  test('success with no opts: logs info with outcome success', async ({ assert }) => {
    const { ctx, calls } = fakeContext()
    const result = await traceAction(ctx, 'fridge', { name: 'ListProducts' }, async () => ['p1'])

    assert.deepEqual(result, ['p1'])
    assert.equal(calls.length, 1)
    assert.equal(calls[0]?.level, 'info')
    assert.equal(calls[0]?.msg, 'action:fridge.list_products')
    assert.equal(calls[0]?.obj.action, 'fridge.list_products')
    assert.equal(calls[0]?.obj.useCase, 'ListProducts')
    assert.isUndefined(calls[0]?.obj.userId)
    assert.isUndefined(calls[0]?.obj.householdId)
    assert.equal(calls[0]?.obj.outcome, 'success')
    assert.isNumber(calls[0]?.obj.durationMs)
  })

  test('isError predicate true: logs warn with outcome error, still returns the value', async ({
    assert,
  }) => {
    const { ctx, calls } = fakeContext()
    const result = await traceAction(
      ctx,
      'fridge',
      { name: 'CreateProduct' },
      async () => ({ ok: false as const }),
      { isError: (r) => !r.ok },
    )

    assert.deepEqual(result, { ok: false })
    assert.equal(calls[0]?.level, 'warn')
    assert.equal(calls[0]?.obj.outcome, 'error')
  })

  test('fn throws: logs error with errorType, then re-throws the same error', async ({
    assert,
  }) => {
    const { ctx, calls } = fakeContext()
    let thrown: unknown

    try {
      await traceAction(ctx, 'fridge', { name: 'CreateProduct' }, async () => {
        throw new TypeError('boom')
      })
    } catch (error) {
      thrown = error
    }

    assert.instanceOf(thrown, TypeError)
    assert.equal(calls[0]?.level, 'error')
    assert.equal(calls[0]?.obj.outcome, 'error')
    assert.equal(calls[0]?.obj.errorType, 'TypeError')
  })

  test('entityId: route param wins when present, opts.entityId is the fallback', async ({
    assert,
  }) => {
    const { ctx: withParam, calls: callsWithParam } = fakeContext({ params: { id: 'route-id' } })
    await traceAction(
      withParam,
      'fridge',
      { name: 'UpdateProduct' },
      async () => ({ ok: true as const }),
      {
        entityId: () => 'from-result',
      },
    )
    assert.equal(callsWithParam[0]?.obj.entityId, 'route-id')

    const { ctx: withoutParam, calls: callsWithoutParam } = fakeContext()
    await traceAction(
      withoutParam,
      'fridge',
      { name: 'CreateProduct' },
      async () => ({ ok: true as const }),
      {
        entityId: () => 'from-result',
      },
    )
    assert.equal(callsWithoutParam[0]?.obj.entityId, 'from-result')
  })

  test('action name is domain + snake_case of the UseCase name', async ({ assert }) => {
    const { ctx, calls } = fakeContext()
    await traceAction(
      ctx,
      'home_assistant',
      { name: 'GetExpiringSoonProducts' },
      async () => undefined,
    )
    assert.equal(calls[0]?.obj.action, 'home_assistant.get_expiring_soon_products')
  })

  test('opts.action overrides the auto-derived label, but useCase still logs the real class name', async ({
    assert,
  }) => {
    const { ctx, calls } = fakeContext()
    await traceAction(ctx, 'fridge', { name: 'ListProducts' }, async () => undefined, {
      action: 'fridge.get_products',
    })
    assert.equal(calls[0]?.obj.action, 'fridge.get_products')
    assert.equal(calls[0]?.obj.useCase, 'ListProducts')
    assert.equal(calls[0]?.msg, 'action:fridge.get_products')
  })
})


test('expected household refusals are info and keep their stable code', async ({ assert }) => {
  for (const code of ['no_household', 'owner_cannot_leave']) {
    const { ctx, calls } = fakeContext()
    const result = { ok: false, error: code }
    assert.strictEqual(await traceAction(ctx, 'identity', { name: 'LeaveHousehold' }, async () => result, {
      isError: (value) => !value.ok,
    }), result)
    assert.equal(calls[0]?.level, 'info')
    assert.equal(calls[0]?.obj['error.code'], code)
    assert.equal(calls[0]?.obj['event.outcome'], 'refused')
  }
})

test('a thrown 401 is info; a structured 503 retains technical diagnostics', async ({ assert }) => {
  for (const status of [401, 503]) {
    const { ctx, calls } = fakeContext()
    const error = { code: status === 401 ? 'unauthenticated' : 'session_resolution_failed', statusCode: status,
      message: 'password=secret alice@example.com', cause: new Error('fetch failed') }
    try { await traceAction(ctx, 'identity', { name: 'GetSession' }, async () => { throw error }) } catch (caught) {
      assert.strictEqual(caught, error)
    }
    assert.equal(calls[0]?.level, status === 401 ? 'info' : 'error')
    assert.equal(calls[0]?.obj['http.response.status_code'], status)
    assert.notInclude(JSON.stringify(calls), 'secret')
    assert.notInclude(JSON.stringify(calls), 'alice@example.com')
    if (status === 503) assert.include(String(calls[0]?.obj['exception.cause']), 'fetch failed')
  }
})


test('mobile and backend logging conventions stay identical', async ({ assert }) => {
  const [backend, mobile] = await Promise.all([
    readFile(new URL('../../../../src/domain/shared/log-diagnostic.ts', import.meta.url), 'utf8'),
    readFile(new URL('../../../../../mobile/src/domain/shared/log-diagnostic.ts', import.meta.url), 'utf8'),
  ])
  assert.equal(backend, mobile)
})
