import { FUCKBUFF_DEEPSEEK_V4_PRO_MODEL_ID } from '@codebuff/common/constants/fuckbuff-models'

import { createBase3CliRoot } from './base3'

/**
 * Fuckbuff CLI on DeepSeek V4 Pro, running the base3 single-loop harness.
 *
 * Shares its id with the Web/Cloud root of the same name — the two surfaces
 * ship separate definitions under one id, exactly as the `base2-free-*` family
 * already does, and split in the DB by `message.surface`.
 */
const definition = {
  ...createBase3CliRoot({
    model: FUCKBUFF_DEEPSEEK_V4_PRO_MODEL_ID,
    isFuckbuff: true,
  }),
  id: 'base3-free-deepseek',
  displayName: 'Buffy on DeepSeek',
}

export default definition
