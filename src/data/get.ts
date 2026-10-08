import { readCache, writeCache } from '../cache'
import { ensureConfig } from '../config'
import { createGitHubClient } from './client'
import { dataPath } from './path'
import { validateKey } from './validate'

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
