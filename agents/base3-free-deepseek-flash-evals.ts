import { FUCKBUFF_DEEPSEEK_V4_FLASH_MODEL_ID } from '@codebuff/common/constants/fuckbuff-models'

import { createBase3CliRoot } from './base3'

/**
 * base3 on DeepSeek V4 Flash 07/31 — the other arm of the comparison.
 *
 * Same model, same `noAskUser`, same Fuckbuff branding as the shipped
 * base3-free-deepseek-flash root. The only difference from the base2 arm is the
 * harness itself, which is the whole point.
 */
const definition = {
  ...createBase3CliRoot({
    model: FUCKBUFF_DEEPSEEK_V4_FLASH_MODEL_ID,
    isFuckbuff: true,
    noAskUser: true,
    // Neither arm may read the public repository under evaluation off the web:
    // read_url is refused by the bench, and a search result quoting its current
    // code is the answer key. Both arms lose the two tools together.
    noWeb: true,
  }),
  id: 'base3-free-deepseek-flash-evals',
  displayName: 'Buffy on DeepSeek Flash (evals)',
}

export default definition
