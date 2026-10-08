export enum CpType {
  SSH = 'ssh',
  GPG = 'gpg',
  CWD = 'cwd'
}

export enum CpConfigCommand {
  SET = 'set',
  GET = 'get',
  LIST = 'list',
  LS = 'ls',
  RM = 'rm',
  RENAME = 'rename',
  STATUS = 'status',
  SETUP = 'setup',
  HELP = 'help'
}

/**
 * Reserved keys for plugin configuration.
 * Anything else is treated as a data key.
 */
export const CP_RESERVED_CONFIG_KEYS = ['repo', 'token', 'branch', 'path'] as const

export type CpReservedConfigKey = typeof CP_RESERVED_CONFIG_KEYS[number]
