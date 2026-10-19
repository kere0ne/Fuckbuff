import { FUCKBUFF_ENABLE_STREAK_IN_UI } from '@codebuff/common/constants/fuckbuff-models'
import {
  getReferralInfo,
  getGlmPromo,
  getSubscriptionInfo,
  getFreeWindowsInfo,
} from '@codebuff/common/types/fuckbuff-session'
import {
  fuckbuffPlanSummary,
  fuckbuffFreeWindowsSummary,
  formatPlanWindows,
} from '@codebuff/common/util/fuckbuff-plan-summary'

import { FuckbuffPausedPlanNotice } from './fuckbuff-paused-plan-notice'
import { FuckbuffReferralBanner } from './fuckbuff-referral-banner'
import {
  FUCKBUFF_WORDMARK,
  FUCKBUFF_WORDMARK_COMPACT,
} from '../utils/fuckbuff-wordmark'
import { useTheme } from '../hooks/use-theme'
import { useTerminalDimensions } from '../hooks/use-terminal-dimensions'
import { useFuckbuffStreakQuery } from '../hooks/use-fuckbuff-streak-query'
import { useFuckbuffModelDirectory } from '../state/fuckbuff-catalog-store'
import { useFuckbuffModelStore } from '../state/fuckbuff-model-store'
import {
  useFuckbuffChatStore,
  selectFuckbuffChatModel,
} from '../state/fuckbuff-chat-store'
import { formatHours } from '@codebuff/common/util/fuckbuff-hours'
import { freebucksOf, freebucksRefundLine } from '../utils/freebucks'
import { getFuckbuffStreakBonusNoteForLayout } from '../utils/fuckbuff-streak-line'
import { getFuckbuffModelAvailabilityNotice } from '@codebuff/common/util/fuckbuff-model-availability'
import type { FuckbuffSessionResponse } from '../types/fuckbuff-session'

const ignoreFocusTargets = () => {}

const wordmarkVariants = [FUCKBUFF_WORDMARK, FUCKBUFF_WORDMARK_COMPACT].map(
  (text) => ({
    text,
    width: Math.max(...text.split('\n').map((line) => line.length)),
  }),
)

export function FuckbuffChatHeader({
  session,
  lastRefund = null,
  refundPending = false,
}: {
  projectRoot: string
  session: FuckbuffSessionResponse | null
  /** The ended hour's receipt, from `useFuckbuffSession`. */
  lastRefund?: number | null
  refundPending?: boolean
}) {
  const theme = useTheme()
  const { terminalWidth, terminalHeight } = useTerminalDimensions()
  const selected = useFuckbuffModelStore((s) => s.selectedModel)
  const nextModel = useFuckbuffChatStore((s) => s.nextModel)
  const directory = useFuckbuffModelDirectory()
  const model = directory.get(nextModel ?? selected)
  const freebucks = freebucksOf(session)
  // The session store clears the receipt the moment a new session goes
  // active, so this only ever describes the hour just finished.
  const refund = freebucksRefundLine(lastRefund, refundPending)
  const plan = fuckbuffPlanSummary(getSubscriptionInfo(session))
  const windows = fuckbuffFreeWindowsSummary(getFreeWindowsInfo(session))
  const streak = useFuckbuffStreakQuery({
    enabled: FUCKBUFF_ENABLE_STREAK_IN_UI,
  })
  const width = Math.max(16, Math.min(68, terminalWidth - 5))
  // Use the panel's padded width budget so the wordmark stays whole on resize.
  const wordmark =
    wordmarkVariants.find((variant) => variant.width <= width)?.text ?? 'Fuckbuff'
  const tier =
    session && 'accessTier' in session ? (session.accessTier ?? 'full') : 'full'
  const referral = getReferralInfo(session)
  const availability =
    freebucks === undefined
      ? getFuckbuffModelAvailabilityNotice(
          session && 'countryBlockReason' in session ? session : null,
        )
      : ''
  const streakBonus = getFuckbuffStreakBonusNoteForLayout({
    streak: streak.data?.streak ?? 0,
    accessTier: tier,
    freebucksDailyBonus: streak.data?.freebucksDailyBonus,
    terminalHeight,
    availableWidth: width - 4,
  })
  return (
    <box
      style={{
        flexDirection: 'column',
        alignItems: 'flex-start',
        width: '100%',
        marginBottom: 1,
      }}
    >
      <text style={{ fg: theme.foreground, wrapMode: 'none', marginBottom: 1 }}>
        {wordmark}
      </text>
      <box
        style={{
          width,
          border: true,
          borderColor: theme.border,
          paddingLeft: 1,
          paddingRight: 1,
          flexDirection: 'column',
        }}
      >
        <FuckbuffPausedPlanNotice session={session} />
        {model.warning && (
          <text style={{ fg: theme.secondary, wrapMode: 'word' }}>
            {model.warning}
          </text>
        )}
        <text style={{ fg: theme.muted, wrapMode: 'word' }}>
          {session?.status === 'active'
            ? session.model === model.id
              ? 'Session active'
              : `Next message switches from ${directory.get(session.model).displayName}.`
            : 'Your first message starts the session.'}
        </text>
        {freebucks && (
          <text style={{ fg: theme.foreground, wrapMode: 'word' }}>
            {`${formatHours(freebucks.daily.remaining)}/${formatHours(freebucks.daily.limit)} hours remaining`}
          </text>
        )}
        {freebucks === null && (
          <text style={{ fg: theme.secondary }}>Balance unavailable</text>
        )}
        {refund && (
          <text style={{ fg: theme.secondary, wrapMode: 'word' }}>
            {refund}
          </text>
        )}
        {plan && (
          <text style={{ fg: theme.muted, wrapMode: 'word' }}>
            {freebucks === undefined
              ? `${plan.tierName} plan · ${formatPlanWindows(plan)}`
              : `${plan.tierName} plan`}
          </text>
        )}
        {freebucks === undefined && windows && (
          <text style={{ fg: theme.muted, wrapMode: 'word' }}>
            {windows.windows
              .map((w) => `${w.label} ${w.used} of ${w.limit}`)
              .join(' · ')}
          </text>
        )}
        {availability && (
          <text style={{ fg: theme.muted, wrapMode: 'word' }}>
            {availability}
          </text>
        )}
        {FUCKBUFF_ENABLE_STREAK_IN_UI && Boolean(streak.data?.streak) && (
          <text
            style={{ fg: theme.primary }}
          >{`${streak.data!.streak} day streak`}</text>
        )}
        {streakBonus && (
          <text style={{ fg: theme.muted, wrapMode: 'word' }}>
            {streakBonus}
          </text>
        )}
        {referral && (
          <FuckbuffReferralBanner
            width={width - 4}
            referral={referral}
            glmPromo={getGlmPromo(session)}
            accessTier={tier}
            metered={freebucks !== undefined}
            focusedId=""
            onFocusTargetsChange={ignoreFocusTargets}
            onSelectModel={selectFuckbuffChatModel}
          />
        )}
      </box>
    </box>
  )
}
