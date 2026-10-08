import { existsSync, readdirSync, readFileSync } from 'node:fs'
import os from 'node:os'
import { resolve as pathResolve } from 'node:path'
import process, { cwd } from 'node:process'
import { c, gpgList, inquirer, loadingFunction, logger } from '@initx-plugin/utils'
import { writeText } from 'tinyclip'

import { getDataValue, listDataKeys } from '../data'
import { loadRecent, pushRecent } from '../recent'
import { CpType } from '../types'

const PRESET_TYPES = new Set<string>(Object.values(CpType))

type PresetHandler = () => Promise<void>

const PRESET_HANDLERS: Record<CpType, PresetHandler> = {
  [CpType.SSH]: copySsh,
  [CpType.GPG]: copyGpg,
  [CpType.CWD]: copyCwd
}

export async function handleCopy(args: string[]): Promise<void> {
  const [key] = args
  if (!key) {
    logger.error(`Please enter the copy type. Available presets: ${Object.values(CpType).join(', ')}`)
    return
  }

  if (PRESET_TYPES.has(key)) {
    await runPreset(key as CpType)
    return
  }

  await runDataCopy(key)
}

export async function runList(): Promise<void> {
  if (!process.stdin.isTTY) {
    logger.error('cp (interactive picker) requires an interactive TTY.')
    return
  }

  const presets = Object.values(CpType)
  let dataKeys: string[] = []
  try {
    dataKeys = await loadingFunction('Loading data keys', () => listDataKeys())
  }
  catch (err) {
    logger.warn(`Could not load data keys: ${(err as Error).message}`)
  }

  const available = new Set<string>([...presets, ...dataKeys])
  const recent = loadRecent().filter(k => available.has(k))

  // Compose the final order:
  // 1) items from recent (in MRU order)
  // 2) everything else, alphabetically
  const seen = new Set<string>()
  const ordered: string[] = []
  for (const k of recent) {
    if (seen.has(k))
      continue
    ordered.push(k)
    seen.add(k)
  }
  for (const k of [...dataKeys].sort()) {
    if (seen.has(k))
      continue
    ordered.push(k)
    seen.add(k)
  }
  for (const k of presets) {
    if (seen.has(k))
      continue
    ordered.push(k)
    seen.add(k)
  }

  if (ordered.length === 0) {
    logger.warn('No copyable keys found.')
    return
  }

  const items = ordered.map((key) => {
    const isPreset = PRESET_TYPES.has(key)
    return {
      name: key,
      value: key,
      description: isPreset ? 'preset' : 'data'
    }
  })

  const picked = await inquirer.search('Select a key to copy', items)
  await handleCopy([picked])
}

async function runPreset(cpType: CpType): Promise<void> {
  const handler = PRESET_HANDLERS[cpType]
  if (!handler) {
    logger.error(`Unknown preset: ${cpType}`)
    return
  }
  await handler()
  pushRecent(cpType)
}

async function runDataCopy(key: string): Promise<void> {
  try {
    const value = await loadingFunction(`Fetching "${key}"`, () => getDataValue(key))
    if (value === null) {
      logger.error(`Data key "${key}" not found. Use \`ix cp-config set ${key} <value>\` to create it.`)
      return
    }
    await copy(value)
    logger.success(`Data key "${key}" copied to clipboard`)
    pushRecent(key)
  }
  catch (err) {
    logger.error(`Failed to fetch "${key}": ${(err as Error).message}`)
  }
}

async function copy(content: string): Promise<void> {
  await writeText(content)
}

async function copySsh(): Promise<void> {
  const sshDir = pathResolve(os.homedir(), '.ssh')

  if (!existsSync(sshDir)) {
    logger.error(`SSH directory not found, path: ${sshDir}`)
    return
  }

  const publicKeysName = readdirSync(sshDir).filter(file => file.endsWith('.pub'))

  if (publicKeysName.length === 0) {
    logger.error('SSH key not found')
    return
  }

  let publicKeyName: string

  if (publicKeysName.length === 1) {
    publicKeyName = publicKeysName[0]!
  }
  else {
    const index = await inquirer.select('Select SSH key', publicKeysName)
    publicKeyName = publicKeysName[index]!
  }

  const publicKeyPath = pathResolve(sshDir, publicKeyName)
  const publicKey = readFileSync(publicKeyPath, 'utf8')

  await copy(publicKey)
  logger.success('Key copied to clipboard')
}

async function copyGpg(): Promise<void> {
  const list = await gpgList()

  if (list.length === 0) {
    logger.error('No GPG keys found')
    return
  }

  let index = 0

  if (list.length > 1) {
    index = await inquirer.select('Select GPG key', list.map(({ key, name, email }) => `${key} - ${name} <${email}>`))
  }

  const { key } = list[index]!

  const result = await c('gpg', ['--armor', '--export', key])

  await copy(result.content)
  logger.success('GPG public key copied to clipboard')
}

async function copyCwd(): Promise<void> {
  await copy(cwd())
  logger.success('Current working directory copied to clipboard')
}
