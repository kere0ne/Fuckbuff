import {
  FUCKBUFF_GPT_61_SOL_MODEL_ID,
  FUCKBUFF_GPT_61_SOL_REASONING_EFFORT,
} from '@codebuff/common/constants/fuckbuff-models'

import { createBase2 } from './base2'

// The base2 rollback root for GPT-6.1 Sol, bundled alongside its base3 twin so
// the FUCKBUFF_BASE3_HARNESS_DISABLED kill switch has somewhere to route.
const definition = {
  ...createBase2('free', {
    model: FUCKBUFF_GPT_61_SOL_MODEL_ID,
  }),
  id: 'base2-free-gpt-6-1-sol',
  displayName: 'Buffy the GPT-6.1 Sol Free Orchestrator',
  // The server applies this default too (applyFuckbuffReasoningDefaults), both
  // reading the shared constant.
  reasoningOptions: {
    enabled: true,
    effort: FUCKBUFF_GPT_61_SOL_REASONING_EFFORT,
  },
}

export default definition
