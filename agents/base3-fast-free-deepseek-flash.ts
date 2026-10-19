import { FUCKBUFF_BASE3_FAST_AGENT_ID } from '@codebuff/common/constants/free-agents'
import { FUCKBUFF_DEEPSEEK_V4_FLASH_FAST_MODEL_ID } from '@codebuff/common/constants/fuckbuff-models'

import { createBase3FastCliRoot } from './base3-fast'

/** DeepSeek V4.1 Flash, fast mode: the base3-fast root on DeepSeek's own API. */
const definition = {
  ...createBase3FastCliRoot(FUCKBUFF_DEEPSEEK_V4_FLASH_FAST_MODEL_ID),
  id: FUCKBUFF_BASE3_FAST_AGENT_ID,
  displayName: 'Buffy on DeepSeek Flash (fast mode)',
}

export default definition
