import { freebucksTimeZoneHeaders } from '@codebuff/common/util/freebucks-timezone'
import {
  sanitizeTerminalStrings,
  sanitizeTerminalText,
} from '@codebuff/common/util/terminal-safe-text'
import { env } from '@codebuff/common/env'
import {
  FUCKBUFF_CLIENT_VERSION_HEADER,
  FUCKBUFF_DESKTOP_ATTEMPT_HEADER,
  FUCKBUFF_PURCHASE_CONTINUITY_HEADER,
} from '@codebuff/common/constants/fuckbuff-desktop-sessions'
import { clientEnvironmentHeaders } from './client-environment'
import { getCliEnv } from './env'
import { timedApiCall } from '../ads/ad-signals'
import { fuckbuffCliAttemptId } from './fuckbuff-session-identity'
import {
  FUCKBUFF_COMPACT_SESSION_HEADER,
  FUCKBUFF_HEARTBEAT_HEADER,
  FUCKBUFF_INCLUDE_UNUSED_RATE_LIMITS_HEADER,
  FUCKBUFF_INSTANCE_HEADER,
  FUCKBUFF_MODEL_HEADER,
  FUCKBUFF_MULTI_SESSION_HEADER,
  FUCKBUFF_TAKEOVER_INSTANCE_HEADER,
  FUCKBUFF_WALLET_SPEND_LIMIT_HEADER,
  FUCKBUFF_SESSION_ADMISSION_PATH,
  FUCKBUFF_SESSION_UNSUPPORTED_MESSAGE,
} from '@codebuff/common/constants/fuckbuff-models'

import {
  FUCKBUFF_CATALOG_FETCH_HEADER,
  FUCKBUFF_CATALOG_PROTOCOL_HEADER,
  FUCKBUFF_CATALOG_PROTOCOL_VERSION,
  FUCKBUFF_CATALOG_STALE_ERROR,
} from '@codebuff/common/types/fuckbuff-model-catalog'

import { useFuckbuffCatalogStore } from '../state/fuckbuff-catalog-store'
import {
  fuckbuffDeviceHeaders,
  noteFuckbuffDeviceKeyError,
} from './fuckbuff-device-key'
import { fuckbuffCatalogHandleFor } from './fuckbuff-model-directory'

import type { FuckbuffSessionResponse } from '../types/fuckbuff-session'
import type { FuckbuffModelCatalog } from '@codebuff/common/types/fuckbuff-model-catalog'
import type { FuckbuffSessionServerResponse } from '@codebuff/common/types/fuckbuff-session'

const SESSION_FETCH_TIMEOUT_MS = 20_000
export type FuckbuffSessionMethod = 'POST' | 'GET' | 'DELETE'

export class FuckbuffSessionRequestError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
    readonly retryAfterMs?: number,
    readonly errorCode?: string,
  ) {
    super(message)
    this.name = 'FuckbuffSessionRequestError'
  }
}

export function isFuckbuffSessionTimeoutError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === 'TimeoutError' || /timeout|timed out/i.test(error.message))
  )
}

export type FuckbuffSessionFailureDisposition = 'retry' | 'stop' | 'unknown'

/** How the poll loop should handle a failed request.
 *
 * A POST without a response may already have rotated the active instance, so
 * repeating it is unsafe without protocol-level idempotency. HTTP 408, 429,
 * and 503 responses are the exception: edge rejection or admission shedding
 * produces them before the session mutation can commit. GET is read-only and
 * can retry transient failures normally. */
export function classifyFuckbuffSessionRequestFailure(
  method: Extract<FuckbuffSessionMethod, 'POST' | 'GET'>,
  error: unknown,
): FuckbuffSessionFailureDisposition {
  if (method === 'POST') {
    if (!(error instanceof FuckbuffSessionRequestError)) return 'unknown'
    // These responses are produced before the session mutation can commit:
    // 408/429 come from an edge or unparsed response (the endpoint's typed
    // rate-limit responses are returned above), and a 503 means no handler was
    // available or admission shed the request. Retrying them cannot repeat a
    // successful takeover.
    if ([408, 429, 503].includes(error.statusCode)) {
      return 'retry'
    }
    return error.statusCode >= 400 && error.statusCode < 500
      ? 'stop'
      : 'unknown'
  }

  if (!(error instanceof FuckbuffSessionRequestError)) return 'retry'
  return error.statusCode === 408 ||
    error.statusCode === 429 ||
    error.statusCode >= 500
    ? 'retry'
    : 'stop'
}

