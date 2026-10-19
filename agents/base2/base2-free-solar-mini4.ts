import { FUCKBUFF_SOLAR_MINI_4_MODEL_ID } from '@codebuff/common/constants/fuckbuff-models'

import { createBase2 } from './base2'

const definition = {
  ...createBase2('free', {
    model: FUCKBUFF_SOLAR_MINI_4_MODEL_ID,
  }),
  id: 'base2-free-solar-mini4',
  displayName: 'Buffy the Solar Mini 4 Free Orchestrator',
}

export default definition
