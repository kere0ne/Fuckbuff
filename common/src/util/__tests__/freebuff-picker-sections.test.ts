import { describe, expect, test } from 'bun:test'

import {
  FUCKBUFF_DEEPSEEK_V4_FLASH_FAST_MODEL_ID,
  FUCKBUFF_DEEPSEEK_V4_FLASH_MODEL_ID,
} from '../../constants/fuckbuff-model-ids'
import {
  FUCKBUFF_GEMINI_38_FLASH_MODEL_ID,
  FUCKBUFF_GEMINI_4_ARGON_MODEL_ID,
  FUCKBUFF_GLM_V53_FLASH_MODEL_ID,
  FUCKBUFF_GPT_61_SOL_MODEL_ID,
  FUCKBUFF_GPT_6_LUNA_MODEL_ID,
  FUCKBUFF_MIMO_V25_MODEL_ID,
  FUCKBUFF_MIMO_V26_PRO_MODEL_ID,
  FUCKBUFF_MODELS,
  FUCKBUFF_MUSE_SPARK_13_CONTRIBUTOR_MODEL_ID,
  FUCKBUFF_SOLAR_MINI_4_MODEL_ID,
  FUCKBUFF_SOLAR_PRO_4_MODEL_ID,
  FUCKBUFF_SPACE_BUNNY_ALPHA_MODEL_ID,
} from '../../constants/fuckbuff-models'
import {
  FUCKBUFF_PICKER_PLACED_IDS,
  FUCKBUFF_PICKER_SECTIONS,
  fuckbuffPickerPlacement,
  fuckbuffPickerSections,
  fuckbuffPickerSectionsFor,
  fuckbuffRowPlacement,
} from '../fuckbuff-picker-sections'

const none = { premium: false, locked: false, price: undefined }

describe('fuckbuffPickerPlacement', () => {
  test('literal ids are the catalog constants', () => {
    const at = (id: string) => fuckbuffPickerPlacement([id], none)
    expect(at(FUCKBUFF_SOLAR_PRO_4_MODEL_ID)).toEqual({ section: 'unlimited', order: expect.any(Number) })
    expect(at(FUCKBUFF_SOLAR_MINI_4_MODEL_ID).section).toBe('unlimited')
    // DeepSeek V4.1 Flash leads Optimized as its pick since 2026-10-14.
    expect(at(FUCKBUFF_DEEPSEEK_V4_FLASH_MODEL_ID)).toEqual({ section: 'optimized', order: 5, recommended: true })
    // Then cheapest to dearest (2026-10-15): MiMo v2.6 Flash Slow (5), MiMo v2.6 Flash Fast (10),
    // Muse Spark 1.3 (15), GLM 5.3 Flash and GPT-6 Luna (20).
    const optimized = [
      'm-61c26317cc', // MiMo v2.6 Flash Slow
      FUCKBUFF_MIMO_V25_MODEL_ID,
      FUCKBUFF_MUSE_SPARK_13_CONTRIBUTOR_MODEL_ID,
      FUCKBUFF_GLM_V53_FLASH_MODEL_ID,
      FUCKBUFF_GPT_6_LUNA_MODEL_ID,
    ].map((id) => at(id).order)
    expect(optimized).toEqual([...optimized].sort((a, b) => a - b))
    expect(optimized[0]).toBeGreaterThan(at(FUCKBUFF_DEEPSEEK_V4_FLASH_MODEL_ID).order)
    expect(at(FUCKBUFF_MIMO_V25_MODEL_ID)).toEqual({ section: 'optimized', order: 12 })
    expect(at(FUCKBUFF_GLM_V53_FLASH_MODEL_ID).section).toBe('optimized')
    // Muse Spark 1.3 and GPT-6 Luna moved to Optimized on 2026-10-13.
    for (const id of [FUCKBUFF_MUSE_SPARK_13_CONTRIBUTOR_MODEL_ID, FUCKBUFF_GPT_6_LUNA_MODEL_ID]) {
      expect(at(id)).toEqual({ section: 'optimized', order: expect.any(Number) })
    }
    expect(at(FUCKBUFF_GEMINI_4_ARGON_MODEL_ID)).toEqual({ section: 'powerful', order: 1 })
    expect(at(FUCKBUFF_MIMO_V26_PRO_MODEL_ID)).toEqual({ section: 'powerful', order: expect.any(Number) })
    // Gemini 3.8 Flash, then GPT-6.1 Sol, under Powerful's More.
    expect(at(FUCKBUFF_GEMINI_38_FLASH_MODEL_ID)).toMatchObject({ section: 'powerful', more: true })
    expect(at(FUCKBUFF_GPT_61_SOL_MODEL_ID)).toMatchObject({ section: 'powerful', more: true })
    expect(at(FUCKBUFF_GEMINI_38_FLASH_MODEL_ID).order).toBeLessThan(at(FUCKBUFF_GPT_61_SOL_MODEL_ID).order)
    // Not badged Recommended since 2026-10-07: Optimized's own pick is the one.
    expect(at(FUCKBUFF_DEEPSEEK_V4_FLASH_FAST_MODEL_ID)).toEqual({ section: 'powerful', order: 20 })
  })

  test('every listed compiled model has an explicit place', () => {
    const placed = new Set(FUCKBUFF_PICKER_PLACED_IDS)
    expect(FUCKBUFF_MODELS.map((m) => m.id).filter((id) => !placed.has(id))).toEqual([])
  })

  test('the first placed name wins', () => {
    expect(
      fuckbuffPickerPlacement(['m-unknown', FUCKBUFF_GPT_6_LUNA_MODEL_ID], none).section,
    ).toBe('optimized')
  })

  test('an unplaced row is inferred and tucked under More', () => {
    expect(fuckbuffPickerPlacement(['x'], { ...none, premium: true })).toMatchObject({ section: 'powerful', more: true })
    expect(fuckbuffPickerPlacement(['x'], { ...none, locked: true }).section).toBe('powerful')
    expect(fuckbuffPickerPlacement(['x'], { ...none, price: 0 })).toMatchObject({ section: 'unlimited', more: true })
    expect(fuckbuffPickerPlacement(['x'], { ...none, price: 10 }).section).toBe('optimized')
  })
})

