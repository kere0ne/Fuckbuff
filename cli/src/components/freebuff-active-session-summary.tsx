import React from 'react'
import { getFreebucksInfo } from '@codebuff/common/types/fuckbuff-session'
import { getFuckbuffModelMeter } from '@codebuff/common/util/fuckbuff-session-pools'

import { useFuckbuffSessionProgress } from '../hooks/use-fuckbuff-session-progress'
import { useNow } from '../hooks/use-now'
import { useTheme } from '../hooks/use-theme'
import { formatFuckbuffPremiumResetCountdown } from '../utils/fuckbuff-premium-reset'
import { formatSessionUnits } from '../utils/format-session-units'

import type { FuckbuffSessionResponse } from '../types/fuckbuff-session'

interface FuckbuffActiveSessionSummaryProps {
  session: FuckbuffSessionResponse | null
}

export const FuckbuffActiveSessionSummary: React.FC<
  FuckbuffActiveSessionSummaryProps
> = ({ session }) => {
  const theme = useTheme()
  const now = useNow(60_000, session?.status === 'active')
  const progress = useFuckbuffSessionProgress(session)
  if (session?.status !== 'active' || !progress) return null

  const { quota } = getFuckbuffModelMeter({
    model: session.model,
    freebucks: getFreebucksInfo(session),
    quota: session.rateLimit,
  })

  if (!quota) {
    return null
  }

  const resetCountdown = formatFuckbuffPremiumResetCountdown(
    new Date(quota.resetAt),
    now,
  )
  const label =
    'accessTier' in session && session.accessTier === 'limited'
      ? 'sessions'
      : 'premium sessions'
  // recentCount already includes the active session's 1.0-unit reservation
  // (written as an admit row at promotion), so it reflects everything counted
  // against the quota — spent plus in-flight. Show it as the total used to match
  // the model selection menu and the other session-status screens.
  return (
    <box
      style={{
        paddingLeft: 1,
        paddingRight: 1,
        marginBottom: 1,
        flexShrink: 0,
      }}
    >
      <text style={{ wrapMode: 'word', fg: theme.muted }}>
        <span fg={theme.foreground}>
          {formatSessionUnits(quota.recentCount)} of {quota.limit}
        </span>
        <span fg={theme.muted}>
          {' '}
          {label} used · resets in {resetCountdown}
        </span>
      </text>
    </box>
  )
}
