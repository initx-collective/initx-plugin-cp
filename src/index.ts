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

  async handle(ctx: InitxContext, ...args: (string | undefined)[]): Promise<void> {
    // The initx matcher forwards a bare `undefined` when the rule is invoked with no
    // positional args (e.g. `ix cp`). Drop those before deciding what to run.
    const realArgs = args.filter((arg): arg is string => typeof arg === 'string')

    if (ctx.key === 'cp-config') {
      await handleConfigCommand(realArgs)
      return
    }
    if (realArgs.length === 0) {
      await runList()
      return
    }
    await handleCopy(realArgs)
  }
}
