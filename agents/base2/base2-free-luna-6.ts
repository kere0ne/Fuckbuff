import {
  FUCKBUFF_GPT_6_LUNA_MODEL_ID,
  FUCKBUFF_GPT_6_LUNA_REASONING_EFFORT,
} from '@codebuff/common/constants/fuckbuff-models'

import { createBase2 } from './base2'

// The base2 rollback root for GPT-6 Luna, bundled alongside its base3 twin so
// the FUCKBUFF_BASE3_HARNESS_DISABLED kill switch has somewhere to route.
const definition = {
  ...createBase2('free', {
    model: FUCKBUFF_GPT_6_LUNA_MODEL_ID,
  }),
  id: 'base2-free-luna-6',
  displayName: 'Buffy the GPT-6 Luna Free Orchestrator',
  // Same rule as base2-free-luna: the server applies this default too
  // (applyFuckbuffReasoningDefaults), both reading the shared constant.
  reasoningOptions: {
    enabled: true,
    effort: FUCKBUFF_GPT_6_LUNA_REASONING_EFFORT,
  },
}

export default definition
