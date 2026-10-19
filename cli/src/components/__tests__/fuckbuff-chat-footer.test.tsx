import { beforeAll, expect, test } from 'bun:test'
import { createTestRenderer } from '@opentui/core/testing'
import { createRoot, flushSync } from '@opentui/react'
import { FUCKBUFF_GLM_V53_FLASH_MODEL_ID } from '@codebuff/common/constants/fuckbuff-models'
import { FuckbuffChatFooter } from '../fuckbuff-chat-footer'
import { initializeThemeStore } from '../../hooks/use-theme'
import { useChatStore } from '../../state/chat-store'
import { useFuckbuffModelStore } from '../../state/fuckbuff-model-store'
import { useFuckbuffChatStore } from '../../state/fuckbuff-chat-store'

beforeAll(initializeThemeStore)

test.each([120, 42])(
  'footer reflects model, reasoning and chat name at %s columns',
  async (width) => {
    const previousModel = useFuckbuffModelStore.getState()
    const previousNext = useFuckbuffChatStore.getState().nextModel
    const previousMessages = useChatStore.getState().messages
    const setup = await createTestRenderer({ width, height: 5 })
    const root = createRoot(setup.renderer)
    try {
      useFuckbuffModelStore.setState({
        selectedModel: FUCKBUFF_GLM_V53_FLASH_MODEL_ID,
        reasoningEffortByModel: {},
      })
      useFuckbuffChatStore.setState({ nextModel: null })
      useChatStore.setState({ messages: [] })
      flushSync(() =>
        root.render(<FuckbuffChatFooter projectRoot="/tmp/project" />),
      )
      await setup.renderOnce()
      expect(setup.captureCharFrame().replace(/\s+/g, ' ')).toContain('Chat: New chat')
      flushSync(() => {
        useFuckbuffModelStore.setState({
          reasoningEffortByModel: { [FUCKBUFF_GLM_V53_FLASH_MODEL_ID]: 'low' },
        })
        useChatStore.setState({
          messages: [
            {
              id: 'first',
              variant: 'user',
              content: 'Build a game',
              timestamp: new Date().toISOString(),
            },
          ],
        })
      })
      await setup.renderOnce()
      const frame = setup.captureCharFrame().replace(/\s+/g, ' ')
      expect(frame).toContain('GLM 5.3 Flash • low')
      expect(frame).toContain('/tmp/project')
      expect(frame).toContain('Chat: Build a game')
    } finally {
      flushSync(() => root.unmount())
      setup.renderer.destroy()
      useFuckbuffModelStore.setState(previousModel)
      useFuckbuffChatStore.setState({ nextModel: previousNext })
      useChatStore.setState({ messages: previousMessages })
    }
  },
)
