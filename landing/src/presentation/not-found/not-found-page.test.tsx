import { render, screen, cleanup } from '@testing-library/react'
import { createMemoryHistory, createRootRoute, createRoute, createRouter, RouterProvider } from '@tanstack/react-router'
import { afterEach, expect, test } from 'vitest'
import { NotFoundPage } from './not-found-page.js'

afterEach(cleanup)

test.each([
  ['/page-inexistante', 'Page introuvable', 'Revenir à l’accueil', '/'],
  ['/en/page-inexistante', 'Page not found', 'Back to homepage', '/en'],
  ['/enigma', 'Page introuvable', 'Revenir à l’accueil', '/'],
])('unknown URL %s keeps the not-found status and the correct home link', async (url, title, action, home) => {
  const root = createRootRoute({ notFoundComponent: NotFoundPage })
  const index = createRoute({ getParentRoute: () => root, path: '/', component: () => <p>Accueil valide</p> })
  const router = createRouter({ routeTree: root.addChildren([index]), history: createMemoryHistory({ initialEntries: [url] }) })
  await router.load()
  render(<RouterProvider router={router} />)

  expect(await screen.findByRole('heading', { level: 1, name: title })).toBeTruthy()
  expect(screen.getByRole('link', { name: action }).getAttribute('href')).toBe(home)
  expect(router.state.statusCode).toBe(404)
})
