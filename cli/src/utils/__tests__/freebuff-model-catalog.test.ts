import fs from 'fs'
import os from 'os'
import path from 'path'

import {
  DEFAULT_FUCKBUFF_MODEL_ID,
  FUCKBUFF_DEEPSEEK_V4_FLASH_MODEL_ID,
  FUCKBUFF_MIMO_V25_MODEL_ID,
  FUCKBUFF_MIMO_V26_PRO_MODEL_ID,
} from '@codebuff/common/constants/fuckbuff-models'
import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test'

import {
  getFuckbuffCatalog,
  getFuckbuffModelDirectory,
  setFuckbuffCatalog,
  useFuckbuffCatalogStore,
} from '../../state/fuckbuff-catalog-store'
import { useFuckbuffChatStore } from '../../state/fuckbuff-chat-store'
import {
  fuckbuffDefaultModelForSession,
  getEffectiveFuckbuffReasoningEffort,
  getSelectedFuckbuffModel,
  persistFuckbuffModelPick,
  useFuckbuffModelStore,
} from '../../state/fuckbuff-model-store'
import * as auth from '../auth'
import {
  applyFuckbuffCatalog,
  createFuckbuffCatalogController,
  fetchFuckbuffModelCatalog,
  isFuckbuffCatalogStaleError,
  runWithFuckbuffCatalogStaleRetry,
  type FuckbuffCatalogControllerDeps,
  type FuckbuffCatalogFetchResult,
} from '../fuckbuff-model-catalog'
import {
  resolveFuckbuffModelPickForSession,
  resolveFuckbuffModelSelectionForSession,
} from '../../hooks/use-fuckbuff-session'
import {
  getSettingsPath,
  loadSettings,
  saveFuckbuffModelPreference,
} from '../settings'
import { catalogFixture, catalogRow, rotateHandles } from './fuckbuff-catalog-fixtures'

import type { FuckbuffModelCatalog } from '@codebuff/common/types/fuckbuff-model-catalog'

let configDir: string
let configSpy: ReturnType<typeof spyOn>

beforeEach(() => {
  configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fuckbuff-catalog-test-'))
  configSpy = spyOn(auth, 'getConfigDir').mockReturnValue(configDir)
})

afterEach(() => {
  setFuckbuffCatalog(null)
  useFuckbuffCatalogStore.setState({ refreshAfterStale: null })
  useFuckbuffChatStore.setState({ nextModel: null })
  useFuckbuffModelStore.getState().setSelectedModel(DEFAULT_FUCKBUFF_MODEL_ID)
  useFuckbuffModelStore.setState({ reasoningEffortByModel: {} })
  configSpy.mockRestore()
  fs.rmSync(configDir, { recursive: true, force: true })
})

const CATALOG = catalogFixture(
  [
    catalogRow('m-mimo', {
      displayName: 'MiMo',
      legacyIds: [FUCKBUFF_MIMO_V25_MODEL_ID],
    }),
    catalogRow('m-flash', {
      displayName: 'Flash',
      legacyIds: [FUCKBUFF_DEEPSEEK_V4_FLASH_MODEL_ID],
      efforts: ['low', 'high', 'max'],
      defaultEffort: 'high',
    }),
    catalogRow('m-only-here', { displayName: 'Catalog only' }),
  ],
  { recommendedKey: 'm-only-here', fallbackKey: 'm-mimo' },
)

