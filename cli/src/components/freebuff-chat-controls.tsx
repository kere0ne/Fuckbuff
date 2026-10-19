import { useKeyboard } from '@opentui/react'
import { useCallback, useEffect } from 'react'

import { Button } from './button'
import { FuckbuffModelSelector } from './fuckbuff-model-selector'
import { useTheme } from '../hooks/use-theme'
import { useTerminalDimensions } from '../hooks/use-terminal-dimensions'
import {
  beginFuckbuffChatAdmission,
  FUCKBUFF_ADMISSION_QUEUE_PAUSED_MESSAGE,
} from '../hooks/use-fuckbuff-chat-admission'
import {
  returnToFuckbuffLanding,
  refreshFuckbuffSessionMetadata,
  takeOverFuckbuffSession,
} from '../hooks/use-fuckbuff-session'
import { useChatRuntime } from '../contexts/chat-runtime-context'
import { useChatStore } from '../state/chat-store'
import { useFuckbuffModelStore } from '../state/fuckbuff-model-store'
import { useFuckbuffSessionStore } from '../state/fuckbuff-session-store'
import {
  useFuckbuffChatStore,
  selectFuckbuffChatModel,
  requestFuckbuffChatAdmission,
} from '../state/fuckbuff-chat-store'
import { isPlainEnterKey } from '../utils/terminal-enter-detection'

export function FuckbuffChatControls() {
  const theme = useTheme()
  const { terminalHeight } = useTerminalDimensions()
  const pickerOpen = useFuckbuffChatStore((s) => s.pickerOpen)
  const pickerInitialView = useFuckbuffChatStore((s) => s.pickerInitialView)
  const admission = useFuckbuffChatStore((s) => s.admission)
  const nextModel = useFuckbuffChatStore((s) => s.nextModel)
  const model = useFuckbuffModelStore((s) => s.selectedModel)
  const session = useFuckbuffSessionStore((s) => s.session)
  const { clearQueue, queuePaused } = useChatRuntime()
  useEffect(() => {
    if (pickerOpen) void refreshFuckbuffSessionMetadata().catch(() => {})
  }, [pickerOpen])

  const cancel = useCallback(async () => {
    if (pickerOpen) {
      useFuckbuffChatStore.setState({ pickerOpen: false })
      return
    }
    const current = useFuckbuffChatStore.getState().admission
    if (!current) return
    // Abort/release an in-flight claim before returning to the composer. The
    // queue remains held until DELETE confirms, including a lost POST reply.
    if (
      current.phase === 'starting' ||
      (current.phase === 'failed' &&
        current.previousSession !== undefined &&
        useFuckbuffSessionStore.getState().pendingAdmission)
    ) {
      try {
        await returnToFuckbuffLanding({ preserveQueue: true })
      } catch {
        return
      }
    }
    const queued = clearQueue()
    const chat = useChatStore.getState()
    const text = [...queued.map((m) => m.content), chat.inputValue]
      .filter(Boolean)
      .join('\n\n')
    useChatStore.setState((s) => {
      s.pendingAttachments = [
        ...queued.flatMap((m) => m.attachments),
        ...s.pendingAttachments,
      ]
    })
    chat.setInputValue({
      text,
      cursorPosition: text.length,
      lastEditDueToNav: false,
    })
    useFuckbuffChatStore.setState({ admission: null })
  }, [pickerOpen, clearQueue])

  const confirm = useCallback(() => {
    if (!admission) return
    if (session?.status === 'takeover_prompt') {
      void takeOverFuckbuffSession()
    } else if (admission.phase === 'confirm') {
      void beginFuckbuffChatAdmission(admission)
    } else if (admission.phase === 'failed') {
      requestFuckbuffChatAdmission()
    }
  }, [admission, session])

  useKeyboard(
    useCallback(
      (key) => {
        if ((!pickerOpen && key.name === 'escape') || (key.ctrl && key.name === 'c')) {
          key.preventDefault?.()
          key.stopPropagation?.()
          void cancel()
        } else if (!pickerOpen && isPlainEnterKey(key)) {
          key.preventDefault?.()
          key.stopPropagation?.()
          confirm()
        }
      },
      [cancel, confirm, pickerOpen],
    ),
  )

  if (pickerOpen)
    return (
      <box style={{ flexDirection: 'column', paddingLeft: 1, paddingRight: 1 }}>
        <text style={{ fg: theme.foreground }}>
          ↑↓ choose model · Tab reasoning · Enter select · Esc cancel
        </text>
        <FuckbuffModelSelector
          maxHeight={Math.max(4, Math.floor(terminalHeight * 0.65) - 2)}
          selectedModelOverride={nextModel ?? model}
          initialView={pickerInitialView}
          onSelectModel={selectFuckbuffChatModel}
          onCancel={() => useFuckbuffChatStore.setState({ pickerOpen: false })}
        />
      </box>
    )
  if (!admission) return null
  const takeover = session?.status === 'takeover_prompt'
  const canConfirm =
    takeover || admission.phase === 'confirm' || admission.phase === 'failed'
  return (
    <box
      style={{
        border: true,
        borderColor: theme.border,
        paddingLeft: 1,
        paddingRight: 1,
        flexDirection: 'column',
      }}
    >
      <text style={{ fg: theme.foreground, wrapMode: 'word' }}>
        {takeover
          ? (session.message ??
            'Fuckbuff is already running elsewhere. Take over that session?')
          : (admission.message ??
            (admission.phase === 'requested' && queuePaused
              ? FUCKBUFF_ADMISSION_QUEUE_PAUSED_MESSAGE
              : 'Starting your model session… Your message is saved.'))}
      </text>
      <box style={{ flexDirection: 'row', gap: 2 }}>
        {canConfirm && (
          <Button onClick={confirm}>
            <text style={{ fg: theme.primary }}>
              {takeover
                ? 'Enter: take over'
                : admission.phase === 'failed'
                  ? 'Enter: retry'
                  : 'Enter: confirm and send'}
            </text>
          </Button>
        )}
        <Button
          onClick={() => {
            void cancel()
          }}
        >
          <text style={{ fg: theme.muted }}>Esc: back to draft</text>
        </Button>
      </box>
    </box>
  )
}
