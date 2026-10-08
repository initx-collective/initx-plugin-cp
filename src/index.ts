import type { InitxContext, InitxMatcherRules } from '@initx-plugin/core'
import { InitxPlugin } from '@initx-plugin/core'

import { handleCopy, runList } from './commands/cp'
import { handleConfigCommand } from './commands/cp-config'

export default class CpPlugin extends InitxPlugin {
  rules: InitxMatcherRules = [
    {
      matching: 'cp',
      description: 'Copy SSH / GPG / CWD / data key to clipboard (interactive picker when no key given)'
    },
    {
      matching: 'cp-config',
      description: 'Configure cp plugin (repo, token, branch, path) and data keys'
    }
  ]

  async handle(ctx: InitxContext, ...args: string[]): Promise<void> {
    if (ctx.key === 'cp-config') {
      await handleConfigCommand(args)
      return
    }
    if (args.length === 0) {
      await runList()
      return
    }
    await handleCopy(args)
  }
}
