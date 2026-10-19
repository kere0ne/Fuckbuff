import { FUCKBUFF_WEB_URL_PROD } from '@codebuff/common/constants/hosts'
import { env, IS_DEV } from '@codebuff/common/env'

import { IS_FUCKBUFF } from '../utils/constants'
import { FUCKBUFF_WORDMARK, FUCKBUFF_WORDMARK_COMPACT } from '../utils/fuckbuff-wordmark'

// Get the website URL from environment or use default
export const WEBSITE_URL = env.NEXT_PUBLIC_CODEBUFF_APP_URL

/**
 * The fuckbuff web app, which is where the login flow goes instead of
 * codebuff.com -- and, since COD-376, where the sponsored-proposal REST front
 * lives too.
 *
 * EXPORTED so that second caller resolves the host the same way. It read
 * `process.env.NEXT_PUBLIC_FUCKBUFF_APP_URL` directly, which skips both halves
 * of what this constant does: the `@codebuff/common/env` schema (so a typo or
 * an unset variable falls back silently rather than being caught at import),
 * and the `IS_DEV` branch (so a developer's proposal calls left the laptop and
 * hit production while every other CLI call stayed local).
 */
export const FUCKBUFF_WEB_URL = IS_DEV
  ? 'http://localhost:3002'
  : (env.NEXT_PUBLIC_FUCKBUFF_APP_URL ?? FUCKBUFF_WEB_URL_PROD)
export const LOGIN_WEBSITE_URL = IS_FUCKBUFF ? FUCKBUFF_WEB_URL : WEBSITE_URL

// Codebuff ASCII Logo - compact version for 80-width terminals
const LOGO_CODEBUFF = `
  ██████╗ ██████╗ ██████╗ ███████╗██████╗ ██╗   ██╗███████╗███████╗
 ██╔════╝██╔═══██╗██╔══██╗██╔════╝██╔══██╗██║   ██║██╔════╝██╔════╝
 ██║     ██║   ██║██║  ██║█████╗  ██████╔╝██║   ██║█████╗  █████╗
 ██║     ██║   ██║██║  ██║██╔══╝  ██╔══██╗██║   ██║██╔══╝  ██╔══╝
 ╚██████╗╚██████╔╝██████╔╝███████╗██████╔╝╚██████╔╝██║     ██║
  ╚═════╝ ╚═════╝ ╚═════╝ ╚══════╝╚═════╝  ╚═════╝ ╚═╝     ╚═╝
`

const LOGO_SMALL_CODEBUFF = `
  ██████╗ ██████╗
 ██╔════╝ ██╔══██╗
 ██║      ██████╔╝
 ██║      ██╔══██╗
 ╚██████╗ ██████╔╝
  ╚═════╝ ╚═════╝
`

export const LOGO = IS_FUCKBUFF ? FUCKBUFF_WORDMARK : LOGO_CODEBUFF
export const LOGO_SMALL = IS_FUCKBUFF ? FUCKBUFF_WORDMARK_COMPACT : LOGO_SMALL_CODEBUFF

// Shadow/border characters that receive the sheen animation effect
export const SHADOW_CHARS = new Set([
  '╚',
  '═',
  '╝',
  '║',
  '╔',
  '╗',
  '╠',
  '╣',
  '╦',
  '╩',
  '╬',
])

// Sheen animation constants
export const SHEEN_STEP = 2 // Advance 2 positions per frame for efficiency
export const SHEEN_INTERVAL_MS = 150
