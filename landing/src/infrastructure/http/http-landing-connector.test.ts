import { describe, expect, test } from 'vitest'
import { HttpLandingConnector } from './http-landing-connector.js'

function fakeFetch(routes: Record<string, { status: number; body?: unknown }>): typeof fetch {
  return async (input) => {
    const route = routes[String(input)]
    if (!route) throw new Error(`unexpected fetch: ${String(input)}`)
    return new Response(route.body === undefined ? null : JSON.stringify(route.body), {
      status: route.status,
    })
  }
}

const REPO = 'https://api.github.com/repos/floriaaan/garde-manger'

describe('HttpLandingConnector', () => {
  test('getInstanceStats() returns null when the instance has not opted in (404)', async () => {
    const connector = new HttpLandingConnector({
      apiUrl: 'http://api',
      githubRepo: 'floriaaan/garde-manger',
      fetch: fakeFetch({ 'http://api/api/public/stats': { status: 404 } }),
    })

    expect(await connector.getInstanceStats()).toBeNull()
  })

  test('getInstanceStats() unwraps the stats envelope', async () => {
    const stats = { households: 2, productsConsumed: 10, recipesGenerated: 1 }
    const connector = new HttpLandingConnector({
      apiUrl: 'http://api',
      githubRepo: 'floriaaan/garde-manger',
      fetch: fakeFetch({ 'http://api/api/public/stats': { status: 200, body: { stats } } }),
    })

    expect(await connector.getInstanceStats()).toEqual(stats)
  })

  test('getInstanceStats() throws on a server error rather than claiming "disabled"', async () => {
    const connector = new HttpLandingConnector({
      apiUrl: 'http://api',
      githubRepo: 'floriaaan/garde-manger',
      fetch: fakeFetch({ 'http://api/api/public/stats': { status: 500 } }),
    })

    await expect(connector.getInstanceStats()).rejects.toThrow('500')
  })

  test('getProjectInfo() maps the repo and treats a missing release as no version', async () => {
    const connector = new HttpLandingConnector({
      apiUrl: 'http://api',
      githubRepo: 'floriaaan/garde-manger',
      fetch: fakeFetch({
        [REPO]: {
          status: 200,
          body: {
            full_name: 'floriaaan/garde-manger',
            html_url: 'https://github.com/floriaaan/garde-manger',
            stargazers_count: 7,
            license: { spdx_id: 'MIT' },
          },
        },
        [`${REPO}/releases/latest`]: { status: 404 },
      }),
    })

    expect(await connector.getProjectInfo()).toEqual({
      repository: 'floriaaan/garde-manger',
      url: 'https://github.com/floriaaan/garde-manger',
      stars: 7,
      license: 'MIT',
      latestVersion: null,
    })
  })
})
