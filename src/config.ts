import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { resolve } from 'node:path'

const CONFIG_DIR = resolve(homedir(), '.initx', 'cp')
const CONFIG_FILE = resolve(CONFIG_DIR, 'config.json')

export interface CpConfig {
  repo?: string
  token?: string
  branch?: string
  path?: string
}

export interface ResolvedCpConfig {
  repo: string
  token: string
  branch: string
  path: string
}

export function getConfigDir(): string {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true })
  }
  return CONFIG_DIR
}

export function loadConfig(): CpConfig {
  if (!existsSync(CONFIG_FILE))
    return {}
  try {
    return JSON.parse(readFileSync(CONFIG_FILE, 'utf8')) as CpConfig
  }
  catch {
    return {}
  }
}

export function saveConfig(config: CpConfig): void {
  getConfigDir()
  writeFileSync(CONFIG_FILE, `${JSON.stringify(config, null, 2)}\n`, 'utf8')
}

export function getConfigValue<K extends keyof CpConfig>(key: K): CpConfig[K] {
  return loadConfig()[key]
}

export function setConfigValue<K extends keyof CpConfig>(key: K, value: CpConfig[K]): void {
  const config = loadConfig()
  config[key] = value
  saveConfig(config)
}

export function clearConfigValue<K extends keyof CpConfig>(key: K): void {
  const config = loadConfig()
  delete config[key]
  saveConfig(config)
}

/**
 * Ensure cp plugin is configured (repo + token) and return the resolved config.
 * Throws a helpful error if config is missing.
 */
export function ensureConfig(): ResolvedCpConfig {
  const cfg = loadConfig()
  if (!cfg.repo) {
    throw new Error('cp-config repo is not set. Run `ix cp-config set repo <owner/repo>` first.')
  }
  if (!cfg.token) {
    throw new Error('cp-config token is not set. Run `ix cp-config set token <github_pat>` first.')
  }
  return {
    repo: cfg.repo,
    token: cfg.token,
    branch: cfg.branch ?? 'main',
    path: cfg.path ?? 'data'
  }
}