describe('fetchFuckbuffModelCatalog', () => {
  const respond = (response: Response | Error) => {
    const calls: Array<{ url: string; init: RequestInit }> = []
    const fetchImpl = (async (url: string, init: RequestInit) => {
      calls.push({ url, init })
      if (response instanceof Error) throw response
      return response
    }) as unknown as typeof fetch
    return { calls, fetchImpl }
  }

  test('asks with the bearer, the protocol header and the CLI client name', async () => {
    const { calls, fetchImpl } = respond(Response.json(CATALOG))
    const result = await fetchFuckbuffModelCatalog('tok', {
      fetchImpl,
      baseUrl: 'https://api.test',
    })
    expect(result).toEqual({ kind: 'ok', catalog: CATALOG })
    expect(calls[0]!.url).toBe('https://api.test/api/v1/freebuff/models')
    const headers = new Headers(calls[0]!.init.headers)
    expect(headers.get('authorization')).toBe('Bearer tok')
    expect(headers.get('x-fuckbuff-catalog-protocol')).toBe('1')
    expect(headers.get('x-fuckbuff-client')).toBe('cli')
  })

  test('an older server (404) is a definitive "no catalog"', async () => {
    const { fetchImpl } = respond(new Response('not found', { status: 404 }))
    expect((await fetchFuckbuffModelCatalog('tok', { fetchImpl })).kind).toBe(
      'unsupported',
    )
  })

  test('a body this client does not speak is unsupported, not an error', async () => {
    const garbage = respond(Response.json({ protocol: 2, rows: 'nope' }))
    expect(
      (await fetchFuckbuffModelCatalog('tok', { fetchImpl: garbage.fetchImpl }))
        .kind,
    ).toBe('unsupported')
    const notJson = respond(new Response('<html>', { status: 200 }))
    expect(
      (await fetchFuckbuffModelCatalog('tok', { fetchImpl: notJson.fetchImpl }))
        .kind,
    ).toBe('unsupported')
    const empty = respond(Response.json(catalogFixture([])))
    expect(
      (await fetchFuckbuffModelCatalog('tok', { fetchImpl: empty.fetchImpl }))
        .kind,
    ).toBe('unsupported')
  })

  test('network failures and 5xx are transient errors', async () => {
    const down = respond(new Error('fetch failed'))
    expect(
      (await fetchFuckbuffModelCatalog('tok', { fetchImpl: down.fetchImpl }))
        .kind,
    ).toBe('error')
    const busy = respond(new Response('', { status: 503 }))
    expect(
      (await fetchFuckbuffModelCatalog('tok', { fetchImpl: busy.fetchImpl }))
        .kind,
    ).toBe('error')
  })

  test('strips terminal escape sequences from every row string', async () => {
    const hostile = catalogFixture([
      catalogRow('m-x', { displayName: 'Evil\u001b[2J name' }),
    ])
    const { fetchImpl } = respond(Response.json(hostile))
    const result = await fetchFuckbuffModelCatalog('tok', { fetchImpl })
    expect(result.kind).toBe('ok')
    if (result.kind === 'ok') {
      expect(result.catalog.rows[0]!.displayName).not.toContain('\u001b')
    }
  })
})

