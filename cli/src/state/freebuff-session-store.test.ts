import { afterEach, beforeEach, expect, spyOn, test } from 'bun:test'

import * as auth from '../utils/auth'
import { useFuckbuffSessionStore } from './fuckbuff-session-store'

const activeSession = {
  status: 'active' as const,
  accessTier: 'full' as const,
  model: 'mimo/mimo-v2.5',
  instanceId: 'held-cli',
  admittedAt: '2099-09-07T12:00:00Z',
  expiresAt: '2099-09-07T13:00:00Z',
  remainingMs: 300000,
}
let fetchSpy: ReturnType<typeof spyOn>
let authSpy: ReturnType<typeof spyOn>

beforeEach(() => {
  authSpy = spyOn(auth, 'getAuthTokenDetails').mockReturnValue({
    token: 'test-token',
    source: 'environment',
  })
  fetchSpy = spyOn(globalThis, 'fetch').mockImplementation((async () =>
    Response.json({
      status: 'ended',
      freebucksRefund: 4,
    })) as unknown as typeof fetch)
  useFuckbuffSessionStore.getState().setSession(activeSession)
})
afterEach(() => {
  fetchSpy.mockRestore()
  authSpy.mockRestore()
  useFuckbuffSessionStore.getState().setSession(null)
})

test('release owns the refund receipt and sends the held instance', async () => {
  await useFuckbuffSessionStore.getState().releaseSlot()
  expect(useFuckbuffSessionStore.getState().lastRefund).toBe(4)
  const [, init] = fetchSpy.mock.calls[0]!
  expect(init.method).toBe('DELETE')
  expect(new Headers(init.headers).get('x-fuckbuff-instance-id')).toBe(
    'held-cli',
  )
  useFuckbuffSessionStore.getState().setSession({ status: 'none' })
  expect(useFuckbuffSessionStore.getState().lastRefund).toBe(4)
  useFuckbuffSessionStore.getState().setSession(activeSession)
  expect(useFuckbuffSessionStore.getState().lastRefund).toBeNull()
  await useFuckbuffSessionStore.getState().releaseSlot()
  useFuckbuffSessionStore.getState().setSession(null)
  expect(useFuckbuffSessionStore.getState().lastRefund).toBeNull()
})

test('failed release is retryable and never invents a receipt', async () => {
  fetchSpy.mockRejectedValue(new Error('offline'))
  await expect(
    useFuckbuffSessionStore.getState().releaseSlot(),
  ).rejects.toThrow('offline')
  expect(useFuckbuffSessionStore.getState().failure?.outcomeUnknown).toBe(true)
  expect(useFuckbuffSessionStore.getState().session).toEqual(activeSession)
  expect(useFuckbuffSessionStore.getState().lastRefund).toBeNull()
})

test('an update restart keeps the held slot on every exit path', async () => {
  useFuckbuffSessionStore.getState().setFailure(null)
  try {
    useFuckbuffSessionStore.getState().keepSlotForRelaunch()
    // exitCliCleanly and the hook's unmount cleanup both land here; neither
    // may end the hour the relaunched binary is about to take over.
    await useFuckbuffSessionStore.getState().releaseSlot()
    await useFuckbuffSessionStore.getState().releaseSlot(activeSession)
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(useFuckbuffSessionStore.getState().session).toEqual(activeSession)
    expect(useFuckbuffSessionStore.getState().failure).toBeNull()
  } finally {
    useFuckbuffSessionStore.setState({ slotKeptForRelaunch: false })
  }
})

test('release does nothing without a held slot or authentication', async () => {
  authSpy.mockReturnValue({ source: null })
  await expect(
    useFuckbuffSessionStore.getState().releaseSlot(),
  ).rejects.toThrow('authentication')
  authSpy.mockReturnValue({ token: 'test-token', source: 'environment' })
  useFuckbuffSessionStore.getState().setSession({ status: 'none' })
  await useFuckbuffSessionStore.getState().releaseSlot()
  expect(fetchSpy).not.toHaveBeenCalled()
})

for (const transition of ['replacement', 'logout', 'auth-change'] as const) {
  test(`late release cannot publish a receipt after ${transition}`, async () => {
    let respond!: (response: Response) => void
    fetchSpy.mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          respond = resolve
        }),
    )
    const release = useFuckbuffSessionStore.getState().releaseSlot()
    if (transition === 'replacement')
      useFuckbuffSessionStore
        .getState()
        .setSession({ ...activeSession, instanceId: 'new-cli' })
    if (transition === 'logout')
      useFuckbuffSessionStore.getState().setSession(null)
    if (transition === 'auth-change')
      authSpy.mockReturnValue({
        token: 'different-user',
        source: 'environment',
      })
    respond(Response.json({ status: 'ended', freebucksRefund: 4 }))
    await release
    expect(useFuckbuffSessionStore.getState().lastRefund).toBeNull()
  })
}

