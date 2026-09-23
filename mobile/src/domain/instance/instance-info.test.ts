import { isSameVersion } from './instance-info.js'

describe('isSameVersion', () => {
  it('matches the store-safe app version against a server tag, with or without "v"', () => {
    expect(isSameVersion('1.0.0', '1.0.0')).toBe(true)
    expect(isSameVersion('v1.0.0', '1.0.0')).toBe(true)
  })

  it('flags a release-candidate server as a different version than the 1.0.0 app', () => {
    expect(isSameVersion('1.0.0-rc.1', '1.0.0')).toBe(false)
  })

  it('flags an older server', () => {
    expect(isSameVersion('0.9.2', '1.0.0')).toBe(false)
  })
})