describe('createFuckbuffCatalogController', () => {
  const harness = (results: FuckbuffCatalogFetchResult[]) => {
    let now = CATALOG.issuedAt
    let held: FuckbuffModelCatalog | null = null
    const timers: Array<{ callback: () => void; ms: number; id: number }> = []
    let nextId = 0
    let fetches = 0
    const deps: FuckbuffCatalogControllerDeps = {
      fetchCatalog: async () => {
        fetches++
        return results.shift() ?? { kind: 'error' }
      },
      applyCatalog: (catalog) => {
        held = catalog
      },
      getCatalog: () => held,
      now: () => now,
      setTimer: (callback, ms) => {
        const id = nextId++
        timers.push({ callback, ms, id })
        return id
      },
      clearTimer: (id) => {
        const index = timers.findIndex((timer) => timer.id === id)
        if (index >= 0) timers.splice(index, 1)
      },
    }
    return {
      controller: createFuckbuffCatalogController('tok', deps),
      held: () => held,
      timers,
      fetches: () => fetches,
      advance: (ms: number) => {
        now += ms
      },
    }
  }

  test('schedules the next fetch at refreshAt', async () => {
    const h = harness([{ kind: 'ok', catalog: CATALOG }])
    await h.controller.load()
    expect(h.held()).toBe(CATALOG)
    expect(h.timers.map((t) => t.ms)).toEqual([
      CATALOG.refreshAt - CATALOG.issuedAt,
    ])
  })

  test('clamps a refreshAt in the past so it cannot become a tight loop', async () => {
    const h = harness([
      { kind: 'ok', catalog: { ...CATALOG, refreshAt: CATALOG.issuedAt - 1 } },
    ])
    await h.controller.load()
    expect(h.timers[0]!.ms).toBe(30_000)
  })

  test('a transient error keeps the held catalog and backs off', async () => {
    const h = harness([
      { kind: 'ok', catalog: CATALOG },
      { kind: 'error' },
      { kind: 'error' },
    ])
    await h.controller.load()
    await h.controller.refresh()
    expect(h.held()).toBe(CATALOG)
    expect(h.timers.map((t) => t.ms)).toEqual([60_000])
    await h.controller.refresh()
    expect(h.timers.map((t) => t.ms)).toEqual([120_000])
  })

  test('an unsupported answer returns to fallback mode and stops polling', async () => {
    const h = harness([{ kind: 'ok', catalog: CATALOG }, { kind: 'unsupported' }])
    await h.controller.load()
    await h.controller.refresh()
    expect(h.held()).toBeNull()
    expect(h.timers).toEqual([])
  })

  test('the scheduled timer refetches', async () => {
    const h = harness([
      { kind: 'ok', catalog: CATALOG },
      { kind: 'ok', catalog: rotateHandles(CATALOG, 2) },
    ])
    await h.controller.load()
    h.timers[0]!.callback()
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
    expect(h.fetches()).toBe(2)
    expect(h.held()?.rows[0]!.handle).toBe('fbm1.m-mimo-h2')
  })

  test('refetches when the access tier or plan changes, never on first sight', async () => {
    const h = harness([
      { kind: 'ok', catalog: CATALOG },
      { kind: 'ok', catalog: CATALOG },
      { kind: 'ok', catalog: CATALOG },
    ])
    await h.controller.load()
    h.controller.noteViewer({ accessTier: 'full', subscriptionTierId: null })
    h.controller.noteViewer({ accessTier: 'full' })
    h.controller.noteViewer({})
    expect(h.fetches()).toBe(1)
    h.controller.noteViewer({ accessTier: 'limited' })
    await h.controller.refresh()
    expect(h.fetches()).toBe(2)
    h.controller.noteViewer({ subscriptionTierId: 'starter' })
    await h.controller.refresh()
    expect(h.fetches()).toBe(3)
  })

  test('a stale refresh succeeds once, then cools down instead of looping', async () => {
    const h = harness([
      { kind: 'ok', catalog: CATALOG },
      { kind: 'ok', catalog: rotateHandles(CATALOG, 2) },
      { kind: 'ok', catalog: rotateHandles(CATALOG, 3) },
    ])
    await h.controller.load()
    expect(await h.controller.refreshAfterStale()).toBe(true)
    expect(await h.controller.refreshAfterStale()).toBe(false)
    h.advance(10_000)
    expect(await h.controller.refreshAfterStale()).toBe(true)
    expect(h.fetches()).toBe(3)
  })

  test('concurrent stale refreshes share one fetch', async () => {
    const h = harness([
      { kind: 'ok', catalog: CATALOG },
      { kind: 'ok', catalog: rotateHandles(CATALOG, 2) },
    ])
    await h.controller.load()
    const [a, b] = await Promise.all([
      h.controller.refreshAfterStale(),
      h.controller.refreshAfterStale(),
    ])
    expect([a, b]).toEqual([true, true])
    expect(h.fetches()).toBe(2)
  })

  test('a stale refresh that finds no catalog reports failure', async () => {
    const h = harness([{ kind: 'ok', catalog: CATALOG }, { kind: 'unsupported' }])
    await h.controller.load()
    expect(await h.controller.refreshAfterStale()).toBe(false)
  })
})

