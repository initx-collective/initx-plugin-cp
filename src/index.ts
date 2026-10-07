import type { InitxContext, InitxMatcherRules } from '@initx-plugin/core'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import os from 'node:os'
import { resolve as pathResolve } from 'node:path'
import process, { cwd } from 'node:process'
import { InitxPlugin } from '@initx-plugin/core'
import { c, gpgList, inquirer, log } from '@initx-plugin/utils'

import clipboard from 'clipboardy'

import { clearConfigValue, getConfigValue, loadConfig, setConfigValue } from './config'
import { getDataValue, listDataKeys, removeDataValue, setDataValue } from './data'
import { CP_RESERVED_CONFIG_KEYS, CpConfigCommand, CpType } from './types'

const PRESET_TYPES = new Set<string>(Object.values(CpType))
const RESERVED_CONFIG_KEYS = new Set<string>(CP_RESERVED_CONFIG_KEYS)

export default class CpPlugin extends InitxPlugin {
  rules: InitxMatcherRules = [
    {
      matching: 'cp',
      description: 'Copy SSH / GPG / CWD / data key to clipboard'
    },
    {
      matching: 'cp-config',
      description: 'Configure cp plugin (repo, token, branch, path) and data keys'
    }
  ]

  async handle(ctx: InitxContext, ...args: string[]) {
    if (ctx.key === 'cp-config') {
      await this.handleConfigCommand(args)
      return
    }
    await this.handleCopy(args)
  }

  // #region cp

  private async handleCopy(args: string[]) {
    const [key] = args
    if (!key) {
      log.error(`Please enter the copy type. Available presets: ${Object.values(CpType).join(', ')}`)
      return
    }

    if (PRESET_TYPES.has(key)) {
      await this.runPreset(key as CpType)
      return
    }

    await this.runDataCopy(key)
  }

  private async runPreset(cpType: CpType) {
    const handler = this[cpType]
    if (typeof handler !== 'function') {
      log.error(`Unknown preset: ${cpType}`)
      return
    }
    await handler.call(this)
  }

  private async runDataCopy(key: string) {
    try {
      const value = await getDataValue(key)
      if (value === null) {
        log.error(`Data key "${key}" not found. Use \`ix cp-config set ${key} <value>\` to create it.`)
        return
      }
      this.copy(value)
      log.success(`Data key "${key}" copied to clipboard`)
    }
    catch (err) {
      log.error(`Failed to fetch "${key}": ${(err as Error).message}`)
    }
  }

  async [CpType.SSH]() {
    const sshDir = pathResolve(os.homedir(), '.ssh')

    if (!existsSync(sshDir)) {
      log.error(`SSH directory not found, path: ${sshDir}`)
      return
    }

    const publicKeysName = readdirSync(sshDir).filter(file => file.endsWith('.pub'))

    if (publicKeysName.length === 0) {
      log.error('SSH key not found')
      return
    }

    let publicKeyName: string

    if (publicKeysName.length === 1) {
      const [firstKey] = publicKeysName
      publicKeyName = firstKey
    }
    else {
      const index = await inquirer.select('Select SSH key', publicKeysName)
      publicKeyName = publicKeysName[index]
    }

    const publicKeyPath = pathResolve(sshDir, publicKeyName)
    const publicKey = readFileSync(publicKeyPath, 'utf8')

    this.copy(publicKey)
    log.success('Key copied to clipboard')
  }

  async [CpType.GPG]() {
    const list = await gpgList()

    if (list.length === 0) {
      log.error('No GPG keys found')
      return
    }

    let index = 0

    if (list.length > 1) {
      index = await inquirer.select('Select GPG key', list.map(({ key, name, email }) => `${key} - ${name} <${email}>`))
    }

    const { key } = list[index]

    const result = await c('gpg', ['--armor', '--export', key])

    this.copy(result.content)
    log.success('GPG public key copied to clipboard')
  }

  async [CpType.CWD]() {
    this.copy(cwd())
    log.success('Current working directory copied to clipboard')
  }

  private copy(content: string) {
    clipboard.writeSync(content)
  }

  // #endregion cp

  // #region cp-config

  private async handleConfigCommand(args: string[]) {
    const [command, ...rest] = args
    if (!command || CpConfigCommand.HELP === command || command === '--help' || command === '-h') {
      this.printConfigHelp()
      return
    }

    switch (command) {
      case CpConfigCommand.SET:
        await this.configSet(rest)
        break
      case CpConfigCommand.GET:
        await this.configGet(rest[0])
        break
      case CpConfigCommand.LIST:
      case CpConfigCommand.LS:
        await this.configList()
        break
      case CpConfigCommand.RM:
        await this.configRm(rest[0])
        break
      case CpConfigCommand.STATUS:
        this.configStatus()
        break
      case CpConfigCommand.SETUP:
        await this.configSetup()
        break
      default:
        log.error(`Unknown command: ${command}`)
        this.printConfigHelp()
    }
  }