export function parseRetryAfterMs(
  value: string | null,
  nowMs = Date.now(),
): number | undefined {
  if (!value) return undefined
  const seconds = Number(value)
  if (Number.isFinite(seconds) && seconds >= 0) {
    const milliseconds = seconds * 1_000
    return Number.isFinite(milliseconds) ? Math.ceil(milliseconds) : undefined
  }
  const dateMs = Date.parse(value)
  return Number.isFinite(dateMs) ? Math.max(0, dateMs - nowMs) : undefined
}

/** Combine the caller's abort signal with a per-request timeout. */
export function sessionFetchSignal(
  signal: AbortSignal | undefined,
  timeoutMs: number = SESSION_FETCH_TIMEOUT_MS,
): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs)
  return signal ? AbortSignal.any([signal, timeout]) : timeout
}

/** The web API origin the session and catalog endpoints live on. */
export function fuckbuffApiBaseUrl(): string {
  return sessionBaseUrl()
}

function sessionBaseUrl(): string {
  return (env.NEXT_PUBLIC_CODEBUFF_APP_URL || 'https://codebuff.com').replace(
    /\/$/,
    '',
  )
}

function sessionEndpoint(method: FuckbuffSessionMethod): string {
  return `${sessionBaseUrl()}${method === 'POST' ? FUCKBUFF_SESSION_ADMISSION_PATH : '/api/v1/freebuff/session'}`
}

/** The host the session API is reached on, for copy that names it. */
export function fuckbuffSessionHost(): string {
  try {
    return new URL(sessionBaseUrl()).host
  } catch {
    return sessionBaseUrl()
  }
}

/**
 * A network-layer failure: nothing came back, as opposed to a response we did
 * not like. Bun's `fetch` surfaces these as `fetch failed`, a TimeoutError, or
 * a bare socket code.
 */
export function isFuckbuffSessionNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  if (isFuckbuffSessionTimeoutError(error)) return true
  return /fetch failed|ECONNREFUSED|ECONNRESET|ENOTFOUND|EHOSTUNREACH|ENETUNREACH|EAI_AGAIN|network/i.test(
    `${error.message} ${(error.cause as Error | undefined)?.message ?? ''}`,
  )
}

/**
 * What the landing screen shows for a session request that never got an
 * answer.
 *
 * Until 2026-09-19 it printed the runtime's error verbatim, so a user whose
 * ISP could not route to this host — while every browser on the machine
 * reached freebuff.com, which sits on a different address — read
 * `The operation timed out.` and reinstalled. Four PLDT (Philippines) users
 * reported exactly that in two days; switching ISP fixed each one. Name the
 * host we could not reach and the two things that actually help, and never
 * blame the machine: the server was serving everyone else at the time.
 */
export function fuckbuffSessionUnreachableMessage(host: string): string {
  return (
    `Couldn't get a response from ${host}. If your browser can open ` +
    `freebuff.com, this network isn't routing to that host: try mobile data ` +
    `or another ISP, or use freebuff.com/web meanwhile.`
  )
}

type FuckbuffSessionCallOptions = {
  instanceId?: string
  multiSession?: boolean
  takeoverInstanceId?: string
  model?: string
  signal?: AbortSignal
  compact?: boolean
}

/**
 * One session request, in whichever protocol this process is speaking.
 *
 * In catalog mode (docs/fuckbuff-model-catalog.md) every call carries the
 * catalog protocol header, so the server answers with catalog keys, and an
 * admission's `model` is a KEY that goes out as the row's HANDLE. Every call
 * also carries the held catalog's fetch id and this install's device
 * signature (fuckbuff-device-key.ts), when there is one. A handle the
 * server no longer accepts comes back as 409 `fuckbuff_catalog_stale`: the
 * catalog is refetched once and the request retried once with the new handle
 * for the same key. A second refusal is surfaced like any other failure.
 *
 * In fallback mode the catalog headers are omitted.
 */
