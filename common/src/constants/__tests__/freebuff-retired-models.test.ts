import { describe, expect, test } from 'bun:test'

import {
  FUCKBUFF_MODELS,
  FUCKBUFF_PAUSED_FREE_MODEL_IDS,
  FUCKBUFF_SPACE_BUNNY_ALPHA_MODEL_ID,
  fuckbuffRetiredModelMessage,
  getFuckbuffModelsForAccessTier,
  isFuckbuffModelId,
  isFuckbuffRetiredModelId,
  SUPPORTED_FUCKBUFF_MODELS,
} from '../fuckbuff-models'

describe('retired free models', () => {
  test('recognised retired ids are retired; every listed model is not', () => {
    for (const id of [
      'minimax/minimax-m3',
      'minimax/minimax-m3-20260211',
      'z-ai/glm-5.2',
      'stealth/ox-alpha',
      'stealth/ox-alpha-20260820',
      'deepseek/deepseek-v4-pro',
    ])
      expect(isFuckbuffRetiredModelId(id)).toBe(true)
    for (const model of FUCKBUFF_MODELS)
      expect(isFuckbuffRetiredModelId(model.id)).toBe(false)
    expect(isFuckbuffRetiredModelId('some/unknown-model')).toBe(false)
    // Paused, but still a paid path on Fuckbuff's own Luna agents.
    expect(isFuckbuffRetiredModelId('openai/gpt-5.6-luna')).toBe(false)
    expect(isFuckbuffRetiredModelId(null)).toBe(false)
  })

  test('the message names the model and how to update', () => {
    const message = fuckbuffRetiredModelMessage('minimax/minimax-m3')
    expect(message).toContain('MiniMax M3 is no longer available')
    expect(message).toContain('npm install -g fuckbuff@latest')
    expect(message).toContain('Fuckbuff Desktop')
  })
})

test('Space Bunny Alpha is withdrawn: in no picker at any tier, still recognised', () => {
  for (const tier of ['full', 'limited'] as const) {
    expect(
      getFuckbuffModelsForAccessTier(tier).map((m) => m.id),
    ).not.toContain(FUCKBUFF_SPACE_BUNNY_ALPHA_MODEL_ID)
  }
  expect(FUCKBUFF_PAUSED_FREE_MODEL_IDS).toContain(
    FUCKBUFF_SPACE_BUNNY_ALPHA_MODEL_ID,
  )
  expect(isFuckbuffModelId(FUCKBUFF_SPACE_BUNNY_ALPHA_MODEL_ID)).toBe(false)
  expect(
    SUPPORTED_FUCKBUFF_MODELS.some(
      (m) => m.id === FUCKBUFF_SPACE_BUNNY_ALPHA_MODEL_ID,
    ),
  ).toBe(true)
})
