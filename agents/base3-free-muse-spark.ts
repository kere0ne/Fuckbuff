import { FUCKBUFF_MUSE_SPARK_12_CONTRIBUTOR_MODEL_ID } from '@codebuff/common/constants/fuckbuff-models'

import { createBase3CliRoot } from './base3'

/**
 * Muse Spark 1.2 Contributor on the CLI, and by the shared root id on Desktop.
 *
 * Restored on 2026-09-07, when 1.3 was withdrawn.
 *
 * Uses the single-loop harness, which keeps the provider request count per
 * turn low. No `reasoningOptions`, like every Fuckbuff root — the catalog owns the ladder
 * and the server fills it in, so the picker and the wire cannot drift.
 */
const definition = {
  ...createBase3CliRoot({
    model: FUCKBUFF_MUSE_SPARK_12_CONTRIBUTOR_MODEL_ID,
    isFuckbuff: true,
  }),
  id: 'base3-free-muse-spark',
  displayName: 'Buffy on Muse Spark 1.2',
}

export default definition
