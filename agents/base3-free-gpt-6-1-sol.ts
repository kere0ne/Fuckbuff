import { FUCKBUFF_GPT_61_SOL_MODEL_ID } from '@codebuff/common/constants/fuckbuff-models'

import { createBase3CliRoot } from './base3'

/**
 * GPT-6.1 Sol on the CLI (and, by the shared root id, the Desktop). A paid-only
 * row (FUCKBUFF_PRO_ONLY_EVERY_SURFACE_MODEL_IDS); admission is the gate.
 *
 * No `reasoningOptions`, like every base3 root: the catalog owns the ladder and
 * the server fills the effort in, so the picker and the wire cannot drift.
 */
const definition = {
  ...createBase3CliRoot({
    model: FUCKBUFF_GPT_61_SOL_MODEL_ID,
    isFuckbuff: true,
  }),
  id: 'base3-free-gpt-6-1-sol',
  displayName: 'Buffy on GPT-6.1 Sol',
}

export default definition
