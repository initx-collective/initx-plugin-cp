import { existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { resolve } from 'node:path'

const CACHE_DIR = resolve(homedir(), '.initx', 'cp', 'cache')

export interface CacheEntry {
  content: string
  sha: string
  fetchedAt: number
}

export function ensureCacheDir(): void {
  if (!existsSync(CACHE_DIR)) {
    mkdirSync(CACHE_DIR, { recursive: true })
  }
}

export function cacheFilePath(encodedKey: string): string {
  return resolve(CACHE_DIR, encodedKey)
}

export function readCache(encodedKey: string): CacheEntry | null {
  const file = cacheFilePath(encodedKey)
  if (!existsSync(file))
    return null
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as CacheEntry
  }
  catch {
    return null
  }
}

export function writeCache(encodedKey: string, content: string, sha: string): CacheEntry {
  ensureCacheDir()
  const entry: CacheEntry = { content, sha, fetchedAt: Date.now() }
  writeFileSync(cacheFilePath(encodedKey), JSON.stringify(entry), 'utf8')
  return entry
}

export function removeCache(encodedKey: string): void {
  const file = cacheFilePath(encodedKey)
  if (existsSync(file)) {
    unlinkSync(file)
  }
}

export function clearAllCache(): void {
  if (!existsSync(CACHE_DIR))
    return
  for (const name of readdirSync(CACHE_DIR)) {
    try {
      unlinkSync(resolve(CACHE_DIR, name))
    }
    catch {
      // ignore individual failures
    }
  }
}
