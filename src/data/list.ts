import { ensureConfig } from '../config'
import { createGitHubClient } from './client'

export async function listDataKeys(): Promise<string[]> {
  const client = createGitHubClient()
  const cfg = ensureConfig()

  const entries = await client.listDir(cfg.path)
  return entries
    .filter(e => e.type === 'file')
    .map(e => e.name)
}
