import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { resolve } from 'node:path'

const RECENT_DIR = resolve(homedir(), '.initx', 'cp')
const RECENT_FILE = resolve(RECENT_DIR, 'recent.json')

interface RecentStore {
  order: string[]
}

function readStore(): RecentStore {
  if (!existsSync(RECENT_FILE))
    return { order: [] }
  try {
    const parsed = JSON.parse(readFileSync(RECENT_FILE, 'utf8')) as Partial<RecentStore>
    if (Array.isArray(parsed.order)) {
      return { order: parsed.order.filter((k): k is string => typeof k === 'string') }
    }
    return { order: [] }
  }
  catch {
    return { order: [] }
  }
}

function writeStore(store: RecentStore): void {
  if (!existsSync(RECENT_DIR)) {
    mkdirSync(RECENT_DIR, { recursive: true })
  }
  writeFileSync(RECENT_FILE, `${JSON.stringify(store, null, 2)}\n`, 'utf8')
}

export function loadRecent(): string[] {
  return readStore().order
}

/**
 * Push `key` to the front of the recent order.
 * If already present, removes the old entry first so it ends up at index 0.
 */
export function pushRecent(key: string): void {
  const store = readStore()
  const idx = store.order.indexOf(key)
  if (idx !== -1) {
    store.order.splice(idx, 1)
  }
  store.order.unshift(key)
  writeStore(store)
}

/**
 * Remove `key` from the recent order if present.
 */
export function removeRecent(key: string): void {
  const store = readStore()
  const idx = store.order.indexOf(key)
  if (idx === -1)
    return
  store.order.splice(idx, 1)
  writeStore(store)
}

/**
 * Replace `oldKey` with `newKey` in the recent order, preserving the position.
 * No-op when `oldKey` is not present.
 */
export function renameRecent(oldKey: string, newKey: string): void {
  const store = readStore()
  const idx = store.order.indexOf(oldKey)
  if (idx === -1)
    return
  store.order[idx] = newKey
  writeStore(store)
}
