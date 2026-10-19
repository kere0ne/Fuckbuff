import { FUCKBUFF_MIMO_V26_PRO_MODEL_ID } from '@codebuff/common/constants/fuckbuff-models'

import { createBase3CliRoot } from './base3'

/** MiMo 2.6 Pro on the CLI (and, by the shared root id, the Desktop). */
const definition = {
  ...createBase3CliRoot({
    model: FUCKBUFF_MIMO_V26_PRO_MODEL_ID,
    isFuckbuff: true,
  }),
  id: 'base3-free-mimo-2-6-pro',
  displayName: 'Buffy on MiMo 2.6 Pro',
}

export default definition
