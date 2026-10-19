import { Button } from './button'
import { useTheme } from '../hooks/use-theme'
import { useChatStore } from '../state/chat-store'
import { useFuckbuffModelDirectory } from '../state/fuckbuff-catalog-store'
import {
  useFuckbuffChatStore,
  openFuckbuffModelPicker,
} from '../state/fuckbuff-chat-store'
import {
  useFuckbuffModelStore,
  getEffectiveFuckbuffReasoningEffort,
} from '../state/fuckbuff-model-store'
import { getFirstUserPrompt } from '../utils/chat-meta'
import { formatCwd } from '../utils/path-helpers'

export function FuckbuffChatFooter({ projectRoot }: { projectRoot: string }) {
  const theme = useTheme()
  const selected = useFuckbuffModelStore((s) => s.selectedModel)
  useFuckbuffModelStore((s) => s.reasoningEffortByModel)
  const nextModel = useFuckbuffChatStore((s) => s.nextModel)
  const directory = useFuckbuffModelDirectory()
  const model = directory.get(nextModel ?? selected)
  const effort = getEffectiveFuckbuffReasoningEffort(model.id)
  const name = useChatStore((s) => getFirstUserPrompt(s.messages))
  return (
    <box style={{ flexDirection: 'column', flexShrink: 0, paddingLeft: 1 }}>
      <Button onClick={openFuckbuffModelPicker}>
        <text style={{ wrapMode: 'word', fg: theme.foreground }}>
          <span
            fg={theme.primary}
          >{`${model.displayName}${effort ? ` • ${effort}` : ''}`}</span>
          <span fg={theme.muted}>{` · ${formatCwd(projectRoot)} · `}</span>
          <span fg={theme.primary}>/model</span>
          <span
            fg={theme.muted}
          >{` to change · Chat: ${name === '(empty chat)' ? 'New chat' : name.replace(/\s+/g, ' ')}`}</span>
        </text>
      </Button>
      <text style={{ fg: theme.muted }}>
        <span fg={theme.foreground}>←</span> for history ·{' '}
        <span fg={theme.foreground}>?</span> for help
      </text>
    </box>
  )
}
