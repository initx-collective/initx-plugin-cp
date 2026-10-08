import process from 'node:process'
import { inquirer, loadingFunction, logger } from '@initx-plugin/utils'

import { clearConfigValue, getConfigValue, loadConfig, setConfigValue } from '../config'
import { getDataValue, listDataKeys, removeDataValue, renameDataValue, setDataValue } from '../data'
import { pushRecent, removeRecent, renameRecent } from '../recent'
import { CP_RESERVED_CONFIG_KEYS, CpConfigCommand } from '../types'

const RESERVED_CONFIG_KEYS = new Set<string>(CP_RESERVED_CONFIG_KEYS)

export async function handleConfigCommand(args: string[]): Promise<void> {
  const [command, ...rest] = args
  if (!command || CpConfigCommand.HELP === command || command === '--help' || command === '-h') {
    printConfigHelp()
    return
  }

  switch (command) {
    case CpConfigCommand.SET:
      await configSet(rest)
      break
    case CpConfigCommand.GET:
      await configGet(rest[0])
      break
    case CpConfigCommand.LIST:
    case CpConfigCommand.LS:
      await configList()
      break
    case CpConfigCommand.RM:
      await configRm(rest[0])
      break
    case CpConfigCommand.RENAME:
      await configRename(rest)
      break
    case CpConfigCommand.STATUS:
      configStatus()
      break
    case CpConfigCommand.SETUP:
      await configSetup()
      break
    default:
      logger.error(`Unknown command: ${command}`)
      printConfigHelp()
  }
}

async function configSet(args: string[]): Promise<void> {
  const [key, ...rest] = args
  if (!key) {
    logger.error('Usage: cp-config set <key> <value>')
    return
  }

  if (RESERVED_CONFIG_KEYS.has(key)) {
    const value = rest.join(' ').trim()
    if (!value && key !== 'token' && key !== 'branch' && key !== 'path') {
      logger.error(`Usage: cp-config set ${key} <value>`)
      return
    }
    if (key === 'token') {
      logger.warn('Token is saved in plaintext at ~/.initx/cp/config.json. Prefer a fine-grained GitHub PAT with minimal scopes.')
    }
    setConfigValue(key as 'repo' | 'token' | 'branch' | 'path', value || (key === 'branch' ? 'main' : key === 'path' ? 'data' : ''))
    logger.success(`Config "${key}" saved`)
    return
  }

  const value = rest.join(' ')
  if (!value) {
    logger.error('Usage: cp-config set <key> <value>')
    return
  }

  try {
    await loadingFunction(`Saving "${key}" to GitHub`, () => setDataValue(key, value))
    logger.success(`Data "${key}" saved`)
    pushRecent(key)
  }
  catch (err) {
    logger.error(`Failed to save data: ${(err as Error).message}`)
  }
}

async function configGet(key?: string): Promise<void> {
  if (!key) {
    logger.error('Usage: cp-config get <key>')
    return
  }

  if (RESERVED_CONFIG_KEYS.has(key)) {
    const value = getConfigValue(key as 'repo' | 'token' | 'branch' | 'path')
    if (!value) {
      logger.warn(`Config "${key}" is not set`)
      return
    }
    // eslint-disable-next-line no-console
    console.log(value)
    return
  }

  try {
    const value = await loadingFunction(`Fetching "${key}" from GitHub`, () => getDataValue(key))
    if (value === null) {
      logger.error(`Data key "${key}" not found`)
      return
    }
    // eslint-disable-next-line no-console
    console.log(value)
  }
  catch (err) {
    logger.error(`Failed to get data: ${(err as Error).message}`)
  }
}

async function configList(): Promise<void> {
  try {
    const keys = await loadingFunction('Listing data keys', () => listDataKeys())
    if (keys.length === 0) {
      logger.info('No data keys configured')
      return
    }
    // eslint-disable-next-line no-console
    console.log(keys.join('\n'))
  }
  catch (err) {
    logger.error(`Failed to list data: ${(err as Error).message}`)
  }
}

async function configRm(key?: string): Promise<void> {
  if (!key) {
    logger.error('Usage: cp-config rm <key>')
    return
  }

  if (RESERVED_CONFIG_KEYS.has(key)) {
    clearConfigValue(key as 'repo' | 'token' | 'branch' | 'path')
    logger.success(`Config "${key}" removed`)
    return
  }

  try {
    await loadingFunction(`Removing "${key}" from GitHub`, () => removeDataValue(key))
    logger.success(`Data "${key}" removed`)
    removeRecent(key)
  }
  catch (err) {
    logger.error(`Failed to remove data: ${(err as Error).message}`)
  }
}

