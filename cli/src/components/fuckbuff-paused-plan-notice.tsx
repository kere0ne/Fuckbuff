import { fuckbuffSubscriptionTier } from '@codebuff/common/constants/fuckbuff-subscriptions'
import { getSubscriptionInfo } from '@codebuff/common/types/fuckbuff-session'

import { TerminalLink } from './terminal-link'
import { useTheme } from '../hooks/use-theme'
import { safeOpen } from '../utils/open-url'

import type { FuckbuffSessionResponse } from '../types/fuckbuff-session'

/** The account page's subscription tab, where Pay now settles the open invoice. */
export const FUCKBUFF_SUBSCRIPTION_ACCOUNT_URL =
  'https://freebuff.com/account?tab=subscription'

/**
 * The sentence for a plan the server paused because its renewal payment
 * failed, or null when nothing is paused. Absent `paymentFailedTierId` (paid,
 * cancelled, or a server older than the field) means no notice.
 */
export function fuckbuffPausedPlanMessage(
  session: FuckbuffSessionResponse | null,
): string | null {
  const tierId = getSubscriptionInfo(session)?.paymentFailedTierId
  if (!tierId) return null
  const name = fuckbuffSubscriptionTier(tierId)?.displayName ?? tierId
  return `Your ${name} plan is paused: the renewal payment failed.`
}

/**
 * Shown in the launch panel on every launch while the plan stays paused, and
 * deliberately not dismissible: it goes away once the invoice is paid.
 */
export function FuckbuffPausedPlanNotice({
  session,
}: {
  session: FuckbuffSessionResponse | null
}) {
  const theme = useTheme()
  const message = fuckbuffPausedPlanMessage(session)
  if (!message) return null
  return (
    <box style={{ flexDirection: 'column' }}>
      <text style={{ fg: theme.warning, wrapMode: 'word' }}>{message}</text>
      <box style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        <text style={{ fg: theme.foreground }}>Update your card at </text>
        <TerminalLink
          text={FUCKBUFF_SUBSCRIPTION_ACCOUNT_URL}
          onActivate={() => safeOpen(FUCKBUFF_SUBSCRIPTION_ACCOUNT_URL)}
          underlineOnHover={true}
          lineWrap={true}
          containerStyle={{ width: 'auto', flexShrink: 1 }}
        />
      </box>
    </box>
  )
}
