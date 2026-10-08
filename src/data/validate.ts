/**
 * Validate a data key for use as a filename on GitHub.
 * Throws an Error with a helpful message when the key is invalid.
 */
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

function hasControlChars(str: string): boolean {
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i)
    if (code < 0x20 || code === 0x7F) {
      return true
    }
  }
  return false
}
