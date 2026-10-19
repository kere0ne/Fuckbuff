import { afterEach, beforeAll, expect, spyOn, test } from 'bun:test'
import { createTestRenderer } from '@opentui/core/testing'
import { createRoot, flushSync } from '@opentui/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { freebucksFixture } from '@codebuff/common/testing/fuckbuff'

import { FuckbuffChatHeader } from '../fuckbuff-chat-header'
import { fuckbuffPausedPlanMessage } from '../fuckbuff-paused-plan-notice'
import { initializeThemeStore } from '../../hooks/use-theme'
import * as auth from '../../utils/auth'

import type { FuckbuffSubscriptionInfo } from '@codebuff/common/types/fuckbuff-session'
import type { FuckbuffSessionResponse } from '../../types/fuckbuff-session'

let cleanup: (() => void) | undefined
beforeAll(initializeThemeStore)
afterEach(() => {
  cleanup?.()
  cleanup = undefined
})

const sessionWith = (
  subscription: Partial<FuckbuffSubscriptionInfo> | undefined,
): FuckbuffSessionResponse => ({
  status: 'none',
  accessTier: 'full',
  freebucks: freebucksFixture(25),
  ...(subscription && {
    subscription: { tierId: null, tiers: [], ...subscription },
  }),
})

test('names the paused plan, falling back to the raw id', () => {
  expect(
    fuckbuffPausedPlanMessage(sessionWith({ paymentFailedTierId: 'starter' })),
  ).toBe(
    'Your Starter plan is paused: the renewal payment failed.',
  )
  expect(
    fuckbuffPausedPlanMessage(sessionWith({ paymentFailedTierId: 'legacy' })),
  ).toStartWith('Your legacy plan is paused')
})

test('no notice when nothing is paused or the server predates the field', () => {
  expect(fuckbuffPausedPlanMessage(null)).toBeNull()
  expect(fuckbuffPausedPlanMessage(sessionWith(undefined))).toBeNull()
  expect(fuckbuffPausedPlanMessage(sessionWith({ tierId: 'pro' }))).toBeNull()
  expect(
    fuckbuffPausedPlanMessage(
      sessionWith({ tierId: 'pro', cancelAtPeriodEnd: true }),
    ),
  ).toBeNull()
})

test('the launch panel shows the paused-plan notice with the account link', async () => {
  const token = spyOn(auth, 'getAuthToken').mockReturnValue(undefined)
  const setup = await createTestRenderer({ width: 100, height: 32 })
  const root = createRoot(setup.renderer)
  const queries = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  cleanup = () => {
    flushSync(() => root.unmount())
    queries.clear()
    setup.renderer.destroy()
    token.mockRestore()
  }
  const render = (session: FuckbuffSessionResponse) =>
    flushSync(() =>
      root.render(
        <QueryClientProvider client={queries}>
          <FuckbuffChatHeader projectRoot="/tmp/project" session={session} />
        </QueryClientProvider>,
      ),
    )

  render(sessionWith({ paymentFailedTierId: 'plus' }))
  await setup.renderOnce()
  const paused = setup.captureCharFrame().replace(/\s+/g, ' ')
  expect(paused).toContain(
    'Your Plus plan is paused: the renewal payment failed.',
  )
  expect(paused).toContain(
    'Update your card at freebuff.com/account?tab=subscription',
  )

  render(sessionWith({ tierId: 'plus' }))
  await setup.renderOnce()
  const paid = setup.captureCharFrame()
  expect(paid).not.toContain('is paused')
  expect(paid).not.toContain('tab=subscription')
})
