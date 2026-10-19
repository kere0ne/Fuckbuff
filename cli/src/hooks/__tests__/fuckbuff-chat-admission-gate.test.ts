import {
  FUCKBUFF_DEEPSEEK_V4_FLASH_MODEL_ID,
  FUCKBUFF_MIMO_V25_MODEL_ID,
} from '@codebuff/common/constants/fuckbuff-models'
import { createTestRenderer } from '@opentui/core/testing'
import { createRoot, flushSync } from '@opentui/react'
import { describe, expect, test } from 'bun:test'
import React from 'react'

import { useFuckbuffChatStore } from '../../state/fuckbuff-chat-store'
import { useFuckbuffModelStore } from '../../state/fuckbuff-model-store'
import { useFuckbuffSessionStore } from '../../state/fuckbuff-session-store'
import {
  fuckbuffChatAdmissionMayStart,
  useFuckbuffChatAdmission,
} from '../use-fuckbuff-chat-admission'

describe('fuckbuffChatAdmissionMayStart', () => {
  const ready = {
    chainInProgress: false,
    streamStatus: 'idle' as const,
    queuedCount: 1,
    queuePaused: false,
  }

  test('admits for an idle queue that holds a message', () => {
    expect(fuckbuffChatAdmissionMayStart(ready)).toBe(true)
  })

  // A paused queue sends nothing, so the hour it bought went unused and was
  // refunded five minutes later.
  test('waits while the user has paused the queue', () => {
    expect(fuckbuffChatAdmissionMayStart({ ...ready, queuePaused: true })).toBe(
      false,
    )
  })

  test('waits for an empty queue, a running chain or a live stream', () => {
    expect(fuckbuffChatAdmissionMayStart({ ...ready, queuedCount: 0 })).toBe(
      false,
    )
    expect(
      fuckbuffChatAdmissionMayStart({ ...ready, chainInProgress: true }),
    ).toBe(false)
    expect(
      fuckbuffChatAdmissionMayStart({ ...ready, streamStatus: 'streaming' }),
    ).toBe(false)
  })
})

test('a send before the first session response runs the default it resolved', async () => {
  // The send captured the launch seed (MiMo); the response moved the selection
  // to Flash. `freebucks: null` stops admission at confirm, before the network.
  useFuckbuffModelStore.setState({
    hasExplicitPick: false,
    selectedModel: FUCKBUFF_DEEPSEEK_V4_FLASH_MODEL_ID,
  })
  useFuckbuffSessionStore.getState().setSession({
    status: 'none',
    accessTier: 'full',
    freebucks: null,
  } as never)
  useFuckbuffChatStore.setState({
    admission: {
      phase: 'requested',
      model: FUCKBUFF_MIMO_V25_MODEL_ID,
      metadataChecked: true,
    },
  })
  const setup = await createTestRenderer({ width: 20, height: 2 })
  const root = createRoot(setup.renderer)
  const Harness = () => {
    useFuckbuffChatAdmission(true)
    return React.createElement('text', null, 'x')
  }
  flushSync(() => root.render(React.createElement(Harness)))
  await setup.renderOnce()
  expect(useFuckbuffChatStore.getState().admission).toMatchObject({
    phase: 'confirm',
    model: FUCKBUFF_DEEPSEEK_V4_FLASH_MODEL_ID,
  })
  flushSync(() => root.unmount())
  setup.renderer.destroy()
})

// Full access is never asked (2026-10-16), not even to end the live session.
test.each([true, false])(
  'a model switch asks only an account the server asks (spendWithoutAsking=%s)',
  async (spendWithoutAsking) => {
    const realFetch = globalThis.fetch
    globalThis.fetch = (async () =>
      Response.json({ status: 'none' })) as unknown as typeof fetch
    useFuckbuffModelStore.setState({ hasExplicitPick: true })
    useFuckbuffSessionStore.getState().setSession({
      status: 'active',
      accessTier: 'full',
      model: FUCKBUFF_MIMO_V25_MODEL_ID,
      instanceId: 'cli',
      admittedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 600_000).toISOString(),
      freebucks: {
        balance: 100,
        daily: { limit: 150, spent: 50, remaining: 100, resetAt: '' },
        wallet: { balance: 0, monthlyBonus: 0 },
        planId: null,
        prices: {
          [FUCKBUFF_MIMO_V25_MODEL_ID]: 10,
          [FUCKBUFF_DEEPSEEK_V4_FLASH_MODEL_ID]: 15,
        },
        ...(spendWithoutAsking ? { spendWithoutAsking: true } : {}),
      },
    } as never)
    useFuckbuffChatStore.setState({
      admission: {
        phase: 'requested',
        model: FUCKBUFF_DEEPSEEK_V4_FLASH_MODEL_ID,
        metadataChecked: true,
      },
    })
    const setup = await createTestRenderer({ width: 20, height: 2 })
    const root = createRoot(setup.renderer)
    const Harness = () => {
      useFuckbuffChatAdmission(true)
      return React.createElement('text', null, 'x')
    }
    try {
      flushSync(() => root.render(React.createElement(Harness)))
      await setup.renderOnce()
      const phase = useFuckbuffChatStore.getState().admission?.phase
      if (spendWithoutAsking) expect(phase).not.toBe('confirm')
      else expect(phase).toBe('confirm')
    } finally {
      useFuckbuffChatStore.setState({ admission: undefined } as never)
      flushSync(() => root.unmount())
      setup.renderer.destroy()
      globalThis.fetch = realFetch
    }
  },
)
