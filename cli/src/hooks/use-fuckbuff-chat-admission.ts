import { useEffect, useRef } from 'react'
import { formatHoursWithUnit } from '@codebuff/common/util/fuckbuff-hours'
import { formatFuckbuffHardBlockedPrivacySignals } from '@codebuff/common/util/fuckbuff-privacy'

import {
  resolveFuckbuffModelPickForSession,
  refreshFuckbuffSessionMetadata,
  startFuckbuffSession,
} from './use-fuckbuff-session'
import {
  useFuckbuffChatStore,
  type ChatAdmission,
} from '../state/fuckbuff-chat-store'
import { getFuckbuffModelDirectory } from '../state/fuckbuff-catalog-store'
import { useFuckbuffModelStore } from '../state/fuckbuff-model-store'
import { useFuckbuffSessionStore } from '../state/fuckbuff-session-store'
import { freebucksOf, freebucksRowIntent } from '../utils/freebucks'
import type { FuckbuffSessionResponse } from '../types/fuckbuff-session'
import type { StreamStatus } from './use-message-queue'

export function fuckbuffAdmissionNotice(
  session: FuckbuffSessionResponse | null,
): string | null {
  if (!session) return null
  switch (session.status) {
    case 'banned':
      return 'This account is suspended. To appeal, visit https://freebuff.com/account?tab=standing. If this is a mistake, contact support@freebuff.com.'
    case 'country_blocked':
      return session.countryBlockReason === 'anonymous_network'
        ? `Fuckbuff detected ${formatFuckbuffHardBlockedPrivacySignals(session.ipPrivacySignals)} traffic. Disable VPN, proxy or Tor traffic and try again.`
        : session.countryCode === 'UNKNOWN'
          ? 'Fuckbuff could not verify your location. Check your VPN or proxy settings and try again.'
          : `Fuckbuff is unavailable in ${session.countryCode}. Use /byok to use your own API key.`
    case 'rate_limited':
      return session.freebucksShortfall
        ? `Not enough hours: ${formatHoursWithUnit(session.freebucksShortfall.balance)} available. See https://freebuff.com/plans or use /model.`
        : 'Session limit reached. See https://freebuff.com/plans or choose another model with /model.'
    case 'spend_limited':
      return session.message
    case 'ip_capped':
      return 'Too many Fuckbuff sessions on this network. Try again after another session finishes.'
    case 'superseded':
      return 'This session was taken over elsewhere. Send again to start a new session.'
    default:
      return null
  }
}

/** Identity-check every continuation: a cancelled send must never restart itself. */
export async function beginFuckbuffChatAdmission(admission: ChatAdmission) {
  if (useFuckbuffChatStore.getState().admission !== admission) return
  if (admission.phase === 'confirm') {
    const intentFor = (session: FuckbuffSessionResponse | null | undefined) =>
      freebucksRowIntent(
        freebucksOf(session),
        admission.model,
        session?.status === 'active' ? session.model : undefined,
      )
    // A price/balance change must update the question before its answer can
    // authorize spending. This re-check is the only guard: the server takes
    // no wallet ceiling, so a stale answer would spend unasked.
    if (
      JSON.stringify(intentFor(admission.previousSession)) !==
      JSON.stringify(intentFor(useFuckbuffSessionStore.getState().session))
    ) {
      useFuckbuffChatStore.setState({
        admission: { phase: 'requested', model: admission.model },
      })
      return
    }
  }
  const starting: ChatAdmission = {
    ...admission,
    phase: 'starting',
    message: undefined,
    previousSession: useFuckbuffSessionStore.getState().session,
  }
  useFuckbuffSessionStore.getState().setFailure(null)
  useFuckbuffChatStore.setState({ admission: starting })
  try {
    await startFuckbuffSession(starting.model, {
      preserveQueue: true,
      persistSelection: false,
    })
  } catch (error) {
    if (useFuckbuffChatStore.getState().admission !== starting) return
    useFuckbuffChatStore.setState({
      admission: {
        ...starting,
        phase: 'failed',
        message: error instanceof Error ? error.message : String(error),
      },
    })
  }
}

/**
 * Admission buys an hour for the queue to spend, so it waits until the queue
 * can spend it. A user-paused queue sends nothing: admitting for one bought
 * an hour no turn started, which the server refunds after five minutes.
 */
export function fuckbuffChatAdmissionMayStart(queue: {
  chainInProgress: boolean
  streamStatus: StreamStatus
  queuedCount: number
  queuePaused: boolean
}): boolean {
  return (
    !queue.chainInProgress &&
    queue.streamStatus === 'idle' &&
    queue.queuedCount > 0 &&
    !queue.queuePaused
  )
}

