import { AnalyticsEvent } from '@codebuff/common/constants/analytics-events'
import { randomUUID } from 'node:crypto'
import { cyan, green, red, yellow, bold } from 'picocolors'

import { LOGIN_WEBSITE_URL } from './constants'
import {
  DISCORD_AFTER_LOGIN_TEXT,
  FUCKBUFF_DISCORD_INVITE_URL,
} from './discord-invite'
import { generateLoginUrl, pollLoginStatus } from './login-flow'
import { flushAnalytics, identifyUser, trackEvent } from '../utils/analytics'
import { saveUserCredentials } from '../utils/auth'
import { IS_FUCKBUFF } from '../utils/constants'
import { getFingerprintId } from '../utils/fingerprint'
import { logger } from '../utils/logger'

import type { User } from '../utils/auth'

/**
 * Plain-text login flow that runs outside the TUI.
 * Prints the login URL as plain text so the user can select and copy it
 * using normal terminal text selection (Cmd+C / Ctrl+Shift+C).
 *
 * This is the escape hatch for remote/SSH environments where the TUI's
 * clipboard and browser integration don't work.
 */
export async function runPlainLogin(): Promise<void> {
  const fingerprintId = await getFingerprintId()

  console.log()
  console.log(bold(IS_FUCKBUFF ? 'Fuckbuff Login' : 'Codebuff Login'))
  console.log()
  console.log('Generating login URL...')

  let loginData
  try {
    loginData = await generateLoginUrl(
      { logger, trackEvent },
      {
        baseUrl: LOGIN_WEBSITE_URL,
        fingerprintId,
        via: 'plain_command',
        cliFlowId: IS_FUCKBUFF ? randomUUID() : undefined,
      },
    )
  } catch (error) {
    console.error(
      red(
        `Failed to generate login URL: ${
          error instanceof Error ? error.message : String(error)
        }`,
      ),
    )
    process.exit(1)
  }

  console.log()
  console.log('Open this URL in your browser to log in:')
  console.log()
  console.log(cyan(loginData.loginUrl))
  console.log()
  console.log(yellow('Please open the URL above manually to complete login.'))
  console.log()
  console.log('Waiting for login...')

  const sleep = (ms: number) =>
    new Promise<void>((resolve) => {
      setTimeout(resolve, ms)
    })

  const result = await pollLoginStatus(
    { sleep, logger, trackEvent },
    {
      baseUrl: LOGIN_WEBSITE_URL,
      fingerprintId,
      fingerprintHash: loginData.fingerprintHash,
      expiresAt: loginData.expiresAt,
      via: 'plain_command',
    },
  )

  if (result.status === 'success') {
    const user = result.user as User
    saveUserCredentials(user)

    // This flow runs outside the TUI and exits immediately, so the React-based
    // login tracking never runs. Identify + track here (tagged `via`) so these
    // logins aren't missing from the funnel, then flush before exiting since
    // process.exit would otherwise drop the buffered PostHog events.
    if (user.id) {
      identifyUser(user.id, { email: user.email, fuckbuff: IS_FUCKBUFF })
      trackEvent(AnalyticsEvent.LOGIN, {
        userId: user.id,
        via: 'plain_command',
        hasEmail: Boolean(user.email),
        hasName: Boolean(user.name),
      })
      await flushAnalytics()
    }

    console.log()
    console.log(
      green(
        user.name
          ? `✓ Logged in as ${user.name} (${user.email})`
          : `✓ Logged in as ${user.email}`,
      ),
    )
    console.log()
    const cliName = IS_FUCKBUFF ? 'fuckbuff' : 'codebuff'
    console.log('You can now run ' + cyan(cliName) + ' to start.')
    if (IS_FUCKBUFF) {
      console.log(
        DISCORD_AFTER_LOGIN_TEXT + ' ' + cyan(FUCKBUFF_DISCORD_INVITE_URL),
      )
    }
    process.exit(0)
  } else if (result.status === 'timeout') {
    console.error(red('Login timed out. Please try again.'))
    process.exit(1)
  } else {
    console.error(red('Login was aborted.'))
    process.exit(1)
  }
}