describe('applyFuckbuffCatalog', () => {
  test('migrates a pre-catalog pick onto its row by legacy digest', () => {
    useFuckbuffModelStore
      .getState()
      .setSelectedModel(FUCKBUFF_DEEPSEEK_V4_FLASH_MODEL_ID)
    applyFuckbuffCatalog(CATALOG)
    expect(getSelectedFuckbuffModel()).toBe('m-flash')
  })

  test('a saved catalog key wins over the compiled pick', () => {
    useFuckbuffModelStore
      .getState()
      .setSelectedModel(FUCKBUFF_DEEPSEEK_V4_FLASH_MODEL_ID)
    setFuckbuffCatalog(CATALOG)
    persistFuckbuffModelPick('m-mimo')
    setFuckbuffCatalog(null)
    applyFuckbuffCatalog(CATALOG)
    expect(getSelectedFuckbuffModel()).toBe('m-mimo')
  })

  test('a compiled pick made after the key clears it, so the newer pick wins', () => {
    setFuckbuffCatalog(CATALOG)
    persistFuckbuffModelPick('m-mimo')
    expect(loadSettings().fuckbuffModelKey).toBe('m-mimo')
    setFuckbuffCatalog(null)
    saveFuckbuffModelPreference(FUCKBUFF_DEEPSEEK_V4_FLASH_MODEL_ID)
    expect(loadSettings().fuckbuffModelKey).toBeUndefined()
    expect(loadSettings().fuckbuffModel).toBe(FUCKBUFF_DEEPSEEK_V4_FLASH_MODEL_ID)
    useFuckbuffModelStore
      .getState()
      .setSelectedModel(FUCKBUFF_DEEPSEEK_V4_FLASH_MODEL_ID)
    applyFuckbuffCatalog(CATALOG)
    expect(getSelectedFuckbuffModel()).toBe('m-flash')
  })

  test('an id no row replaces lands on the recommendation', () => {
    // A real selection that CATALOG has no row for. (Not the compiled
    // default: that is MiMo 2.6 Flash, which a CATALOG row replaces.)
    useFuckbuffModelStore.getState().setSelectedModel(FUCKBUFF_MIMO_V26_PRO_MODEL_ID)
    applyFuckbuffCatalog(CATALOG)
    expect(getSelectedFuckbuffModel()).toBe('m-only-here')
  })

  test('a row that leaves the catalog falls to the recommendation', () => {
    applyFuckbuffCatalog(CATALOG)
    useFuckbuffModelStore.getState().setSelectedModel('m-flash')
    applyFuckbuffCatalog(
      catalogFixture([CATALOG.rows[0]!, CATALOG.rows[2]!], {
        recommendedKey: 'm-mimo',
      }),
    )
    expect(getSelectedFuckbuffModel()).toBe('m-mimo')
  })

  test('leaving catalog mode restores the saved compiled pick', () => {
    saveFuckbuffModelPreference(FUCKBUFF_MIMO_V26_PRO_MODEL_ID)
    applyFuckbuffCatalog(CATALOG)
    useFuckbuffModelStore.getState().setSelectedModel('m-only-here')
    useFuckbuffChatStore.setState({ nextModel: 'm-mimo' })
    applyFuckbuffCatalog(null)
    expect(getFuckbuffCatalog()).toBeNull()
    expect(getSelectedFuckbuffModel()).toBe(FUCKBUFF_MIMO_V26_PRO_MODEL_ID)
    expect(useFuckbuffChatStore.getState().nextModel).toBeNull()
  })

  test('re-keys an unsent chat pick', () => {
    useFuckbuffChatStore.setState({ nextModel: FUCKBUFF_MIMO_V25_MODEL_ID })
    applyFuckbuffCatalog(CATALOG)
    expect(useFuckbuffChatStore.getState().nextModel).toBe('m-mimo')
  })

  test('never writes a handle to disk', () => {
    applyFuckbuffCatalog(CATALOG)
    persistFuckbuffModelPick('m-flash')
    useFuckbuffModelStore.getState().setReasoningEffort('m-flash', 'max')
    const file = fs.readFileSync(path.join(configDir, 'settings.json'), 'utf8')
    expect(file).not.toContain('fbm1.')
    expect(loadSettings().fuckbuffCatalogReasoningEfforts).toEqual({
      'm-flash': 'max',
    })
  })
})

describe('settings', () => {
  test('keeps a key-shaped saved key and drops anything else', () => {
    fs.writeFileSync(
      getSettingsPath(),
      JSON.stringify({
        fuckbuffModelKey: 'm-flash',
        fuckbuffCatalogReasoningEfforts: {
          'm-flash': 'max',
          'm-bad': 'loud',
          'Not A Key/1': 'low',
        },
      }),
    )
    expect(loadSettings().fuckbuffModelKey).toBe('m-flash')
    expect(loadSettings().fuckbuffCatalogReasoningEfforts).toEqual({
      'm-flash': 'max',
    })
    fs.writeFileSync(
      getSettingsPath(),
      JSON.stringify({ fuckbuffModelKey: 'fbm1.Handle/Not+A+Key' }),
    )
    expect(loadSettings().fuckbuffModelKey).toBeUndefined()
  })
})

