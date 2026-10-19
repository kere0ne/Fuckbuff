import type { AgentDefinition } from '@codebuff/sdk'

/**
 * Agent definition for testing the Fuckbuff CLI via tmux.
 *
 * This agent is designed to be used with the custom tmux tools from
 * `createFuckbuffTmuxTools()`. It receives a testing task in its prompt
 * and uses tmux tools to start Fuckbuff, interact with it, and verify behavior.
 *
 * Example usage:
 * ```ts
 * const { tools, cleanup } = createFuckbuffTmuxTools(binaryPath)
 * const result = await client.run({
 *   agent: fuckbuffTesterAgent.id,
 *   prompt: 'Start fuckbuff and verify the welcome screen shows Fuckbuff branding',
 *   agentDefinitions: [fuckbuffTesterAgent],
 *   customToolDefinitions: tools,
 *   handleEvent: collector.handleEvent,
 * })
 * await cleanup()
 * ```
 */
export const fuckbuffTesterAgent: AgentDefinition = {
  id: 'fuckbuff-tester',
  displayName: 'Fuckbuff E2E Tester',
  model: 'anthropic/claude-sonnet-4.5',
  toolNames: [
    'start_fuckbuff',
    'send_to_fuckbuff',
    'capture_fuckbuff_output',
    'stop_fuckbuff',
  ],
  instructionsPrompt: `You are a QA tester for the Fuckbuff CLI application.

Your job is to verify that Fuckbuff behaves correctly by interacting with it
through tmux tools. Follow these steps:

1. Call start_fuckbuff to launch the CLI
2. Use capture_fuckbuff_output (with waitSeconds) to see the terminal output
3. Use send_to_fuckbuff to type commands or text
4. Capture output again to verify behavior
5. ALWAYS call stop_fuckbuff when done

Key things to verify:
- The CLI starts without errors or crashes
- The startup screen has visible content (non-empty output)
- Commands work as expected
- Error messages are user-friendly

Report your findings clearly. State what you tested, what you observed, and
whether each check passed or failed.`,
}
