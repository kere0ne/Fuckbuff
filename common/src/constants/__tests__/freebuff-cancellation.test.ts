import { describe, expect, test } from 'bun:test'

import {
  FUCKBUFF_BETA_RATE_LOCK_MULTIPLIER,
  FUCKBUFF_CANCELLATION_REASONS,
  isFuckbuffCancellationReason,
} from '../fuckbuff-subscriptions'

/**
 * The offboarding reason is validated SERVER-side against this list, so the
 * list is a contract rather than presentation: an id that drifts here silently
 * starts rejecting cancellations the client believes are valid.
 */
describe('cancellation reasons', () => {
  test('every rendered option is one the server will accept', () => {
    for (const option of FUCKBUFF_CANCELLATION_REASONS) {
      expect(isFuckbuffCancellationReason(option.id)).toBe(true)
    }
  })

  test('anything else is refused, including empty and near-misses', () => {
    for (const value of ['', 'too expensive', 'TOO_EXPENSIVE', null, 7, {}]) {
      expect(isFuckbuffCancellationReason(value)).toBe(false)
    }
  })

  test('the list keeps an escape hatch, or the form cannot be completed', () => {
    expect(FUCKBUFF_CANCELLATION_REASONS.some((r) => r.id === 'other')).toBe(
      true,
    )
  })

  test('the rate-lock multiple is a plain number the copy can state', () => {
    expect(FUCKBUFF_BETA_RATE_LOCK_MULTIPLIER).toBeGreaterThan(1)
  })
})