export async function callFuckbuffSession(
  method: FuckbuffSessionMethod,
  token: string,
  opts: FuckbuffSessionCallOptions = {},
): Promise<FuckbuffSessionServerResponse> {
  const catalog = useFuckbuffCatalogStore.getState().catalog
  try {
    return await requestFuckbuffSession(method, token, opts, catalog)
  } catch (error) {
    const refreshAfterStale =
      useFuckbuffCatalogStore.getState().refreshAfterStale
    if (
      !catalog ||
      !(error instanceof FuckbuffSessionRequestError) ||
      error.errorCode !== FUCKBUFF_CATALOG_STALE_ERROR ||
      !refreshAfterStale ||
      opts.signal?.aborted
    ) {
      throw error
    }
    if (!(await refreshAfterStale())) throw error
    return requestFuckbuffSession(
      method,
      token,
      opts,
      useFuckbuffCatalogStore.getState().catalog,
    )
  }
}

async function requestFuckbuffSession(
  method: FuckbuffSessionMethod,
  token: string,
  opts: FuckbuffSessionCallOptions,
  catalog: FuckbuffModelCatalog | null,
): Promise<FuckbuffSessionServerResponse> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    ...freebucksTimeZoneHeaders(),
    ...clientEnvironmentHeaders(),
  }
  // Observe-only: ties a server-side refusal line to the build that saw it.
  const cliVersion = getCliEnv().CODEBUFF_CLI_VERSION
  if (cliVersion) headers[FUCKBUFF_CLIENT_VERSION_HEADER] = cliVersion
  const attemptId = fuckbuffCliAttemptId(opts.instanceId)
  const multiSession = opts.multiSession ?? Boolean(attemptId)
  if (multiSession) {
    headers[FUCKBUFF_MULTI_SESSION_HEADER] = '1'
    headers[FUCKBUFF_PURCHASE_CONTINUITY_HEADER] = '1'
    if (attemptId && method !== 'GET') {
      headers[FUCKBUFF_DESKTOP_ATTEMPT_HEADER] = attemptId
    }
    if (method === 'GET' && opts.instanceId) {
      headers[FUCKBUFF_HEARTBEAT_HEADER] = '1'
      // A bare heartbeat omits balances and quotas. Rich refreshes (including
      // expiry and identity changes) must explicitly ask for that snapshot.
      if (!opts.compact)
        headers[FUCKBUFF_INCLUDE_UNUSED_RATE_LIMITS_HEADER] = '1'
    }
  }
  if (catalog) {
    headers[FUCKBUFF_CATALOG_PROTOCOL_HEADER] = FUCKBUFF_CATALOG_PROTOCOL_VERSION
    if (catalog.fetchId) headers[FUCKBUFF_CATALOG_FETCH_HEADER] = catalog.fetchId
  }
  if ((multiSession || method !== 'POST') && opts.instanceId) {
    headers[FUCKBUFF_INSTANCE_HEADER] = opts.instanceId
  }
  if (method === 'GET' && opts.compact) {
    headers[FUCKBUFF_COMPACT_SESSION_HEADER] = '1'
  }
  if (method === 'POST') {
    if (opts.takeoverInstanceId)
      headers[FUCKBUFF_TAKEOVER_INSTANCE_HEADER] = opts.takeoverInstanceId
    if (opts.model) {
      // A key the catalog has no row for goes out as-is: the server answers
      // it stale, which refetches the catalog.
      headers[FUCKBUFF_MODEL_HEADER] = catalog
        ? (fuckbuffCatalogHandleFor(catalog, opts.model) ?? opts.model)
        : opts.model
    }
    // The admission route refuses a POST without this header; its value no
    // longer limits anything (wallet consent is the picker's own prompt).
    headers[FUCKBUFF_WALLET_SPEND_LIMIT_HEADER] = 'session'
  }

  const endpoint =
    method === 'DELETE' && attemptId
      ? `${sessionEndpoint(method)}/attempt`
      : sessionEndpoint(method)
  if (catalog) {
    // Session calls send no body; the signature covers the empty one.
    Object.assign(
      headers,
      await fuckbuffDeviceHeaders(token, {
        method,
        url: endpoint,
        fetchId: catalog.fetchId,
      }),
    )
  }
  const fetchSession = () =>
    fetch(endpoint, {
      method,
      headers,
      signal: sessionFetchSignal(opts.signal),
    })
  // The polled GET is the CLI's steadiest call to our API: its round trip is
  // the ad client context's `net.rtt` sample (COD-757).
  const response =
    method === 'GET' ? await timedApiCall(fetchSession) : await fetchSession()

  if (method === 'POST' && [404, 405].includes(response.status)) {
    throw new FuckbuffSessionRequestError(
      FUCKBUFF_SESSION_UNSUPPORTED_MESSAGE,
      response.status,
      undefined,
      'session_admission_unsupported',
    )
  }
  if (response.status === 404) {
    return { status: 'none' }
  }

  if (response.status === 403) {
    const body = (await response
      .json()
      .catch(() => null)) as FuckbuffSessionServerResponse | null
    if (
      body &&
      (body.status === 'country_blocked' || body.status === 'banned')
    ) {
      return sanitizeTerminalStrings(body)
    }
  }

  if (response.status === 409 && method === 'POST') {
    const body = (await response
      .clone()
      .json()
      .catch(() => null)) as FuckbuffSessionServerResponse | null
    if (
      body &&
      (body.status === 'model_locked' ||
        body.status === 'model_unavailable' ||
        body.status === 'premium_slot_taken' ||
        body.status === 'purchase_claim_released' ||
        body.status === 'purchase_in_use' ||
        body.status === 'purchase_capacity')
    ) {
      return sanitizeTerminalStrings(body)
    }
  }

  if (response.status === 429 && method === 'POST') {
    const body = (await response
      .json()
      .catch(() => null)) as FuckbuffSessionServerResponse | null
    if (
      body &&
      (body.status === 'rate_limited' ||
        body.status === 'spend_limited' ||
        body.status === 'ip_capped')
    ) {
      return sanitizeTerminalStrings(body)
    }
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    let errorCode: string | undefined
    try {
      const body = JSON.parse(text) as { error?: unknown }
      if (typeof body.error === 'string') errorCode = body.error
    } catch {
      // Non-JSON errors have no machine-readable code.
    }
    if (catalog) noteFuckbuffDeviceKeyError(token, endpoint, errorCode)
    throw new FuckbuffSessionRequestError(
      `fuckbuff session ${method} failed: ${response.status} ${sanitizeTerminalText(text.slice(0, 200))}`,
      response.status,
      parseRetryAfterMs(response.headers.get('retry-after')),
      errorCode,
    )
  }

  // Server-written copy (messages, upgrade hints, Freebucks CTAs) is drawn in
  // the terminal: every string is stripped of escape sequences here.
  return sanitizeTerminalStrings(
    (await response.json()) as FuckbuffSessionServerResponse,
  )
}