describe('session picks in catalog mode', () => {
  test('an explicit pick keeps a key and maps a stray id onto its row', () => {
    setFuckbuffCatalog(CATALOG)
    const none = { status: 'none', accessTier: 'limited' } as const
    expect(resolveFuckbuffModelPickForSession('m-only-here', none)).toBe(
      'm-only-here',
    )
    expect(
      resolveFuckbuffModelPickForSession(FUCKBUFF_MIMO_V25_MODEL_ID, none),
    ).toBe('m-mimo')
    expect(resolveFuckbuffModelPickForSession('m-gone', none)).toBe(
      'm-only-here',
    )
  })

  test('an active session re-keyed by the server wins the selection', () => {
    setFuckbuffCatalog(CATALOG)
    expect(
      resolveFuckbuffModelSelectionForSession(
        'm-mimo',
        { status: 'active', model: 'm-flash' } as never,
        true,
      ),
    ).toBe('m-flash')
  })
})

describe('the default for an account with no explicit pick', () => {
  const FLASH = FUCKBUFF_DEEPSEEK_V4_FLASH_MODEL_ID
  const MIMO = FUCKBUFF_MIMO_V25_MODEL_ID
  const none = (accessTier: 'full' | 'limited', balance = 50) =>
    ({
      status: 'none',
      accessTier,
      freebucks: { balance, planId: null, prices: { [FLASH]: 15, [MIMO]: 10 } },
    }) as never

  test('is the Balanced stop: DeepSeek V4.1 Flash at full access, MiMo at limited', () => {
    expect(
      resolveFuckbuffModelSelectionForSession(MIMO, none('full'), false),
    ).toBe(FLASH)
    expect(
      resolveFuckbuffModelSelectionForSession(FLASH, none('limited'), false),
    ).toBe(MIMO)
  })

  test('an explicit pick keeps its model', () => {
    expect(
      resolveFuckbuffModelSelectionForSession(MIMO, none('full'), true),
    ).toBe(MIMO)
  })

  test('steps down to the recommendation when the balance cannot start Balanced', () => {
    expect(fuckbuffDefaultModelForSession(none('full', 12))).toBe(MIMO)
  })

  test('names the catalog row in catalog mode', () => {
    setFuckbuffCatalog(CATALOG)
    expect(fuckbuffDefaultModelForSession(none('full'))).toBe('m-flash')
  })

  test('a pick stops the selection following the default', () => {
    useFuckbuffModelStore.setState({ hasExplicitPick: false })
    persistFuckbuffModelPick(MIMO)
    expect(useFuckbuffModelStore.getState().hasExplicitPick).toBe(true)
  })
})

describe('reasoning effort per catalog row', () => {
  test('uses the row ladder and default', () => {
    applyFuckbuffCatalog(CATALOG)
    expect(getEffectiveFuckbuffReasoningEffort('m-flash')).toBe('high')
    useFuckbuffModelStore.getState().setReasoningEffort('m-flash', 'low')
    expect(getEffectiveFuckbuffReasoningEffort('m-flash')).toBe('low')
    expect(getEffectiveFuckbuffReasoningEffort('m-mimo')).toBeNull()
  })

  test('inherits the effort saved for the compiled model the row replaces', () => {
    useFuckbuffModelStore
      .getState()
      .setReasoningEffort(FUCKBUFF_DEEPSEEK_V4_FLASH_MODEL_ID, 'max')
    applyFuckbuffCatalog(CATALOG)
    expect(getEffectiveFuckbuffReasoningEffort('m-flash')).toBe('max')
    useFuckbuffModelStore
      .getState()
      .setReasoningEffort(FUCKBUFF_DEEPSEEK_V4_FLASH_MODEL_ID, undefined)
  })

  test('ignores a saved rung the row no longer offers', () => {
    applyFuckbuffCatalog(CATALOG)
    useFuckbuffModelStore.getState().setReasoningEffort('m-flash', 'max')
    applyFuckbuffCatalog(
      catalogFixture([
        catalogRow('m-flash', { efforts: ['low', 'high'], defaultEffort: 'low' }),
      ]),
    )
    expect(getEffectiveFuckbuffReasoningEffort('m-flash')).toBe('low')
  })
})

