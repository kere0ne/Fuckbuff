import { FUCKBUFF_GLM_V52_MODEL_ID } from '@codebuff/common/constants/fuckbuff-models'

import { createBase3CliRoot } from './base3'

const definition = {
  ...createBase3CliRoot({
    model: FUCKBUFF_GLM_V52_MODEL_ID,
    isFuckbuff: true,
  }),
  id: 'base3-free-glm',
  displayName: 'Buffy on GLM 5.2',
}

export default definition