test('exit and explicit end share one pending request; failure permits retry', async () => {
  let reject!: (error: Error) => void
  fetchSpy.mockImplementation(
    () =>
      new Promise<Response>((_, fail) => {
        reject = fail
      }),
  )
  const first = useFuckbuffSessionStore.getState().releaseSlot()
  const second = useFuckbuffSessionStore.getState().releaseSlot()
  expect(first).toBe(second)
  expect(fetchSpy).toHaveBeenCalledTimes(1)
  reject(new Error('response lost'))
  await expect(first).rejects.toThrow('response lost')
  fetchSpy.mockResolvedValue(
    Response.json({ status: 'ended', freebucksRefund: 4 }),
  )
  await useFuckbuffSessionStore.getState().releaseSlot()
  expect(fetchSpy).toHaveBeenCalledTimes(2)
  expect(useFuckbuffSessionStore.getState().lastRefund).toBe(4)
})

test.each(['none', 'banned', 'country_blocked'])(
  'a %s response does not confirm an end',
  async (status) => {
    fetchSpy.mockResolvedValue(Response.json({ status }))
    await expect(
      useFuckbuffSessionStore.getState().releaseSlot(),
    ).rejects.toThrow('did not confirm')
    expect(useFuckbuffSessionStore.getState().session).toEqual(activeSession)
    expect(useFuckbuffSessionStore.getState().lastRefund).toBeNull()
  },
)

test('a poll refreshing the same instance does not discard its refund receipt', async () => {
  let respond!: (response: Response) => void
  fetchSpy.mockImplementation(
    () =>
      new Promise<Response>((resolve) => {
        respond = resolve
      }),
  )
  const release = useFuckbuffSessionStore.getState().releaseSlot()
  useFuckbuffSessionStore
    .getState()
    .setSession({ ...activeSession, remainingMs: 299000 })
  respond(Response.json({ status: 'ended', freebucksRefund: 4 }))
  await release
  expect(useFuckbuffSessionStore.getState().lastRefund).toBe(4)
})

test('a pending end releases the chat and later recovers its final receipt', async () => {
  fetchSpy.mockResolvedValue(
    Response.json({ status: 'ended', freebucksRefundPending: true }),
  )
  await useFuckbuffSessionStore.getState().releaseSlot()
  expect(useFuckbuffSessionStore.getState().lastRefund).toBeNull()
  expect(useFuckbuffSessionStore.getState().pendingRefund?.instanceId).toBe(
    'held-cli',
  )
  useFuckbuffSessionStore.getState().setSession({ status: 'none' })
  fetchSpy.mockResolvedValue(
    Response.json({ status: 'ended', freebucksRefund: 1 }),
  )
  await useFuckbuffSessionStore.getState().refreshRefund()
  expect(useFuckbuffSessionStore.getState().lastRefund).toBe(1)
  expect(useFuckbuffSessionStore.getState().pendingRefund).toBeNull()
  expect(
    new Headers(fetchSpy.mock.calls[1]![1].headers).get(
      'x-fuckbuff-instance-id',
    ),
  ).toBe('held-cli')
})

test('a receipt poll cannot publish into a replacement session', async () => {
  fetchSpy.mockResolvedValue(
    Response.json({ status: 'ended', freebucksRefundPending: true }),
  )
  await useFuckbuffSessionStore.getState().releaseSlot()
  let respond!: (response: Response) => void
  fetchSpy.mockImplementation(
    () =>
      new Promise<Response>((resolve) => {
        respond = resolve
      }),
  )
  const poll = useFuckbuffSessionStore.getState().refreshRefund()
  useFuckbuffSessionStore
    .getState()
    .setSession({ ...activeSession, instanceId: 'replacement' })
  respond(Response.json({ status: 'ended', freebucksRefund: 1 }))
  await poll
  expect(useFuckbuffSessionStore.getState().lastRefund).toBeNull()
})

test('a settled receipt with no amount is not a zero refund', async () => {
  // The abandoned settlement: the purchase was dropped, so the hour's receipt
  // never names an amount. Zero would tell the user their usage spent the
  // whole price, which is a claim this receipt does not make.
  fetchSpy.mockResolvedValue(
    Response.json({ status: 'ended', freebucksRefundPending: true }),
  )
  await useFuckbuffSessionStore.getState().releaseSlot()
  expect(useFuckbuffSessionStore.getState().pendingRefund).not.toBeNull()
  fetchSpy.mockResolvedValue(Response.json({ status: 'ended' }))
  await useFuckbuffSessionStore.getState().refreshRefund()
  expect(useFuckbuffSessionStore.getState().lastRefund).toBeNull()
  // Settled is settled: the poll stops either way.
  expect(useFuckbuffSessionStore.getState().pendingRefund).toBeNull()
})

test('a settled zero is kept as a zero', async () => {
  fetchSpy.mockResolvedValue(
    Response.json({ status: 'ended', freebucksRefundPending: true }),
  )
  await useFuckbuffSessionStore.getState().releaseSlot()
  fetchSpy.mockResolvedValue(
    Response.json({ status: 'ended', freebucksRefund: 0 }),
  )
  await useFuckbuffSessionStore.getState().refreshRefund()
  expect(useFuckbuffSessionStore.getState().lastRefund).toBe(0)
})
