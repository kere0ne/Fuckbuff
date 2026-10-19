import { afterEach, describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  FUCKBUFF_DEEPSEEK_V4_FLASH_MODEL_ID,
  getFuckbuffModelDefaultEffort,
} from '@codebuff/common/constants/fuckbuff-models'
import {
  useFuckbuffModelStore,
  getFuckbuffReasoningEffortForModel,
  getEffectiveFuckbuffReasoningEffort,
} from '../../state/fuckbuff-model-store'

const previous = useFuckbuffModelStore.getState().reasoningEffortByModel
afterEach(() =>
  useFuckbuffModelStore.setState({ reasoningEffortByModel: previous }),
)

describe('per-model reasoning', () => {
  const model = FUCKBUFF_DEEPSEEK_V4_FLASH_MODEL_ID
  test('uses the catalog default without sending an override', () => {
    useFuckbuffModelStore.setState({ reasoningEffortByModel: {} })
    expect(getFuckbuffReasoningEffortForModel(model)).toBeNull()
    expect(getEffectiveFuckbuffReasoningEffort(model)).toBe(
      getFuckbuffModelDefaultEffort(model),
    )
  })
  test('uses supported overrides and ignores stale unsupported levels', () => {
    useFuckbuffModelStore.setState({
      reasoningEffortByModel: { [model]: 'low' },
    })
    expect(getFuckbuffReasoningEffortForModel(model)).toBe('low')
    useFuckbuffModelStore.setState({
      reasoningEffortByModel: { [model]: 'xhigh' },
    })
    expect(getFuckbuffReasoningEffortForModel(model)).toBeNull()
  })
})

/**
 * The send path, asserted by reading the source for the same reason the runner's
 * effortForwarding test does: an absent metadata field IS how "use the default"
 * is expressed, so a dropped value is invisible to every other test.
 */
describe('the CLI turn carries the chosen effort', () => {
  const source = readFileSync(
    join(import.meta.dir, '..', '..', 'hooks', 'use-send-message.ts'),
    'utf8',
  )

  test('it reaches extraCodebuffMetadata under the name the server reads', () => {
    const metadata = source.slice(source.indexOf('extraCodebuffMetadata:'))
    expect(metadata).toContain('fuckbuff_reasoning_effort')
    expect(metadata).toContain('fuckbuffReasoningEffort')
  })
})
