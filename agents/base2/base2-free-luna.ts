import {
  FUCKBUFF_GPT_5_6_LUNA_MODEL_ID,
  FUCKBUFF_GPT_5_6_LUNA_REASONING_EFFORT,
} from '@codebuff/common/constants/fuckbuff-models'

import { createBase2 } from './base2'

const definition = {
  ...createBase2('free', {
    model: FUCKBUFF_GPT_5_6_LUNA_MODEL_ID,
  }),
  id: 'base2-free-luna',
  displayName: 'Buffy the GPT-5.6 Luna Free Orchestrator',
  // Luna is cheap enough per token that high effort is worth the reasoning
  // tokens. The server applies the same default (applyFuckbuffReasoningDefaults)
  // for callers that don't come through a bundled agent; both read the shared
  // constant so they can't drift.
  reasoningOptions: {
    enabled: true,
    effort: FUCKBUFF_GPT_5_6_LUNA_REASONING_EFFORT,
  },
}

export default definition
