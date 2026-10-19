import { afterEach, expect, spyOn, test } from 'bun:test'

import {
  setFuckbuffCatalog,
  useFuckbuffCatalogStore,
} from '../../state/fuckbuff-catalog-store'
import {
  callFuckbuffSession,
  FuckbuffSessionRequestError,
} from '../fuckbuff-session-api'
import { catalogFixture, catalogRow, rotateHandles } from './fuckbuff-catalog-fixtures'

const CATALOG = catalogFixture([catalogRow('m-flash'), catalogRow('m-mimo')])

let fetchSpy: ReturnType<typeof spyOn> | undefined

afterEach(() => {
  fetchSpy?.mockRestore()
  fetchSpy = undefined
  setFuckbuffCatalog(null)
  useFuckbuffCatalogStore.setState({ refreshAfterStale: null })
})

const headersOf = (call: unknown[]) =>
  new Headers((call[1] as RequestInit | undefined)?.headers)

const stale = () =>
  new Response(JSON.stringify({ error: 'fuckbuff_catalog_stale' }), {
    status: 409,
    headers: { 'content-type': 'application/json' },
  })

test('fallback mode sends neither the protocol header nor a handle', async () => {
  fetchSpy = spyOn(globalThis, 'fetch').mockResolvedValue(
    Response.json({ status: 'none' }),
  )
  await callFuckbuffSession('POST', 'tok', { model: 'mimo/mimo-v2.5' })
  const headers = headersOf(fetchSpy.mock.calls[0]!)
  expect(headers.get('x-fuckbuff-catalog-protocol')).toBeNull()
  expect(headers.get('x-fuckbuff-model')).toBe('mimo/mimo-v2.5')
})

test('catalog mode sends the protocol header on every call and the handle for a key', async () => {
  setFuckbuffCatalog(CATALOG)
  fetchSpy = spyOn(globalThis, 'fetch').mockImplementation((async () =>
    Response.json({ status: 'none' })) as unknown as typeof fetch)
  await callFuckbuffSession('POST', 'tok', { model: 'm-flash' })
  await callFuckbuffSession('GET', 'tok', { instanceId: 'i1' })
  await callFuckbuffSession('DELETE', 'tok', { instanceId: 'i1' })
  const [post, get, del] = fetchSpy.mock.calls.map(headersOf)
  expect(post!.get('x-fuckbuff-model')).toBe('fbm1.m-flash-h1')
  for (const headers of [post!, get!, del!]) {
    expect(headers.get('x-fuckbuff-catalog-protocol')).toBe('1')
  }
})

test('a stale handle refetches the catalog once and retries with the new handle', async () => {
  setFuckbuffCatalog(CATALOG)
  let refreshes = 0
  useFuckbuffCatalogStore.setState({
    refreshAfterStale: async () => {
      refreshes++
      setFuckbuffCatalog(rotateHandles(CATALOG, 2))
      return true
    },
  })
  fetchSpy = spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce(stale())
    .mockResolvedValueOnce(
      Response.json({ status: 'none', accessTier: 'full' }),
    )
  const response = await callFuckbuffSession('POST', 'tok', {
    model: 'm-flash',
  })
  expect(response.status).toBe('none')
  expect(refreshes).toBe(1)
  expect(fetchSpy.mock.calls.map((c: unknown[]) => headersOf(c).get('x-fuckbuff-model')))
    .toEqual(['fbm1.m-flash-h1', 'fbm1.m-flash-h2'])
})

test('a second stale answer is surfaced, not retried again', async () => {
  setFuckbuffCatalog(CATALOG)
  useFuckbuffCatalogStore.setState({
    refreshAfterStale: async () => {
      setFuckbuffCatalog(rotateHandles(CATALOG, 2))
      return true
    },
  })
  fetchSpy = spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce(stale())
    .mockResolvedValueOnce(stale())
  const error = await callFuckbuffSession('POST', 'tok', {
    model: 'm-flash',
  }).catch((e: unknown) => e)
  expect(error).toBeInstanceOf(FuckbuffSessionRequestError)
  expect((error as FuckbuffSessionRequestError).errorCode).toBe(
    'fuckbuff_catalog_stale',
  )
  expect(fetchSpy).toHaveBeenCalledTimes(2)
})

test('when the catalog cannot be refetched the stale error is surfaced', async () => {
  setFuckbuffCatalog(CATALOG)
  useFuckbuffCatalogStore.setState({ refreshAfterStale: async () => false })
  fetchSpy = spyOn(globalThis, 'fetch').mockResolvedValueOnce(stale())
  await expect(
    callFuckbuffSession('GET', 'tok', { instanceId: 'i1' }),
  ).rejects.toBeInstanceOf(FuckbuffSessionRequestError)
  expect(fetchSpy).toHaveBeenCalledTimes(1)
})
