import { ensureConfig } from '../config'
import { createGitHubClient } from './client'
import { dataPath } from './path'
import { validateKey } from './validate'

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
