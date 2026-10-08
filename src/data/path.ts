import { validateKey } from './validate'

export function dataPath(key: string, basePath: string): string {
  validateKey(key)
  return `${basePath}/${key}`
}
