import { FUCKBUFF_GEMINI_4_ARGON_MODEL_ID } from '@codebuff/common/constants/fuckbuff-models'

import { createBase3CliRoot } from './base3'

/**
 * Gemini 4 Argon on the CLI (and, by the shared root id, the Desktop). A
 * paid-only row outside the US (FUCKBUFF_PRO_ONLY_EVERY_SURFACE_MODEL_IDS);
 * admission is the gate.
 *
 * No `reasoningOptions`, like every base3 root: the catalog owns the ladder and
 * the server fills the effort in, so the picker and the wire cannot drift.
 */
const definition = {
  ...createBase3CliRoot({
    model: FUCKBUFF_GEMINI_4_ARGON_MODEL_ID,
    isFuckbuff: true,
  }),
  id: 'base3-free-gemini-4-argon',
  displayName: 'Buffy on Gemini 4 Argon',
}

export default definition
