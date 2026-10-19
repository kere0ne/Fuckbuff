import { describe, expect, it } from 'bun:test'

import {
  FUCKBUFF_GEMINI_38_FLASH_MODEL_ID,
  FUCKBUFF_GPT_6_LUNA_MODEL_ID,
  FUCKBUFF_LIMITED_TIER_PLAN_ONLY_MODEL_IDS,
  FUCKBUFF_MIMO_V26_PRO_MODEL_ID,
  getFuckbuffModelsForAccessTier,
  LIMITED_FUCKBUFF_MODEL_IDS,
} from '../../constants/fuckbuff-models'
import type { FuckbuffFreebucksInfo } from '../../types/fuckbuff-session'
import {
  fuckbuffPlanRequired,
  freebucksRowIntent,
} from '../fuckbuff-model-selection'

/**
 * The tier fallback of `fuckbuffPlanRequired`: what a picker draws locked when
 * the server sent no `planRequiredModelIds` (no Freebucks block, a balance
 * that is unavailable, an older server). Since 2026-09-30 the limited catalog
 * LISTS the rows a plan unlocks there to every limited account, so without
 * this the fallback (the full-access paid-only list) drew GPT-6 Luna and MiMo
 * 2.6 Pro as ordinary rows that admission then refuses.
 */
describe('the plan lock without a server verdict', () => {
  it('locks every limited plan-only row at limited access', () => {
    for (const id of FUCKBUFF_LIMITED_TIER_PLAN_ONLY_MODEL_IDS) {
      expect(fuckbuffPlanRequired(id, false, undefined, 'limited')).toBe(true)
      expect(fuckbuffPlanRequired(id, false, null, 'limited')).toBe(true)
    }
  })

  it('agrees with the rows the limited catalog appends to the free ones', () => {
    const listed = getFuckbuffModelsForAccessTier('limited').map((m) => m.id)
    const locked = listed.filter((id) =>
      fuckbuffPlanRequired(id, false, undefined, 'limited'),
    )
    expect(locked).toEqual(
      listed.filter(
        (id) => !(LIMITED_FUCKBUFF_MODEL_IDS as readonly string[]).includes(id),
      ),
    )
  })

  it('leaves Luna and MiMo 2.6 Pro open at full access, Gemini locked', () => {
    for (const id of [FUCKBUFF_GPT_6_LUNA_MODEL_ID, FUCKBUFF_MIMO_V26_PRO_MODEL_ID]) {
      expect(fuckbuffPlanRequired(id, false, undefined, 'full')).toBe(false)
      expect(fuckbuffPlanRequired(id, false, undefined)).toBe(false)
    }
    expect(
      fuckbuffPlanRequired(FUCKBUFF_GEMINI_38_FLASH_MODEL_ID, false, undefined, 'full'),
    ).toBe(true)
  })

  it('opens every row on a plan, and the server verdict still wins', () => {
    expect(
      fuckbuffPlanRequired(FUCKBUFF_GPT_6_LUNA_MODEL_ID, true, undefined, 'limited'),
    ).toBe(false)
    expect(
      fuckbuffPlanRequired(
        FUCKBUFF_GPT_6_LUNA_MODEL_ID,
        false,
        { planRequiredModelIds: [] },
        'limited',
      ),
    ).toBe(false)
  })
})

/** Full access (2026-10-16): never asked before an hour, and a row locks on
 *  its price less `soloDiscount`, which the server sends while nothing is live. */
describe('the full-access session policy', () => {
  const freebucks = (over: Partial<FuckbuffFreebucksInfo> = {}) =>
    ({
      balance: 10,
      daily: { limit: 150, spent: 150, remaining: 0, resetAt: '' },
      wallet: { balance: 10, monthlyBonus: 0 },
      planId: null,
      prices: { flash: 15, pro: 30 },
      ...over,
    }) as FuckbuffFreebucksInfo
  const intent = (info: FuckbuffFreebucksInfo, model: string, active?: string) =>
    freebucksRowIntent(info, model, active).kind

  it('asks nothing, not even before ending the live session', () => {
    const info = freebucks({ balance: 30, wallet: { balance: 30, monthlyBonus: 0 } })
    expect(intent({ ...info, spendWithoutAsking: true }, 'pro', 'flash')).toBe('allow')
    expect(intent(info, 'pro', 'flash')).toBe('confirm')
  })

  it('locks on the price less the solo discount, and on list price without it', () => {
    const never = { spendWithoutAsking: true }
    expect(intent(freebucks({ ...never, soloDiscount: 15 }), 'flash')).toBe('allow')
    expect(intent(freebucks(never), 'flash')).toBe('paywall')
    // 30 less 15 is still more than 10.
    expect(intent(freebucks({ ...never, soloDiscount: 15 }), 'pro')).toBe('paywall')
  })
})
