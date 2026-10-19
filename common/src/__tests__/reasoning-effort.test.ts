import { describe, expect, test } from 'bun:test'

import type { FuckbuffModelOption } from '../constants/fuckbuff-models'
import {
  clampReasoningEffort,
  reasoningEffortRank,
  REASONING_EFFORTS,
  type ReasoningEffort,
} from '../constants/reasoning-effort'
import {
  EFFORTS_THROUGH_HIGH,
  EFFORTS_THROUGH_MAX,
  EFFORTS_THROUGH_XHIGH,
  FUCKBUFF_DEEPSEEK_V4_FLASH_MODEL_ID,
  FUCKBUFF_DEEPSEEK_V4_PRO_MODEL_ID,
  FUCKBUFF_FABLE_5_1_MODEL_ID,
  FUCKBUFF_GLM_V52_MODEL_ID,
  FUCKBUFF_GLM_V53_FLASH_MODEL_ID,
  FUCKBUFF_GPT_5_6_LUNA_MODEL_ID,
  FUCKBUFF_KIMI_K3_ECO_MODEL_ID,
  FUCKBUFF_MIMO_V25_MODEL_ID,
  FUCKBUFF_MINIMAX_M3_MODEL_ID,
  FUCKBUFF_MUSE_SPARK_12_CONTRIBUTOR_MODEL_ID,
  FUCKBUFF_WEB_ALL_MODELS,
  getFuckbuffModelDefaultEffort,
  getFuckbuffModelEfforts,
  getFuckbuffModelReasoningEffort,
  resolveFuckbuffReasoningEffort,
  SUPPORTED_FUCKBUFF_MODELS,
} from '../constants/fuckbuff-models'

describe('the shared effort ladder', () => {
  test('is ordered ascending, because the clamp does index arithmetic on it', () => {
    // clampReasoningEffort answers "the most this model allows, but no more
    // than was asked". That is only meaningful if position implies magnitude,
    // so a reorder here would silently invert every clamp in the product.
    expect(REASONING_EFFORTS).toEqual([
      'minimal',
      'low',
      'medium',
      'high',
      'xhigh',
      'max',
      'ultra',
    ])
    expect(reasoningEffortRank('low')).toBeLessThan(reasoningEffortRank('high'))
    expect(reasoningEffortRank('high')).toBeLessThan(
      reasoningEffortRank('xhigh'),
    )
  })

  test('clamps DOWN to the ceiling rather than falling back to a default', () => {
    // The distinction that matters on a reroute: a user on xhigh whose request
    // lands on a model topping out at high should get high — the closest thing
    // to what they chose — not that model's default, which could be lower.
    expect(clampReasoningEffort('xhigh', EFFORTS_THROUGH_HIGH, 'low')).toBe(
      'high',
    )
    expect(clampReasoningEffort('ultra', EFFORTS_THROUGH_XHIGH, 'low')).toBe(
      'xhigh',
    )
    // Exactly on a rung is that rung.
    expect(clampReasoningEffort('medium', EFFORTS_THROUGH_HIGH, 'high')).toBe(
      'medium',
    )
    // Nothing recognizable asked for: the caller's fallback, not a guess.
    expect(clampReasoningEffort(undefined, EFFORTS_THROUGH_HIGH, 'high')).toBe(
      'high',
    )
    expect(clampReasoningEffort('bogus', EFFORTS_THROUGH_HIGH, 'high')).toBe(
      'high',
    )
    // Below everything on offer: the least of them, never nothing.
    expect(clampReasoningEffort('low', ['high', 'xhigh'], 'xhigh')).toBe('high')
  })
})

// `as const satisfies FuckbuffModelOption` gives each row a narrow literal
// type, so the union has no `efforts` property at all unless every member
// declares one. Widening once here keeps the invariants readable.
const ALL_ROWS: readonly FuckbuffModelOption[] = [
  ...SUPPORTED_FUCKBUFF_MODELS,
  ...FUCKBUFF_WEB_ALL_MODELS,
]