async function configRename(args: string[]): Promise<void> {
  const [oldKey, newKey] = args
  if (!oldKey || !newKey) {
    logger.error('Usage: cp-config rename <oldKey> <newKey>')
    return
  }

  if (RESERVED_CONFIG_KEYS.has(oldKey) || RESERVED_CONFIG_KEYS.has(newKey)) {
    logger.error(`Cannot rename reserved config keys (${Array.from(RESERVED_CONFIG_KEYS).join(', ')}).`)
    return
  }

  try {
    await loadingFunction(`Renaming "${oldKey}" to "${newKey}"`, () => renameDataValue(oldKey, newKey))
    renameRecent(oldKey, newKey)
    logger.success(`Data "${oldKey}" renamed to "${newKey}"`)
  }
  catch (err) {
    logger.error(`Failed to rename data: ${(err as Error).message}`)
  }
}

function configStatus(): void {
  const config = loadConfig()
  const redacted: Record<string, unknown> = { ...config }
  if (typeof redacted.token === 'string' && redacted.token) {
    redacted.token = '***'
  }
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(redacted, null, 2))
}

async function configSetup(): Promise<void> {
  if (!process.stdin.isTTY) {
    logger.error('cp-config setup requires an interactive TTY. Use `cp-config set <key> <value>` instead.')
    return
  }

  const current = loadConfig()
  logger.info('cp-config setup — press Enter to keep the current value, type to overwrite.')

  try {
    const repoMsg = current.repo
      ? `GitHub repo (current: ${current.repo})`
      : 'GitHub repo (owner/repo)'
    const repo = await inquirer.input(repoMsg, {
      default: current.repo ?? undefined,
      required: true,
      pattern: /^[^/\s]+\/[^/\s]+$/,
      patternError: 'Repo must be in the form "owner/repo".'
    })
    setConfigValue('repo', repo)
    logger.success(`Config "repo" saved`)

    const tokenMsg = current.token
      ? 'GitHub PAT (Enter to keep current value, or paste a new token)'
      : 'GitHub PAT'
    const token = await inquirer.password(tokenMsg, { mask: '*' })
    if (token && token !== current.token) {
      logger.warn('Token is saved in plaintext at ~/.initx/cp/config.json. Prefer a fine-grained GitHub PAT with minimal scopes.')
      setConfigValue('token', token)
      logger.success(`Config "token" saved`)
    }
    else if (!token && current.token) {
      logger.info('Token unchanged.')
    }
    else if (!token && !current.token) {
      logger.warn('Token not set. You can set it later via `cp-config set token <value>`.')
    }

    const branchMsg = current.branch ? `Branch (current: ${current.branch})` : 'Branch'
    const branch = await inquirer.input(branchMsg, { default: current.branch || 'main' })
    setConfigValue('branch', branch || 'main')
    logger.success(`Config "branch" saved`)

    const pathMsg = current.path ? `Path inside repo (current: ${current.path})` : 'Path inside repo'
    const dataPath = await inquirer.input(pathMsg, { default: current.path || 'data' })
    setConfigValue('path', dataPath || 'data')
    logger.success(`Config "path" saved`)

    // eslint-disable-next-line no-console
    console.log('\nCurrent config:')
    configStatus()
  }
  catch (err) {
    logger.warn(`Setup cancelled. ${(err as Error).message || ''} Existing config left untouched.`)
  }
}

function printConfigHelp(): void {
  const lines = [
    'Usage: cp-config <command> [args]',
    '',
    'Commands:',
    '  setup                 Interactive setup for repo / token / branch / path',
    '  set <key> <value>   Set a config value (repo, token, branch, path) or a data key',
    '  get <key>             Get a config or data value',
    '  list, ls              List data keys',
    '  rm <key>              Remove a config or data key',
    '  rename <old> <new>    Rename a data key (file) without changing its value',
    '  status                Show config (token redacted)',
    '  help                  Show this help',
    '',
    'Config keys: repo, token, branch, path. Anything else is treated as a data key.',
    '',
    'Examples:',
    '  cp-config setup',
    '  cp-config set repo owner/private-repo',
    '  cp-config set token ghp_xxxxxxxxxxxx',
    '  cp-config set my-secret "hello world"',
    '  cp-config get my-secret',
    '  cp-config list',
    '  cp-config rm my-secret',
    '  cp-config rename my-secret renamed-secret'
  ]
  // eslint-disable-next-line no-console
  console.log(lines.join('\n'))
}
