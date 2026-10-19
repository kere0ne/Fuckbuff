import { describe, expect, test } from 'bun:test'

import {
  compactionPolicyForModel,
  DEEPSEEK_FLASH_COMPACTION_POLICY,
  DEFAULT_COMPACTION_POLICY,
} from '../constants/compaction-policy'
import {
  FUCKBUFF_DEEPSEEK_V4_FLASH_MODEL_ID,
  SUPPORTED_FUCKBUFF_MODELS,
} from '../constants/fuckbuff-models'

describe('compactionPolicyForModel', () => {
  test('DeepSeek Flash gets 15 minutes / 40k; every other model the hour / 140k', () => {
    expect(compactionPolicyForModel(FUCKBUFF_DEEPSEEK_V4_FLASH_MODEL_ID)).toBe(
      DEEPSEEK_FLASH_COMPACTION_POLICY,
    )
    expect(DEEPSEEK_FLASH_COMPACTION_POLICY).toEqual({
      cacheExpiryMs: 15 * 60 * 1000,
      cacheExpiryMinTokens: 40_000,
    })
    for (const { id } of SUPPORTED_FUCKBUFF_MODELS) {
      if (id === FUCKBUFF_DEEPSEEK_V4_FLASH_MODEL_ID) continue
      expect(compactionPolicyForModel(id)).toBe(DEFAULT_COMPACTION_POLICY)
    }
    expect(compactionPolicyForModel(undefined)).toBe(DEFAULT_COMPACTION_POLICY)
    expect(DEFAULT_COMPACTION_POLICY).toEqual({
      cacheExpiryMs: 60 * 60 * 1000,
      cacheExpiryMinTokens: 140_000,
    })
  })
})
