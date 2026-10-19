import { FUCKBUFF_BASE3_FAST_WORKER_AGENT_ID } from '@codebuff/common/constants/free-agents'
import { FUCKBUFF_DEEPSEEK_V4_FLASH_FAST_MODEL_ID } from '@codebuff/common/constants/fuckbuff-models'

import { createBase3FastWorker } from './base3-fast'

/** The parallel worker a fast-mode DeepSeek Flash root spawns; pinned to the
 *  root's own model so the session gate accepts it. */
const definition = {
  ...createBase3FastWorker(FUCKBUFF_DEEPSEEK_V4_FLASH_FAST_MODEL_ID),
  id: FUCKBUFF_BASE3_FAST_WORKER_AGENT_ID,
  displayName: 'Buffy Worker on DeepSeek Flash',
}

export default definition