describe('the directory in catalog mode', () => {
  test('maps the step-down, recommendation and locks from the catalog', () => {
    setFuckbuffCatalog(
      catalogFixture([
        ...CATALOG.rows,
        catalogRow('m-locked', { access: 'locked', lockedLabel: 'Pro' }),
      ], { recommendedKey: 'm-only-here', fallbackKey: 'm-mimo' }),
    )
    const directory = getFuckbuffModelDirectory()
    expect(directory.recommendedModelId('full')).toBe('m-only-here')
    expect(directory.fallbackModelId).toBe('m-mimo')
    expect(directory.planRequired('m-locked', false, undefined)).toBe(true)
    expect(directory.planRequired('m-mimo', false, undefined)).toBe(false)
    expect(directory.resolveSelection(FUCKBUFF_MIMO_V25_MODEL_ID)).toBe('m-mimo')
    expect(directory.resolveSelection('m-gone')).toBe('m-only-here')
    expect(directory.get('m-flash').displayName).toBe('Flash')
    expect(directory.efforts('m-flash')).toEqual(['low', 'high', 'max'])
  })
})

describe('isFuckbuffCatalogStaleError', () => {
  test('finds the code wherever a layer put it', () => {
    expect(isFuckbuffCatalogStaleError({ error: 'fuckbuff_catalog_stale' })).toBe(
      true,
    )
    expect(
      isFuckbuffCatalogStaleError(
        new Error('409 Conflict: {"error":"fuckbuff_catalog_stale"}'),
      ),
    ).toBe(true)
    expect(
      isFuckbuffCatalogStaleError({
        type: 'error',
        message: 'Request failed',
        responseBody: '{"error":"fuckbuff_catalog_stale"}',
      }),
    ).toBe(true)
    expect(isFuckbuffCatalogStaleError(new Error('session_expired'))).toBe(false)
    expect(isFuckbuffCatalogStaleError(undefined)).toBe(false)
  })
})

describe('runWithFuckbuffCatalogStaleRetry', () => {
  const stale = { type: 'error', message: '{"error":"fuckbuff_catalog_stale"}' }

  test('outside catalog mode it runs exactly once, whatever the answer', async () => {
    const attempts: number[] = []
    const result = await runWithFuckbuffCatalogStaleRetry({
      run: async (attempt) => {
        attempts.push(attempt)
        return { output: stale }
      },
      canRetry: () => true,
      refreshAfterStale: async () => true,
    })
    expect(attempts).toEqual([0])
    expect(result.output).toBe(stale)
  })

  test('refetches and retries once with a rebuilt agent on a stale output', async () => {
    setFuckbuffCatalog(CATALOG)
    const attempts: number[] = []
    let refreshes = 0
    const result = await runWithFuckbuffCatalogStaleRetry({
      run: async (attempt) => {
        attempts.push(attempt)
        return attempt === 0 ? { output: stale } : { output: { type: 'lastMessage' } }
      },
      canRetry: () => true,
      refreshAfterStale: async () => {
        refreshes++
        return true
      },
    })
    expect(attempts).toEqual([0, 1])
    expect(refreshes).toBe(1)
    expect(result.output).toEqual({ type: 'lastMessage' })
  })

  test('retries a thrown stale error, and surfaces a second one', async () => {
    setFuckbuffCatalog(CATALOG)
    const attempts: number[] = []
    await expect(
      runWithFuckbuffCatalogStaleRetry({
        run: async (attempt) => {
          attempts.push(attempt)
          throw Object.assign(new Error('Conflict'), {
            error: 'fuckbuff_catalog_stale',
          })
        },
        canRetry: () => true,
        refreshAfterStale: async () => true,
      }),
    ).rejects.toThrow('Conflict')
    expect(attempts).toEqual([0, 1])
  })

  test('never retries a turn that already streamed, or when the refetch failed', async () => {
    setFuckbuffCatalog(CATALOG)
    const attempts: number[] = []
    await runWithFuckbuffCatalogStaleRetry({
      run: async (attempt) => {
        attempts.push(attempt)
        return { output: stale }
      },
      canRetry: () => false,
      refreshAfterStale: async () => true,
    })
    await runWithFuckbuffCatalogStaleRetry({
      run: async (attempt) => {
        attempts.push(attempt)
        return { output: stale }
      },
      canRetry: () => true,
      refreshAfterStale: async () => false,
    })
    expect(attempts).toEqual([0, 0])
  })

  test('other errors pass straight through', async () => {
    setFuckbuffCatalog(CATALOG)
    let refreshes = 0
    const result = await runWithFuckbuffCatalogStaleRetry({
      run: async () => ({ output: { type: 'error', message: 'session_expired' } }),
      canRetry: () => true,
      refreshAfterStale: async () => {
        refreshes++
        return true
      },
    })
    expect(result.output.message).toBe('session_expired')
    expect(refreshes).toBe(0)
  })
})
