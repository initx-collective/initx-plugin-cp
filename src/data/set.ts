import { removeCache } from '../cache'
import { ensureConfig } from '../config'
import { createGitHubClient } from './client'
import { dataPath } from './path'
import { validateKey } from './validate'

export async function setDataValue(key: string, value: string): Promise<void> {
  validateKey(key)
  const client = createGitHubClient()
  const cfg = ensureConfig()
  const path = dataPath(key, cfg.path)

  const current = await client.getFile(path)
  await client.putFile(path, value, `cp: set ${key}`, current?.sha)
  removeCache(key)
}