describe('per-model effort ladders', () => {
  test('every ladder contains its default', () => {
    for (const model of ALL_ROWS) {
      if (!model.efforts?.length) continue
      const dflt = getFuckbuffModelDefaultEffort(model.id)!
      expect({
        id: model.id,
        containsDefault: model.efforts.includes(dflt),
      }).toEqual({ id: model.id, containsDefault: true })
    }
  })

  test('every ladder rung is a rung of the shared vocabulary', () => {
    for (const model of ALL_ROWS) {
      for (const effort of model.efforts ?? []) {
        expect(REASONING_EFFORTS).toContain(effort)
      }
    }
  })

  test('GPT-5.6 Luna keeps its complete native ladder', () => {
    expect(getFuckbuffModelEfforts(FUCKBUFF_GPT_5_6_LUNA_MODEL_ID)).toEqual(
      EFFORTS_THROUGH_MAX,
    )
    expect(
      resolveFuckbuffReasoningEffort(FUCKBUFF_GPT_5_6_LUNA_MODEL_ID, undefined),
    ).toBe('high')
  })

  // Product caps (2026-09-29): the ladder is a CEILING, so a higher request
  // clamps down to it rather than reaching the provider.
  test('caps GPT-6.1 Sol and Muse Spark at high, GPT-6 Luna at xhigh, and fixes Gemini 3.8 Flash at high', () => {
    for (const id of [
      'openai/gpt-6.1-sol',
      FUCKBUFF_MUSE_SPARK_12_CONTRIBUTOR_MODEL_ID,
      'meta/muse-spark-1.3-contributor',
    ]) {
      expect(getFuckbuffModelEfforts(id)).toEqual(['low', 'medium', 'high'])
      expect(resolveFuckbuffReasoningEffort(id, 'xhigh')).toBe('high')
      expect(resolveFuckbuffReasoningEffort(id, 'max')).toBe('high')
    }
    expect(
      resolveFuckbuffReasoningEffort(
        FUCKBUFF_MUSE_SPARK_12_CONTRIBUTOR_MODEL_ID,
        undefined,
      ),
    ).toBe('high')
    expect(getFuckbuffModelEfforts('openai/gpt-6-luna')).toEqual([
      'low',
      'medium',
      'high',
      'xhigh',
    ])
    expect(resolveFuckbuffReasoningEffort('openai/gpt-6-luna', 'max')).toBe(
      'xhigh',
    )
    expect(getFuckbuffModelEfforts('google/gemini-3.8-flash')).toEqual([
      'high',
    ])
    for (const requested of ['low', 'medium', 'xhigh', 'max'] as const) {
      expect(
        resolveFuckbuffReasoningEffort('google/gemini-3.8-flash', requested),
      ).toBe('high')
    }
  })

  test('Claude Fable 5.1 exposes every enabled effort', () => {
    expect(getFuckbuffModelEfforts(FUCKBUFF_FABLE_5_1_MODEL_ID)).toEqual(
      EFFORTS_THROUGH_MAX,
    )
    expect(getFuckbuffModelDefaultEffort(FUCKBUFF_FABLE_5_1_MODEL_ID)).toBe(
      'high',
    )
  })

  test('DeepSeek exposes the three native V4 efforts on both models', () => {
    // One ladder since the Pro 08/13 GA build: DeepSeek documents the same
    // requested→actual mapping for flash and pro, and low is a real template on
    // both. Medium is not, on either, so it must not appear as a rung.
    for (const id of [
      FUCKBUFF_DEEPSEEK_V4_PRO_MODEL_ID,
      FUCKBUFF_DEEPSEEK_V4_FLASH_MODEL_ID,
    ]) {
      expect(getFuckbuffModelEfforts(id)).toEqual(['low', 'high', 'max'])
      expect(resolveFuckbuffReasoningEffort(id, undefined)).toBe('high')
      expect(getFuckbuffModelReasoningEffort(id)).toBe('high')
      expect(resolveFuckbuffReasoningEffort(id, 'medium')).toBe('high')
      expect(resolveFuckbuffReasoningEffort(id, 'max')).toBe('max')
      expect(resolveFuckbuffReasoningEffort(id, 'low')).toBe('low')
    }
  })

  test('GLM 5.3 Flash offers low/high, and runs high by default', () => {
    // `max` was removed on 2026-08-31 for looping (re-reading, re-planning,
    // re-issuing tool calls), came back on 2026-09-01 as the only rung that
    // thought at all, and was removed again on 2026-10-07 by product: the
    // ladder stops at `high`.
    expect(getFuckbuffModelEfforts(FUCKBUFF_GLM_V53_FLASH_MODEL_ID)).toEqual([
      'low',
      'high',
    ])

    // An UNTOUCHED turn must send an explicit rung: unset measures deeper
    // than `max` on agent prompts, so leaving it unset would undo the cap.
    expect(
      getFuckbuffModelReasoningEffort(FUCKBUFF_GLM_V53_FLASH_MODEL_ID),
    ).toBe('high')
    expect(
      resolveFuckbuffReasoningEffort(FUCKBUFF_GLM_V53_FLASH_MODEL_ID, undefined),
    ).toBe('high')
    expect(
      getFuckbuffModelDefaultEffort(FUCKBUFF_GLM_V53_FLASH_MODEL_ID),
    ).toBe('high')

    // A persisted `max` pick — CLI settings, a Desktop thread, a Web
    // preference — and `xhigh` both clamp DOWN to the cap.
    expect(
      resolveFuckbuffReasoningEffort(FUCKBUFF_GLM_V53_FLASH_MODEL_ID, 'max'),
    ).toBe('high')
    expect(
      resolveFuckbuffReasoningEffort(FUCKBUFF_GLM_V53_FLASH_MODEL_ID, 'xhigh'),
    ).toBe('high')
    // Downward picks still work.
    expect(
      resolveFuckbuffReasoningEffort(FUCKBUFF_GLM_V53_FLASH_MODEL_ID, 'low'),
    ).toBe('low')
    // Including through a dated provider snapshot, which must not dodge it.
    expect(
      resolveFuckbuffReasoningEffort(
        `${FUCKBUFF_GLM_V53_FLASH_MODEL_ID}-20260601`,
        'max',
      ),
    ).toBe('high')
  })

  test('binary, adaptive, and ignored controls do not masquerade as ladders', () => {
    for (const id of [
      FUCKBUFF_MINIMAX_M3_MODEL_ID,
      FUCKBUFF_MIMO_V25_MODEL_ID,
      FUCKBUFF_GLM_V52_MODEL_ID,
      FUCKBUFF_KIMI_K3_ECO_MODEL_ID,
    ]) {
      expect(getFuckbuffModelEfforts(id)).toBeNull()
      expect(resolveFuckbuffReasoningEffort(id, 'low')).toBeNull()
    }
    expect(resolveFuckbuffReasoningEffort('some/unknown-model', 'high')).toBeNull()
  })

  test('a dated provider snapshot resolves like the undated id', () => {
    expect(
      resolveFuckbuffReasoningEffort(
        `${FUCKBUFF_MUSE_SPARK_12_CONTRIBUTOR_MODEL_ID}-20260901`,
        'low',
      ),
    ).toBe('low')
  })
})
