import { describe, expect, test } from 'bun:test'

import { fuckbuffLegacyModelDigest } from '../types/fuckbuff-model-catalog'
import {
  FUCKBUFF_DEEPSEEK_V4_FLASH_FAST_MODEL_ID,
  FUCKBUFF_DEEPSEEK_V4_FLASH_MODEL_ID,
  FUCKBUFF_GEMINI_38_FLASH_MODEL_ID,
  FUCKBUFF_GLM_V53_FLASH_MODEL_ID,
  FUCKBUFF_GPT_6_LUNA_MODEL_ID,
  FUCKBUFF_MIMO_V26_PRO_MODEL_ID,
  FUCKBUFF_MODELS,
  FUCKBUFF_MUSE_SPARK_MODEL_IDS,
  FUCKBUFF_MUSE_SPARK_13_CONTRIBUTOR_MODEL_ID,
  FUCKBUFF_SOLAR_PRO_4_MODEL_ID,
  FUCKBUFF_WEB_PREMIUM_MODEL_IDS,
} from '../constants/fuckbuff-models'
import {
  FUCKBUFF_CLAUDE_HAIKU_55_CATALOG_KEY,
  FUCKBUFF_CLAUDE_HAIKU_55_MODEL_ID,
  FUCKBUFF_DESKTOP_UNCAPPED_TAB_LIMIT,
  fuckbuffDesktopConcurrencyLimits,
  fuckbuffDesktopModelTabLimit,
  getFuckbuffDesktopConcurrency,
} from '../constants/fuckbuff-desktop-sessions'

describe('Fuckbuff Desktop session concurrency', () => {
  test('projects account ceilings', () => {
    expect(fuckbuffDesktopConcurrencyLimits('full', false)).toEqual({
      'slot-bound': 1,
      'multi-tab': 3,
    })
    expect(fuckbuffDesktopConcurrencyLimits('limited', false)).toEqual({
      'slot-bound': 1,
      'multi-tab': 0,
    })
    expect(fuckbuffDesktopConcurrencyLimits('limited', true)).toEqual({
      'slot-bound': 3,
      'multi-tab': 8,
    })
  })

  test('an uncapped account gets the runaway guard in every bucket and tier', () => {
    for (const tier of ['full', 'limited'] as const) {
      for (const paid of [false, true]) {
        expect(fuckbuffDesktopConcurrencyLimits(tier, paid, true)).toEqual({
          'slot-bound': FUCKBUFF_DESKTOP_UNCAPPED_TAB_LIMIT,
          'multi-tab': FUCKBUFF_DESKTOP_UNCAPPED_TAB_LIMIT,
        })
      }
    }
    expect(fuckbuffDesktopModelTabLimit(0)).toBe(1)
    expect(fuckbuffDesktopModelTabLimit(0, true)).toBe(Infinity)
  })

  test('classifies models by tier and plan', () => {
    const cases = [
      [FUCKBUFF_GEMINI_38_FLASH_MODEL_ID, 'full', false, 'slot-bound'],
      [`${FUCKBUFF_GEMINI_38_FLASH_MODEL_ID}-20260922`, 'full', true, 'slot-bound'],
      // Claude Haiku 5.5 with full context is slot-bound since 2026-10-14,
      // under both of its names; its 100k-context row is not.
      [FUCKBUFF_CLAUDE_HAIKU_55_MODEL_ID, 'full', false, 'slot-bound'],
      [FUCKBUFF_CLAUDE_HAIKU_55_MODEL_ID, 'full', true, 'slot-bound'],
      [FUCKBUFF_CLAUDE_HAIKU_55_CATALOG_KEY, 'full', true, 'slot-bound'],
      [`${FUCKBUFF_CLAUDE_HAIKU_55_MODEL_ID}-100k`, 'full', true, 'multi-tab'],
      // GPT-6 Luna, MiMo 2.6 Pro and DeepSeek Flash fast mode are multi-tab
      // since 2026-10-14.
      [`${FUCKBUFF_GPT_6_LUNA_MODEL_ID}-20260922`, 'full', false, 'multi-tab'],
      [FUCKBUFF_MIMO_V26_PRO_MODEL_ID, 'full', true, 'multi-tab'],
      [FUCKBUFF_DEEPSEEK_V4_FLASH_FAST_MODEL_ID, 'full', false, 'multi-tab'],
      [FUCKBUFF_GPT_6_LUNA_MODEL_ID, 'limited', false, 'slot-bound'],
      [FUCKBUFF_GLM_V53_FLASH_MODEL_ID, 'full', false, 'multi-tab'],
      [FUCKBUFF_SOLAR_PRO_4_MODEL_ID, 'full', false, 'multi-tab'],
      [FUCKBUFF_SOLAR_PRO_4_MODEL_ID, 'limited', false, 'slot-bound'],
      [FUCKBUFF_SOLAR_PRO_4_MODEL_ID, 'limited', true, 'multi-tab'],
      [FUCKBUFF_DEEPSEEK_V4_FLASH_MODEL_ID, 'limited', false, 'slot-bound'],
      // Muse Spark is multi-tab since 2026-10-10, when Meta lifted the
      // Contributor rate limit that held it to one tab.
      [FUCKBUFF_MUSE_SPARK_13_CONTRIBUTOR_MODEL_ID, 'full', false, 'multi-tab'],
      [FUCKBUFF_MUSE_SPARK_13_CONTRIBUTOR_MODEL_ID, 'full', true, 'multi-tab'],
      [FUCKBUFF_MUSE_SPARK_13_CONTRIBUTOR_MODEL_ID, 'limited', true, 'multi-tab'],
    ] as const
    for (const [model, tier, paidPlan, expected] of cases) {
      expect(getFuckbuffDesktopConcurrency(model, tier, paidPlan)).toBe(
        expected,
      )
    }

    // Premium rows are slot-bound unless named multi-tab here, so a new
    // premium row takes one tab until someone decides otherwise.
    const multiTabPremium = new Set<string>([
      FUCKBUFF_GPT_6_LUNA_MODEL_ID,
      FUCKBUFF_MIMO_V26_PRO_MODEL_ID,
      FUCKBUFF_DEEPSEEK_V4_FLASH_FAST_MODEL_ID,
    ])
    const desktopModels = new Set<string>(FUCKBUFF_MODELS.map(({ id }) => id))
    for (const id of FUCKBUFF_WEB_PREMIUM_MODEL_IDS) {
      if (desktopModels.has(id)) {
        expect(getFuckbuffDesktopConcurrency(id, 'full')).toBe(
          multiTabPremium.has(id) ? 'multi-tab' : 'slot-bound',
        )
      }
    }
    for (const id of FUCKBUFF_MUSE_SPARK_MODEL_IDS) {
      expect(getFuckbuffDesktopConcurrency(id, 'full')).toBe('multi-tab')
    }
  })

  test("Haiku 5.5's catalog key is the default catalog's key for its id", () => {
    // packages/internal's defaultCatalogKey, which common cannot import.
    expect(FUCKBUFF_CLAUDE_HAIKU_55_CATALOG_KEY).toBe(
      `m-${fuckbuffLegacyModelDigest(`key:${FUCKBUFF_CLAUDE_HAIKU_55_MODEL_ID}`).slice(0, 10)}`,
    )
  })
})
