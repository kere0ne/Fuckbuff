import { FUCKBUFF_MINIMAX_M3_MODEL_ID } from '@codebuff/common/constants/fuckbuff-models'

import { createBase3CliRoot } from './base3'

const definition = {
  ...createBase3CliRoot({
    model: FUCKBUFF_MINIMAX_M3_MODEL_ID,
    isFuckbuff: true,
  }),
  id: 'base3-free-minimax-m3',
  displayName: 'Buffy on MiniMax M3',
}

export default definition
