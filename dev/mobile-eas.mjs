import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseEnv } from 'node:util'

const mobile = fileURLToPath(new URL('../mobile/', import.meta.url))
const fail = (message) => { throw new Error(message) }

// Arguments stay separate from shell code, including the publication message.
export function plan(command, config, env) {
  if (!['build', 'update'].includes(command)) fail('Expected build or update.')
  const matches = command === 'update'
    ? Object.entries(config.build).filter(([, profile]) => profile.channel === env.CHANNEL && env.CHANNEL)
    : Object.entries(config.build).filter(([name]) => name === env.PROFILE)
  if (matches.length !== 1) fail('Select exactly one configured PROFILE (build) or CHANNEL (update).')
  const [name, profile] = matches[0]
  // Current profiles are flat. Refuse inheritance rather than silently dropping its settings.
  if (profile.extends) fail('Resolve inherited profile settings before using this helper.')
  if ([name, profile.channel, profile.environment].includes('production') && env.CONFIRM !== 'production') {
    fail('Production requires CONFIRM=production.')
  }
  if (command === 'update') {
    if (!env.MESSAGE?.trim()) fail('MESSAGE is required.')
    if (!profile.environment) fail('The selected profile needs an explicit EAS environment.')
    return {
      profile,
      args: ['update', '--channel', profile.channel, '--environment', profile.environment, '--message', env.MESSAGE],
    }
  }
  if (!['ios', 'android', 'all'].includes(env.PLATFORM)) fail('PLATFORM must be ios, android or all.')
  if (!['auto', 'true', 'false'].includes(env.SUBMIT)) fail('SUBMIT must be auto, true or false.')
  const internal = profile.distribution === 'internal'
  const submit = env.SUBMIT === 'true' || (env.SUBMIT === 'auto' && !internal)
  const args = ['build', '--profile', name, '--platform', env.PLATFORM]
  if (submit) {
    if (internal) fail('Internal builds are distributed by install link, not store submission.')
    const platforms = env.PLATFORM === 'all' ? ['ios', 'android'] : [env.PLATFORM]
    if (platforms.some((platform) => !config.submit?.[name]?.[platform])) {
      fail('No matching submit configuration for this platform. Configure eas.json or use SUBMIT=false for manual distribution.')
    }
    args.push('--auto-submit-with-profile', name)
  }
  return { profile, args }
}

export function checkEnvironment(profile, remote) {
  for (const [key, value] of Object.entries(profile.env ?? {})) {
    if (remote[key] !== value) fail(`EAS environment ${profile.environment}: ${key} is missing or differs from eas.json. See mobile/README.md.`)
  }
}

function eas(args) {
  const result = spawnSync('eas', args, { cwd: mobile, stdio: 'inherit', shell: false })
  if (result.error) throw result.error
  if (result.status !== 0) fail(`EAS failed (${result.status ?? result.signal}).`)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const config = JSON.parse(readFileSync(join(mobile, 'eas.json'), 'utf8'))
    const command = process.argv[2]
    const { profile, args } = plan(command, config, process.env)
    if (command === 'update') {
      const directory = mkdtempSync(join(tmpdir(), 'gardemanger-eas-env-'))
      try {
        const path = join(directory, '.env')
        eas(['env:pull', '--environment', profile.environment, '--path', path, '--non-interactive'])
        checkEnvironment(profile, parseEnv(readFileSync(path, 'utf8')))
      } finally {
        rmSync(directory, { recursive: true, force: true })
      }
    }
    eas(args)
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