  private async configSet(args: string[]) {
    const [key, ...rest] = args
    if (!key) {
      log.error('Usage: cp-config set <key> <value>')
      return
    }

    if (RESERVED_CONFIG_KEYS.has(key)) {
      const value = rest.join(' ').trim()
      if (!value && key !== 'token' && key !== 'branch' && key !== 'path') {
        log.error(`Usage: cp-config set ${key} <value>`)
        return
      }
      if (key === 'token') {
        log.warn('Token is saved in plaintext at ~/.initx/cp/config.json. Prefer a fine-grained GitHub PAT with minimal scopes.')
      }
      setConfigValue(key as 'repo' | 'token' | 'branch' | 'path', value || (key === 'branch' ? 'main' : key === 'path' ? 'data' : ''))
      log.success(`Config "${key}" saved`)
      return
    }

    const value = rest.join(' ')
    if (!value) {
      log.error('Usage: cp-config set <key> <value>')
      return
    }

    try {
      await setDataValue(key, value)
      log.success(`Data "${key}" saved`)
    }
    catch (err) {
      log.error(`Failed to save data: ${(err as Error).message}`)
    }
  }

  private async configGet(key?: string) {
    if (!key) {
      log.error('Usage: cp-config get <key>')
      return
    }

    if (RESERVED_CONFIG_KEYS.has(key)) {
      const value = getConfigValue(key as 'repo' | 'token' | 'branch' | 'path')
      if (!value) {
        log.warn(`Config "${key}" is not set`)
        return
      }
      // eslint-disable-next-line no-console
      console.log(value)
      return
    }

    try {
      const value = await getDataValue(key)
      if (value === null) {
        log.error(`Data key "${key}" not found`)
        return
      }
      // eslint-disable-next-line no-console
      console.log(value)
    }
    catch (err) {
      log.error(`Failed to get data: ${(err as Error).message}`)
    }
  }

  private async configList() {
    try {
      const keys = await listDataKeys()
      if (keys.length === 0) {
        log.info('No data keys configured')
        return
      }
      // eslint-disable-next-line no-console
      console.log(keys.join('\n'))
    }
    catch (err) {
      log.error(`Failed to list data: ${(err as Error).message}`)
    }
  }

  private async configRm(key?: string) {
    if (!key) {
      log.error('Usage: cp-config rm <key>')
      return
    }

    if (RESERVED_CONFIG_KEYS.has(key)) {
      clearConfigValue(key as 'repo' | 'token' | 'branch' | 'path')
      log.success(`Config "${key}" removed`)
      return
    }

    try {
      await removeDataValue(key)
      log.success(`Data "${key}" removed`)
    }
    catch (err) {
      log.error(`Failed to remove data: ${(err as Error).message}`)
    }
  }

  private configStatus() {
    const config = loadConfig()
    const redacted: Record<string, unknown> = { ...config }
    if (typeof redacted.token === 'string' && redacted.token) {
      redacted.token = '***'
    }
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(redacted, null, 2))
  }

  private async configSetup() {
    if (!process.stdin.isTTY) {
      log.error('cp-config setup requires an interactive TTY. Use `cp-config set <key> <value>` instead.')
      return
    }

    const current = loadConfig()
    log.info('cp-config setup — press Enter to keep the current value, type to overwrite.')

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
      log.success(`Config "repo" saved`)

      const tokenMsg = current.token
        ? 'GitHub PAT (Enter to keep current value, or paste a new token)'
        : 'GitHub PAT'
      const token = await inquirer.password(tokenMsg, { mask: '*' })
      if (token && token !== current.token) {
        log.warn('Token is saved in plaintext at ~/.initx/cp/config.json. Prefer a fine-grained GitHub PAT with minimal scopes.')
        setConfigValue('token', token)
        log.success(`Config "token" saved`)
      }
      else if (!token && current.token) {
        log.info('Token unchanged.')
      }
      else if (!token && !current.token) {
        log.warn('Token not set. You can set it later via `cp-config set token <value>`.')
      }

      const branchMsg = current.branch ? `Branch (current: ${current.branch})` : 'Branch'
      const branch = await inquirer.input(branchMsg, { default: current.branch || 'main' })
      setConfigValue('branch', branch || 'main')
      log.success(`Config "branch" saved`)

      const pathMsg = current.path ? `Path inside repo (current: ${current.path})` : 'Path inside repo'
      const dataPath = await inquirer.input(pathMsg, { default: current.path || 'data' })
      setConfigValue('path', dataPath || 'data')
      log.success(`Config "path" saved`)

      // eslint-disable-next-line no-console
      console.log('\nCurrent config:')
      this.configStatus()
    }
    catch (err) {
      log.warn(`Setup cancelled. ${(err as Error).message || ''} Existing config left untouched.`)
    }
  }

  private printConfigHelp() {
    const lines = [
      'Usage: cp-config <command> [args]',
      '',
      'Commands:',
      '  setup                 Interactive setup for repo / token / branch / path',
      '  set <key> <value>   Set a config value (repo, token, branch, path) or a data key',
      '  get <key>             Get a config or data value',
      '  list, ls              List data keys',
      '  rm <key>              Remove a config or data key',
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
      '  cp-config rm my-secret'
    ]
    // eslint-disable-next-line no-console
    console.log(lines.join('\n'))
  }

  // #endregion cp-config
}