/** A compact poll omits quota fields that were already returned by admission.
 * Keep that snapshot only for the same active session; null tells the poller
 * to fetch one full response before compacting again. */
export function mergeCompactActiveSession(
  current: FuckbuffSessionResponse | null,
  next: FuckbuffSessionServerResponse,
): FuckbuffSessionServerResponse | null {
  if (
    current?.status !== 'active' ||
    next.status !== 'active' ||
    current.instanceId !== next.instanceId ||
    current.model !== next.model
  ) {
    return null
  }
  return {
    ...next,
    rateLimit: next.rateLimit ?? current.rateLimit,
    rateLimitsByModel: next.rateLimitsByModel ?? current.rateLimitsByModel,
    // Compact polls omit the subscription block along with the rate limits;
    // dropping it here would blank the plan panel until the next full poll.
    subscription: next.subscription ?? current.subscription,
    // Same carry, and it matters MORE here: the Freebucks header is the whole
    // meter for a metered account, so losing it mid-session would drop the
    // picker back to session rings that no longer gate anything. The balance
    // is refreshed on a full poll/admission. Other instances can spend from
    // it meanwhile; admission rechecks both the balance and wallet consent.
    freebucks:
      next.freebucks !== undefined ? next.freebucks : current.freebucks,
  }
}

export function holdsLiveFuckbuffSlot(
  current: FuckbuffSessionResponse | null,
): boolean {
  if (!current) return false
  return (
    current.status === 'active' ||
    (current.status === 'ended' && Boolean(current.instanceId))
  )
}
