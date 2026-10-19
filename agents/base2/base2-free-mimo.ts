import {
  FUCKBUFF_MIMO_V25_MODEL_ID,
  getFuckbuffModel,
} from '@codebuff/common/constants/fuckbuff-models'

import { createBase2 } from './base2'

const definition = {
  ...createBase2('free', {
    model: FUCKBUFF_MIMO_V25_MODEL_ID,
    modelLabel: getFuckbuffModel(FUCKBUFF_MIMO_V25_MODEL_ID).displayName,
  }),
  id: 'base2-free-mimo',
  displayName: 'Buffy the MiMo Free Orchestrator',
}

export default definition
