import { FUCKBUFF_DEEPSEEK_V4_FLASH_MODEL_ID } from '@codebuff/common/constants/fuckbuff-models'

import { createBase3CliRoot } from './base3'

const definition = {
  ...createBase3CliRoot({
    model: FUCKBUFF_DEEPSEEK_V4_FLASH_MODEL_ID,
    isFuckbuff: true,
  }),
  id: 'base3-free-deepseek-flash',
  displayName: 'Buffy on DeepSeek Flash',
}

export default definition
