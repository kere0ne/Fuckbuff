export type { FuckbuffSessionServerResponse } from '@codebuff/common/types/fuckbuff-session'

import type { FuckbuffSessionServerResponse } from '@codebuff/common/types/fuckbuff-session'

/**
 * CLI session shape. Most states are wire-level `/api/v1/freebuff/session`
 * responses; `takeover_prompt` asks before displacing a server-named holder
 * at capacity (or taking over the legacy single-session trial).
 */
export type FuckbuffSessionResponse =
  | FuckbuffSessionServerResponse
  | {
      status: 'takeover_prompt'
      model: string
      /** Only this server-named holder may be displaced on confirmation. */
      currentInstanceId?: string
      message?: string
    }

export type FuckbuffSessionStatus = FuckbuffSessionResponse['status']
