import { renameCache } from '../cache'
import { ensureConfig } from '../config'
import { createGitHubClient } from './client'
import { dataPath } from './path'
import { validateKey } from './validate'

/**
 * Rename a data key (and its backing GitHub file) without altering its value.
 *
 * GitHub has no native rename API, so this performs PUT(new) + DELETE(old).
 * PUT runs first so a failed PUT leaves the old file untouched; if PUT
 * succeeds but DELETE fails, both files exist and the caller is told.
 */
export async function renameDataValue(oldKey: string, newKey: string): Promise<void> {
  validateKey(oldKey)
  validateKey(newKey)
  if (oldKey === newKey) {
    throw new Error(`Old and new keys are the same ("${oldKey}"). Nothing to rename.`)
  }

  const client = createGitHubClient()
  const cfg = ensureConfig()
  const oldPath = dataPath(oldKey, cfg.path)
  const newPath = dataPath(newKey, cfg.path)

  const current = await client.getFile(oldPath)
  if (!current) {
    throw new Error(`Data key "${oldKey}" not found.`)
  }

  const conflict = await client.getFile(newPath)
  if (conflict) {
    throw new Error(`Data key "${newKey}" already exists. Remove it first if you want to overwrite.`)
  }

  // Preserve the original content while moving to the new path.
  await client.putFile(newPath, current.content, `cp: rename ${oldKey} -> ${newKey}`)

  try {
    // Re-fetch the old file in case it was modified between the read and the put.
    const refreshed = await client.getFile(oldPath)
    const oldSha = refreshed?.sha ?? current.sha
    await client.deleteFile(oldPath, oldSha, `cp: rename ${oldKey} -> ${newKey}`)
  }
  catch (err) {
    throw new Error(
      `Renamed "${oldKey}" to "${newKey}", but failed to delete the old file: ${(err as Error).message}. `
      + `Both files now exist in the repo — run \`ix cp-config rm ${oldKey}\` to clean up.`
    )
  }

  // Move the cached entry (if any) so subsequent `cp <newKey>` calls hit the cache.
  renameCache(oldKey, newKey)
}
