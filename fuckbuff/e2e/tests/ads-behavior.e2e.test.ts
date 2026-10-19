import { afterEach, describe, expect, test } from 'bun:test'

import { FuckbuffSession, requireFuckbuffBinary } from '../utils'

const TEST_TIMEOUT = 60_000

describe('Fuckbuff: Ads Behavior', () => {
  let session: FuckbuffSession | null = null

  afterEach(async () => {
    if (session) {
      await session.stop()
      session = null
    }
  })

  test(
    'ads commands are not available',
    async () => {
      const binary = requireFuckbuffBinary()
      session = await FuckbuffSession.start(binary)
      await session.waitForReady()

      // Type "/ads" to check for ads commands in autocomplete
      await session.send('/ads', { noEnter: true })
      const output = await session.capture(2)

      // Neither ads:enable nor ads:disable should appear
      expect(output).not.toContain('ads:enable')
      expect(output).not.toContain('ads:disable')
    },
    TEST_TIMEOUT,
  )

  test(
    'startup screen does not show ad-related UI',
    async () => {
      const binary = requireFuckbuffBinary()
      session = await FuckbuffSession.start(binary)
      await session.waitForReady()

      const output = await session.capture()

      // Ads are always enabled in Fuckbuff — no credits or toggle UI
      expect(output).not.toMatch(/\+\d+ credits/)
      expect(output).not.toContain('Hide ads')
      expect(output).not.toContain('/ads:enable')
    },
    TEST_TIMEOUT,
  )
})
