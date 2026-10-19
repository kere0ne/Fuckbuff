import { describe, expect, test } from 'bun:test'

import {
  fuckbuffChargeChargedText,
  fuckbuffChargeReturnText,
  fuckbuffChargeSourceText,
} from '../fuckbuff-session-charge'

const NOW = new Date('2026-10-16T18:00:00.000Z')

describe('fuckbuffChargeChargedText', () => {
  test('a price is whole hours', () => {
    expect(fuckbuffChargeChargedText({ charged: 15 })).toBe('3 hrs')
    expect(fuckbuffChargeChargedText({ charged: 5 })).toBe('1 hr')
  })
})

describe('fuckbuffChargeReturnText', () => {
  test('nothing back once the hour is over', () => {
    expect(fuckbuffChargeReturnText({ returned: 0 }, NOW)).toBe('None back')
  })

  test('null while the hour can still return something', () => {
    expect(
      fuckbuffChargeReturnText(
        { returned: 0, settlesAt: '2026-10-16T18:30:00.000Z' },
        NOW,
      ),
    ).toBeNull()
  })

  test('a settles time already past reads as settled', () => {
    expect(
      fuckbuffChargeReturnText(
        { returned: 0, settlesAt: '2026-10-16T17:30:00.000Z' },
        NOW,
      ),
    ).toBe('None back')
  })

  test('whole hours back', () => {
    expect(fuckbuffChargeReturnText({ returned: 10 }, NOW)).toBe('2 hrs back')
    expect(fuckbuffChargeReturnText({ returned: 5 }, NOW)).toBe('1 hr back')
  })

  test('a return smaller than an hour never reads as zero', () => {
    // Legacy rows (before whole-hour refunds) and partial wallet shares.
    expect(fuckbuffChargeReturnText({ returned: 4 }, NOW)).toBe(
      'Under 1 hr back',
    )
    expect(fuckbuffChargeReturnText({ returned: 1 }, NOW)).toBe(
      'Under 1 hr back',
    )
  })

  test('a non-whole return keeps its whole hours and drops the rest', () => {
    expect(fuckbuffChargeReturnText({ returned: 14 }, NOW)).toBe('2 hrs back')
  })
})

describe('fuckbuffChargeSourceText', () => {
  test('silent when the day paid for it', () => {
    expect(
      fuckbuffChargeSourceText({ charged: 15, chargedFromWallet: 0 }),
    ).toBeNull()
  })

  test('names the wallet when the wallet paid', () => {
    expect(
      fuckbuffChargeSourceText({ charged: 15, chargedFromWallet: 15 }),
    ).toBe('From your wallet')
    expect(
      fuckbuffChargeSourceText({ charged: 15, chargedFromWallet: 5 }),
    ).toBe('Part from your wallet')
  })
})
