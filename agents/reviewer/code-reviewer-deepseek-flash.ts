import { FUCKBUFF_DEEPSEEK_V4_FLASH_MODEL_ID } from '@codebuff/common/constants/fuckbuff-models'

import { publisher } from '../constants'
import type { SecretAgentDefinition } from '../types/secret-agent-definition'
import { createReviewer } from './code-reviewer'

const definition: SecretAgentDefinition = {
  id: 'code-reviewer-deepseek-flash',
  publisher,
  ...createReviewer(FUCKBUFF_DEEPSEEK_V4_FLASH_MODEL_ID),
}

export default definition
