import { describe, expect, test } from 'bun:test'

describe('fuckbuff command aliases', () => {
  test.each(['true', 'false'])('model and reasoning commands respect FUCKBUFF_MODE=%s', (fuckbuffMode) => {
    const slashCommandsUrl = new URL(
      '../../data/slash-commands.ts',
      import.meta.url,
    ).href
    const commandRegistryUrl = new URL(
      '../command-registry.ts',
      import.meta.url,
    ).href

    const result = Bun.spawnSync({
      cmd: [
        'bun',
        '--eval',
        `
          import { SLASH_COMMANDS } from ${JSON.stringify(slashCommandsUrl)}
          import { findCommand } from ${JSON.stringify(commandRegistryUrl)}
          import { useFuckbuffChatStore, openFuckbuffModelPicker } from ${JSON.stringify(new URL('../../state/fuckbuff-chat-store.ts', import.meta.url).href)}
          import { useFuckbuffModelStore } from ${JSON.stringify(new URL('../../state/fuckbuff-model-store.ts', import.meta.url).href)}
          import { useFuckbuffSessionStore } from ${JSON.stringify(new URL('../../state/fuckbuff-session-store.ts', import.meta.url).href)}
          import { getFuckbuffModelDirectory } from ${JSON.stringify(new URL('../../state/fuckbuff-catalog-store.ts', import.meta.url).href)}
          import assert from 'node:assert/strict'

          if (process.env.FUCKBUFF_MODE !== 'true') {
            for (const name of ['reasoning', 'effort', 'think']) {
              assert.equal(findCommand(name), undefined)
              assert.equal(SLASH_COMMANDS.some(cmd => cmd.id === name || cmd.aliases?.includes(name)), false)
            }
            process.exit(0)
          }

          const endSession = SLASH_COMMANDS.find((cmd) => cmd.id === 'end-session')
          if (!endSession) throw new Error('end-session slash command missing')
          if (endSession.aliases?.includes('model')) {
            throw new Error('model must not end the session')
          }

          const modelCommand = findCommand('model')
          if (!modelCommand) throw new Error('model command alias missing')
          if (modelCommand.name !== 'model') {
            throw new Error('model must resolve to its own command')
          }

          const model = 'z-ai/glm-5.3-flash'
          const activeModel = 'mimo/mimo-v2.5'
          useFuckbuffModelStore.setState({ selectedModel: activeModel })
          useFuckbuffChatStore.setState({ nextModel: model })
          const directory = getFuckbuffModelDirectory()
          const effortsBefore = useFuckbuffModelStore.getState().reasoningEffortByModel
          const sessionBefore = useFuckbuffSessionStore.getState().session
          let messages = []
          let history = []
          let input
          const params = {
            inputValue: '/reasoning',
            saveToHistory: value => history.push(value),
            setInputValue: value => { input = value },
            setMessages: update => { messages = update(messages) },
            sendMessage: () => { throw new Error('must not send a prompt') },
          }
          const menu = SLASH_COMMANDS.find(cmd => cmd.id === 'reasoning')
          assert.ok(menu)
          assert.deepEqual(menu.aliases, ['effort', 'think'])
          for (const name of ['reasoning', 'effort', 'think']) {
            useFuckbuffChatStore.setState({ pickerOpen: false, pickerInitialView: 'model' })
            const command = findCommand(name)
            assert.equal(command?.name, 'reasoning')
            await command.handler(params, '')
            assert.equal(useFuckbuffChatStore.getState().pickerOpen, true)
            assert.equal(useFuckbuffChatStore.getState().pickerInitialView, 'reasoning')
            assert.equal(useFuckbuffChatStore.getState().nextModel, model)
            assert.equal(useFuckbuffChatStore.getState().admission, null)
            assert.equal(useFuckbuffModelStore.getState().selectedModel, activeModel)
            assert.equal(useFuckbuffModelStore.getState().reasoningEffortByModel, effortsBefore)
            assert.equal(useFuckbuffSessionStore.getState().session, sessionBefore)
          }
          assert.deepEqual(messages, [])
          assert.equal(history.length, 3)
          assert.equal(input.text, '')

          openFuckbuffModelPicker()
          assert.equal(useFuckbuffChatStore.getState().pickerInitialView, 'model')
          useFuckbuffChatStore.setState({ pickerOpen: false, admission: { phase: 'starting', model } })
          await findCommand('reasoning').handler(params, '')
          assert.equal(useFuckbuffChatStore.getState().pickerOpen, false)

          const fixedModel = directory.pickerModels('full', true).find(row => !directory.efforts(row.id)?.length)
          assert.ok(fixedModel, 'fixture needs a model without an effort ladder')
          useFuckbuffChatStore.setState({ admission: null, nextModel: fixedModel.id })
          await findCommand('reasoning').handler(params, '')
          assert.equal(useFuckbuffChatStore.getState().pickerOpen, false)
          assert.ok(JSON.stringify(messages).includes('does not offer adjustable reasoning'))
        `,
      ],
      cwd: process.cwd(),
      env: {
        ...process.env,
        FUCKBUFF_MODE: fuckbuffMode,
        NODE_ENV: 'test',
        NEXT_PUBLIC_CB_ENVIRONMENT: 'test',
        NEXT_PUBLIC_CODEBUFF_APP_URL: 'https://app.codebuff.test',
        NEXT_PUBLIC_SUPPORT_EMAIL: 'support@codebuff.test',
        NEXT_PUBLIC_POSTHOG_API_KEY: 'phc_test_key',
        NEXT_PUBLIC_POSTHOG_HOST_URL: 'https://posthog.codebuff.test',
        NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_test_123',
        NEXT_PUBLIC_STRIPE_CUSTOMER_PORTAL: 'https://stripe.codebuff.test',
        NEXT_PUBLIC_WEB_PORT: '3000',
      },
      stderr: 'pipe',
      stdout: 'pipe',
    })

    const stderr = new TextDecoder().decode(result.stderr)
    expect(result.exitCode, stderr).toBe(0)
  }, 15_000)
})
