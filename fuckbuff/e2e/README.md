# Fuckbuff E2E Tests

End-to-end tests for the Fuckbuff CLI binary. Tests verify that the compiled binary works correctly by interacting with it via tmux.

## Architecture

Two testing approaches are supported:

### 1. Direct tmux tests (fast, deterministic)

Use the `FuckbuffSession` class to start the binary in tmux, send commands, capture output, and assert directly.

```typescript
import { describe, test, expect, afterEach } from 'bun:test'
import { FuckbuffSession, requireFuckbuffBinary } from '../utils'

describe('My Feature', () => {
  let session: FuckbuffSession | null = null

  afterEach(async () => {
    if (session) await session.stop()
    session = null
  })

  test('works correctly', async () => {
    const binary = requireFuckbuffBinary()
    session = await FuckbuffSession.start(binary)

    await session.send('/help')
    const output = await session.capture(2)

    expect(output).toContain('Shortcuts')
  }, 60_000)
})
```

### 2. SDK agent-driven tests (AI-powered verification)

Use the Codebuff SDK to run a testing agent that interacts with Fuckbuff via custom tmux tools. The agent reasons about the CLI output and verifies complex behaviors.

```typescript
import { describe, test, expect, afterEach } from 'bun:test'
import { CodebuffClient } from '@codebuff/sdk'
import { fuckbuffTesterAgent } from '../agent/fuckbuff-tester'
import { createFuckbuffTmuxTools, requireFuckbuffBinary } from '../utils'

describe('Agent Test', () => {
  let cleanup: (() => Promise<void>) | null = null

  afterEach(async () => {
    if (cleanup) await cleanup()
    cleanup = null
  })

  test('verifies startup', async () => {
    const apiKey = process.env.CODEBUFF_API_KEY
    if (!apiKey) return // Skip if no API key

    const binary = requireFuckbuffBinary()
    const tmuxTools = createFuckbuffTmuxTools(binary)
    cleanup = tmuxTools.cleanup

    const client = new CodebuffClient({ apiKey })
    const result = await client.run({
      agent: fuckbuffTesterAgent.id,
      prompt: 'Start Fuckbuff and verify the branding is correct.',
      agentDefinitions: [fuckbuffTesterAgent],
      customToolDefinitions: tmuxTools.tools,
      handleEvent: () => {},
    })

    expect(result.output.type).not.toBe('error')
  }, 180_000)
})
```

### 3. Live smoke against production

`tests/live-turn.e2e.test.ts` is the one file here that talks to the real backend:
it navigates the landing picker to DeepSeek V4.1 Flash, starts a session, sends a
prompt, waits for the answer, then runs `/end-session` and checks the backend shows
no open session. It skips unless `FUCKBUFF_SMOKE_API_KEY` (or
`CODEBUFF_API_KEY`) is set, and needs a binary built with the production public
env. It is not in `fuckbuff-e2e.yml` — `.github/workflows/prod-smoke.yml`
runs it on a schedule and before each release.

```bash
NEXT_PUBLIC_CB_ENVIRONMENT=prod NEXT_PUBLIC_CODEBUFF_APP_URL=https://www.codebuff.com \
NEXT_PUBLIC_FUCKBUFF_APP_URL=https://freebuff.com NEXT_PUBLIC_SUPPORT_EMAIL=support@freebuff.com \
NEXT_PUBLIC_POSTHOG_API_KEY=test NEXT_PUBLIC_POSTHOG_HOST_URL=http://127.0.0.1:9 \
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=test NEXT_PUBLIC_STRIPE_CUSTOMER_PORTAL=http://127.0.0.1:9 \
NEXT_PUBLIC_WEB_PORT=3000 bun fuckbuff/cli/build.ts 0.0.0-smoke
CODEBUFF_API_KEY=<your token> bun test fuckbuff/e2e/tests/live-turn.e2e.test.ts --timeout=300000
```

The CLI runs with its own `FUCKBUFF_CONFIG_DIR`, so your real profile is untouched.

## Prerequisites

- **tmux** must be installed: `brew install tmux` (macOS) or `sudo apt-get install tmux` (Ubuntu)
- **Fuckbuff binary** must be built: `bun fuckbuff/cli/build.ts 0.0.0-dev`
- **SDK built** (for agent tests): `cd sdk && bun run build`
- **CODEBUFF_API_KEY** (for agent tests only): Set this environment variable

## Running Tests

### Build the binary first

```bash
bun fuckbuff/cli/build.ts 0.0.0-dev
```

### Run all tests

```bash
bun test fuckbuff/e2e/tests/
```

### Run a specific test

```bash
bun test fuckbuff/e2e/tests/version.e2e.test.ts
bun test fuckbuff/e2e/tests/startup.e2e.test.ts
bun test fuckbuff/e2e/tests/help-command.e2e.test.ts
bun test fuckbuff/e2e/tests/agent-startup.e2e.test.ts
```

### Use a custom binary path

```bash
FUCKBUFF_BINARY=/path/to/fuckbuff bun test fuckbuff/e2e/tests/
```

## Adding New Tests

1. Create a new file in `fuckbuff/e2e/tests/` with the naming convention `<feature>.e2e.test.ts`
2. Add an `e2e - <name>` step to the `build-and-e2e-fuckbuff` job in
   `.github/workflows/fuckbuff-e2e.yml`, with the same `if:` as its siblings so it
   still runs when another suite fails. Keep it off the network: that job has no
   credentials, so anything that needs a real backend belongs in `prod-smoke.yml`.

## CI Workflow

The `.github/workflows/fuckbuff-e2e.yml` workflow:

1. **Builds** the Fuckbuff binary once (linux-x64) and smoke-boots it
2. **Runs each suite as its own step** in that same job, against that binary
3. **Uploads tmux session logs** on failure for debugging
4. **Builds and smoke-boots on Windows** in a separate job (no tmux there)

Triggers: pull requests to `main` or `great-db-merge-v2`, pushes to `main`, manual
`workflow_dispatch`, and `fuckbuff-release.yml` before each release.

## Utilities Reference

### `FuckbuffSession`

| Method | Description |
|--------|-------------|
| `FuckbuffSession.start(binaryPath)` | Start binary in tmux, returns session |
| `session.send(text)` | Send text input (presses Enter) |
| `session.sendKey(key)` | Send special key (e.g. `'C-c'`, `'Escape'`) |
| `session.capture(waitSec?)` | Capture terminal output |
| `session.captureLabeled(label, waitSec?)` | Capture and save to session logs |
| `session.waitForText(pattern, timeoutMs?)` | Poll until text appears |
| `session.stop()` | Stop session and clean up |

### `createFuckbuffTmuxTools(binaryPath)`

Creates SDK custom tools for agent-driven testing:
- `start_fuckbuff` - Launch the CLI
- `send_to_fuckbuff` - Send text input
- `capture_fuckbuff_output` - Capture terminal output
- `stop_fuckbuff` - Stop and clean up

### Helper functions

| Function | Description |
|----------|-------------|
| `requireFuckbuffBinary()` | Get binary path, throws if not found |
| `getFuckbuffBinaryPath()` | Get binary path (may not exist) |