/** Shown while a requested admission waits on a paused queue. */
export const FUCKBUFF_ADMISSION_QUEUE_PAUSED_MESSAGE =
  'Your queue is paused, so no session was started. Press Esc to put your message back in the draft and send it when you are ready.'

/** The queue holds the submitted text and attachments while admission runs. */
export function useFuckbuffChatAdmission(enabled: boolean) {
  const checking = useRef<ChatAdmission | null>(null)
  const admission = useFuckbuffChatStore((s) => s.admission)
  const session = useFuckbuffSessionStore((s) => s.session)
  const failure = useFuckbuffSessionStore((s) => s.failure)

  useEffect(() => {
    if (!enabled || !admission) return
    if (admission.phase === 'starting') {
      if (failure && !failure.retry) {
        useFuckbuffChatStore.setState({
          admission: {
            ...admission,
            phase: 'failed',
            message: failure.message,
          },
        })
      } else if (session === admission.previousSession) {
        return
      } else if (session?.status === 'active') {
        useFuckbuffChatStore.setState({ admission: null, nextModel: null })
      } else {
        const message = fuckbuffAdmissionNotice(session)
        if (message)
          useFuckbuffChatStore.setState({
            admission: { ...admission, phase: 'failed', message },
          })
      }
      return
    }
    if (admission.phase !== 'requested') return
    if (!session) {
      if (failure && !failure.retry)
        useFuckbuffChatStore.setState({
          admission: {
            ...admission,
            phase: 'failed',
            message: failure.message,
          },
        })
      return
    }
    if (!admission.metadataChecked) {
      if (checking.current === admission) return
      checking.current = admission
      void refreshFuckbuffSessionMetadata()
        .then(() => {
          if (useFuckbuffChatStore.getState().admission === admission)
            useFuckbuffChatStore.setState({
              admission: { ...admission, metadataChecked: true },
            })
        })
        .catch((error) => {
          if (useFuckbuffChatStore.getState().admission === admission)
            useFuckbuffChatStore.setState({
              admission: {
                ...admission,
                phase: 'failed',
                message: error instanceof Error ? error.message : String(error),
              },
            })
        })
      return
    }
    if (session.status === 'banned' || session.status === 'country_blocked') {
      useFuckbuffChatStore.setState({
        admission: {
          ...admission,
          phase: 'failed',
          message: fuckbuffAdmissionNotice(session)!,
        },
      })
      return
    }
    // A send before the first session response captured the launch seed.
    const { hasExplicitPick, selectedModel } = useFuckbuffModelStore.getState()
    const model = resolveFuckbuffModelPickForSession(
      hasExplicitPick ? admission.model : selectedModel,
      session,
    )
    const freebucks = freebucksOf(session)
    const intent = freebucksRowIntent(
      freebucks,
      model,
      session.status === 'active' ? session.model : undefined,
    )
    const resolved = { ...admission, model }
    if (intent.kind === 'paywall') {
      useFuckbuffChatStore.setState({
        admission: {
          ...resolved,
          phase: 'failed',
          message: `Not enough hours for ${getFuckbuffModelDirectory().get(model).displayName}: an hour on it takes ${formatHoursWithUnit(intent.price)}. Choose another model with /model or visit https://freebuff.com/plans.`,
        },
      })
    } else if (
      intent.kind === 'confirm' ||
      // Full access is never asked, not even to end the live session.
      (!freebucks?.spendWithoutAsking &&
        session.status === 'active' &&
        session.model !== model)
    ) {
      const cost =
        intent.price === undefined
          ? freebucksOf(session) === null
            ? 'may spend wallet hours'
            : 'starts a new session'
          : `takes ${formatHoursWithUnit(intent.price)} from your balance`
      const wallet =
        intent.kind === 'confirm' && intent.walletSpend
          ? ` Uses ${formatHoursWithUnit(intent.walletSpend)} from your wallet.`
          : ''
      useFuckbuffChatStore.setState({
        admission: {
          ...resolved,
          phase: 'confirm',
          previousSession: session,
          message: `${getFuckbuffModelDirectory().get(model).displayName} ${cost}.${wallet}${session.status === 'active' ? ' This ends your current model session; your conversation is kept.' : ''}${intent.kind === 'confirm' && 'claimEarned' in intent && intent.claimEarned ? ' Earned hours will be claimed on admission.' : ''}`,
        },
      })
    } else {
      // Keep the exact object used by the asynchronous admission continuation.
      useFuckbuffChatStore.setState({ admission: resolved })
      void beginFuckbuffChatAdmission(resolved)
    }
  }, [enabled, admission, session, failure])
}
