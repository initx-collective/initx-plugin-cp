import os from 'node:os'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { resolve as pathResolve } from 'node:path'

import clipboard from 'clipboardy'

import { type InitxContext, InitxPlugin } from '@initx-plugin/core'
import { inquirer, log } from '@initx-plugin/utils'

import { CpType } from './types'

export default class CpPlugin extends InitxPlugin {
  matchers = [
    {
      matching: 'cp',
      description: 'Copy SSH public key'
    }
  ]

  async handle(_ctx: InitxContext, cpType: CpType, ...others: string[]) {
    if (!cpType || typeof this[cpType] !== 'function') {
      const typeList = CpType as Record<string, string>
      log.error(`Please enter the copy type, Available types: ${Object.keys(typeList).map(key => typeList[key])}`)
      return
    }

    ; (this[cpType] as (...args: string[]) => void)(...others)
  }

  async [CpType.SSH]() {
    const sshDir = pathResolve(os.homedir(), '.ssh')

    if (!existsSync(sshDir)) {
      log.error(`SSH directory not found, path: ${sshDir}`)
      return
    }

    const publicKeysName = readdirSync(sshDir).filter(file => file.endsWith('.pub'))

    if (publicKeysName.length === 0) {
      log.error('SSH key not found')
      return
    }

    let publicKeyName: string

    if (publicKeysName.length === 1) {
      const [firstKey] = publicKeysName
      publicKeyName = firstKey
    }
    else {
      const index = await inquirer.select('Select SSH key', publicKeysName)
      publicKeyName = publicKeysName[index]
    }

    const publicKeyPath = pathResolve(sshDir, publicKeyName)
    const publicKey = readFileSync(publicKeyPath, 'utf8')

    this.copy(publicKey)
    log.success('Key copied to clipboard')
  }

  private copy(content: string) {
    clipboard.writeSync(content)
  }
}
