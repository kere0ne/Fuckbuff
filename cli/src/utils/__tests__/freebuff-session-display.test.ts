import { describe, expect, test } from 'bun:test'

import {
  formatFuckbuffSessionCountdown,
  formatFuckbuffSessionRemaining,
} from '../fuckbuff-session-display'

describe('fuckbuff session display formatting', () => {
  test('formats urgent countdowns', () => {
    expect(formatFuckbuffSessionCountdown(61_000)).toBe('1:01')
    expect(formatFuckbuffSessionRemaining(61_000)).toBe('1:01 left')
  })

  test('formats minute and hour remaining labels', () => {
    expect(formatFuckbuffSessionRemaining(5 * 60_000)).toBe('5m left')
    expect(formatFuckbuffSessionRemaining(60 * 60_000)).toBe('1h left')
    expect(formatFuckbuffSessionRemaining(90 * 60_000)).toBe('1h 30m left')
  })

  test('formats expired sessions as expiring', () => {
    expect(formatFuckbuffSessionRemaining(0)).toBe('expiring…')
  })
})
