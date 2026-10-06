import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseEnv } from 'node:util'
import { createInterface } from 'node:readline/promises'

const mobile = fileURLToPath(new URL('../mobile/', import.meta.url))
const fail = (message) => { throw new Error(message) }

// Arguments stay separate from shell code, including the publication message.
export function plan(command, config, env) {
  env = {
    ...env,
    PROFILE: env.PROFILE || 'production',
    PLATFORM: env.PLATFORM || 'all',
    SUBMIT: env.SUBMIT || 'auto',
    CHANNEL: env.CHANNEL || config.build.production?.channel,
  }
  if (!['build', 'update'].includes(command)) fail('Expected build or update.')
  const matches = command === 'update'
    ? Object.entries(config.build).filter(([, profile]) => profile.channel === env.CHANNEL && env.CHANNEL)
    : Object.entries(config.build).filter(([name]) => name === env.PROFILE)
  if (matches.length !== 1) fail('Select exactly one configured PROFILE (build) or CHANNEL (update).')
  const [name, profile] = matches[0]
  // Current profiles are flat. Refuse inheritance rather than silently dropping its settings.
  if (profile.extends) fail('Resolve inherited profile settings before using this helper.')
  const production = [name, profile.channel, profile.environment].includes('production')
  if (command === 'update') {
    if (!env.MESSAGE?.trim()) fail('MESSAGE is required.')
    if (!profile.environment) fail('The selected profile needs an explicit EAS environment.')
    return {
      profile,
      production,
      commands: [['update', '--channel', profile.channel, '--environment', profile.environment, '--message', env.MESSAGE]],
    }
  }
  if (!['ios', 'android', 'all'].includes(env.PLATFORM)) fail('PLATFORM must be ios, android or all.')
  if (!['auto', 'true', 'false'].includes(env.SUBMIT)) fail('SUBMIT must be auto, true or false.')
  const internal = profile.distribution === 'internal'
  const platforms = env.PLATFORM === 'all' ? ['ios', 'android'] : [env.PLATFORM]
  const submit = env.SUBMIT === 'true' || (env.SUBMIT === 'auto' && !internal)
  if (submit && internal) fail('Internal builds are distributed by install link, not store submission.')
  if (submit && platforms.some((platform) => !config.submit?.[name]?.[platform])) {
    fail('No matching submit configuration for this platform. Configure eas.json or use SUBMIT=false for manual distribution.')
  }
  const args = ['build', '--profile', name, '--platform', env.PLATFORM]
  if (submit) args.push('--auto-submit-with-profile', name)
  return { profile, production, commands: [args] }
}

export async function confirmProduction(production, env, input = process.stdin, output = process.stdout) {
  if (!production || env.CONFIRM === 'production') return
  if (env.CONFIRM || !input.isTTY || !output.isTTY) fail('Production requires an interactive confirmation or CONFIRM=production.')
  const prompt = createInterface({ input, output })
  try {
    const answer = await prompt.question('Pour confirmer la publication en production, saisis "production" : ')
    if (answer.trim() !== 'production') fail('Publication cancelled.')
  } finally {
    prompt.close()
  }
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
    const { profile, production, commands } = plan(command, config, process.env)
    console.log(commands.map((args) => ['eas', ...args].map((arg) => JSON.stringify(arg)).join(' ')).join('\n'))
    await confirmProduction(production, process.env)
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
    for (const args of commands) eas(args)
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
