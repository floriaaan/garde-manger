/** @jest-environment node */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('self-hosted web fonts', () => {
  const css = readFileSync(resolve(__dirname, 'fonts.css'), 'utf8')
  const faces = [...css.matchAll(/@font-face\s*\{([^}]+)\}/g)].map((match) => match[1])

  it('ships real WOFF2 assets for every declared font URL', () => {
    expect(faces).toHaveLength(4)
    for (const face of faces) {
      const url = face.match(/url\('([^']+)'\)/)?.[1]
      expect(url).toMatch(/^\/fonts\/[^/]+\.woff2$/)
      const asset = readFileSync(resolve(__dirname, '../../..', 'public', url!.slice(1)))
      expect(asset.subarray(0, 4).toString('ascii')).toBe('wOF2')
    }
  })

  it('keeps fallback text visible while both families load', () => {
    for (const face of faces) {
      expect(face).toMatch(/font-display:\s*swap;/)
    }
    expect(css).toContain("font-family: 'Plus Jakarta Sans'")
    expect(css).toContain('font-weight: 200 800;')
    expect(css).toContain("font-family: 'Spectral'")
    expect(css).toContain('font-weight: 600;')
  })
})
