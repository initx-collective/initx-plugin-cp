import { readCache, removeCache, writeCache } from './cache'
import { ensureConfig } from './config'
import { GitHubClient } from './github'

export function dataPath(key: string, basePath: string): string {
  validateKey(key)
  return `${basePath}/${key}`
}

function hasControlChars(str: string): boolean {
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i)
    if (code < 0x20 || code === 0x7F) {
      return true
    }
  }
  return false
}

export function validateKey(key: string): void {
  if (!key) {
    throw new Error('Key cannot be empty.')
  }
  if (key.includes('/')) {
    throw new Error(`Key cannot contain / or "${key}". Nested paths are not supported.`)
  }
  if (key === '.' || key === '..') {
    throw new Error(`Key cannot be "${key}".`)
  }
  if (hasControlChars(key)) {
    throw new Error('Key cannot contain control characters.')
  }
  if (key.length > 200) {
    throw new Error('Key is too long (max 200 characters).')
  }
}

export function createGitHubClient(): GitHubClient {
  const cfg = ensureConfig()
  return new GitHubClient(cfg.repo, cfg.token, cfg.branch)
}

export async function getDataValue(key: string, options?: { bypassCache?: boolean }): Promise<string | null> {
  validateKey(key)
  const client = createGitHubClient()
  const cfg = ensureConfig()
  const path = dataPath(key, cfg.path)

  if (!options?.bypassCache) {
    const cached = readCache(key)
    if (cached)
      return cached.content
  }

  const file = await client.getFile(path)
  if (!file)
    return null

  const content = client.decodeContent(file)
  writeCache(key, content, file.sha)
  return content
}

export async function setDataValue(key: string, value: string): Promise<void> {
  validateKey(key)
  const client = createGitHubClient()
  const cfg = ensureConfig()
  const path = dataPath(key, cfg.path)

  const current = await client.getFile(path)
  await client.putFile(path, value, `cp: set ${key}`, current?.sha)
  removeCache(key)
}

export async function removeDataValue(key: string): Promise<void> {
  validateKey(key)
  const client = createGitHubClient()
  const cfg = ensureConfig()
  const path = dataPath(key, cfg.path)

  const current = await client.getFile(path)
  if (!current)
    return
  await client.deleteFile(path, current.sha, `cp: delete ${key}`)
}

export async function listDataKeys(): Promise<string[]> {
  const client = createGitHubClient()
  const cfg = ensureConfig()

  const entries = await client.listDir(cfg.path)
  return entries
    .filter(e => e.type === 'file')
    .map(e => e.name)
}
