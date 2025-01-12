import { existsSync, readdirSync, readFileSync } from 'node:fs'
import os from 'node:os'
import { resolve as pathResolve } from 'node:path'
import { cwd } from 'node:process'

import { type InitxContext, InitxPlugin } from '@initx-plugin/core'
import { c, gpgList, inquirer, log } from '@initx-plugin/utils'

import clipboard from 'clipboardy'

import { CpType } from './types'

export default class CpPlugin extends InitxPlugin {
  rules = [
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

  async [CpType.GPG]() {
    const list = await gpgList()

    if (list.length === 0) {
      log.error('No GPG keys found')
      return
    }

    let index = 0

    if (list.length > 1) {
      index = await inquirer.select('Select GPG key', list.map(({ key, name, email }) => `${key} - ${name} <${email}>`))
    }

    const { key } = list[index]

    const result = await c('gpg', ['--armor', '--export', key])

    this.copy(result.content)
    log.success('GPG public key copied to clipboard')
  }

  async [CpType.CWD]() {
    this.copy(cwd())
    log.success('Current working directory copied to clipboard')
  }

  private copy(content: string) {
    clipboard.writeSync(content)
  }
}