describe('fuckbuffPickerSections', () => {
  test('groups in section order by placement order, More rows last, empty sections dropped', () => {
    const rows = [
      FUCKBUFF_GEMINI_38_FLASH_MODEL_ID,
      'unplaced-cheap',
      FUCKBUFF_GPT_6_LUNA_MODEL_ID,
      FUCKBUFF_DEEPSEEK_V4_FLASH_FAST_MODEL_ID,
      FUCKBUFF_GLM_V53_FLASH_MODEL_ID,
      FUCKBUFF_MIMO_V25_MODEL_ID,
    ]
    const sections = fuckbuffPickerSections(rows, (id) =>
      fuckbuffPickerPlacement([id], { ...none, price: 10 }),
    )
    expect(sections.map(({ section, models }) => [section.id, models])).toEqual([
      [
        'optimized',
        [
          FUCKBUFF_MIMO_V25_MODEL_ID,
          FUCKBUFF_GLM_V53_FLASH_MODEL_ID,
          FUCKBUFF_GPT_6_LUNA_MODEL_ID,
          'unplaced-cheap',
        ],
      ],
      [
        'powerful',
        [FUCKBUFF_DEEPSEEK_V4_FLASH_FAST_MODEL_ID, FUCKBUFF_GEMINI_38_FLASH_MODEL_ID],
      ],
    ])
  })
})

describe('fuckbuffPickerSectionsFor', () => {
  test('Unlimited is last, except at the limited tier, where it leads', () => {
    const ids = (tier: 'full' | 'limited') =>
      fuckbuffPickerSectionsFor(tier).map(({ id }) => id)
    expect(ids('full')).toEqual(['optimized', 'powerful', 'unlimited'])
    expect(ids('limited')).toEqual(['unlimited', 'optimized', 'powerful'])
  })
})

describe('fuckbuffRowPlacement', () => {
  test('the server’s place wins for a section the picker draws', () => {
    expect(
      fuckbuffRowPlacement(
        { section: 'powerful', order: 0, recommended: true },
        FUCKBUFF_PICKER_SECTIONS,
        [FUCKBUFF_MIMO_V25_MODEL_ID],
        none,
      ),
    ).toEqual({ section: 'powerful', order: 0, recommended: true })
  })

  test('no server place, or a section the picker does not have: the compiled place', () => {
    const compiled = fuckbuffPickerPlacement([FUCKBUFF_MIMO_V25_MODEL_ID], none)
    expect(
      fuckbuffRowPlacement(undefined, FUCKBUFF_PICKER_SECTIONS, [FUCKBUFF_MIMO_V25_MODEL_ID], none),
    ).toEqual(compiled)
    expect(
      fuckbuffRowPlacement(
        { section: 'gone', order: 0 },
        FUCKBUFF_PICKER_SECTIONS,
        [FUCKBUFF_MIMO_V25_MODEL_ID],
        none,
      ),
    ).toEqual(compiled)
  })

  test('sections are drawn in the order the server sends them', () => {
    const sections = [
      { id: 'b', label: 'B', tooltip: '' },
      { id: 'a', label: 'A', tooltip: '' },
    ]
    const grouped = fuckbuffPickerSections(
      ['x', 'y'],
      (id) => ({ section: id === 'x' ? 'a' : 'b', order: 0 }),
      sections,
    )
    expect(grouped.map(({ section, models }) => [section.id, models])).toEqual([
      ['b', ['y']],
      ['a', ['x']],
    ])
  })
})
