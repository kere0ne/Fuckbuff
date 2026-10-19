/**
 * Every question the CLI asks about a Fuckbuff model, behind one seam.
 *
 * Two implementations, and exactly one is live at a time:
 *
 * - `compiledFuckbuffModelDirectory`: the compiled catalog and plain model
 *   ids, delegating to the same `fuckbuff-models` functions the CLI called
 *   before the server catalog existed. Fallback mode (an older server, the
 *   network) is this object, so it must stay a pure pass-through.
 * - `catalogFuckbuffModelDirectory(catalog)`: the server catalog
 *   (docs/fuckbuff-model-catalog.md). Every "model id" it hands out or accepts
 *   is a catalog KEY, because that is what a catalog-aware session response
 *   carries wherever it used to carry a model id. A legacy id still resolves,
 *   through the row's `legacyDigests`, so a pick or a relaunch record written
 *   before the catalog lands on its row.
 *
 * Keys and model ids never collide (keys carry no `/` and are opaque), which
 * is what lets a store hold either kind in one field across a mode switch.
 *
 * Nothing here selects a model on the wire. The HANDLE does that, and it is
 * looked up at send time (`fuckbuffCatalogHandleFor`), never stored.
 */
import {
  FALLBACK_FUCKBUFF_MODEL_ID,
  FUCKBUFF_DEFAULT_CONTEXT_WINDOW,
  FUCKBUFF_LIMITED_OFFER_MODEL_IDS,
  FUCKBUFF_MODEL_CONTEXT_WINDOWS,
  FUCKBUFF_REWARD_MODEL_ID,
  fuckbuffWithdrawnModelMessage,
  getFuckbuffModel,
  getFuckbuffModelDefaultEffort,
  getFuckbuffModelEfforts,
  getFuckbuffModelSupersededBy,
  getFuckbuffModelUnavailableLabel,
  getFuckbuffModelsForAccessTier,
  getRecommendedFuckbuffModelId,
  isFuckbuffLimitedOfferModelId,
  isFuckbuffModelAvailable,
  isFuckbuffModelId,
  isFuckbuffPremiumModelId,
  isFuckbuffRewardModelId,
  isSupportedFuckbuffModelId,
  resolveFuckbuffModelForAccessTier,
  resolveSupportedFuckbuffModel,
} from '@codebuff/common/constants/fuckbuff-models'
import {
  findFuckbuffCatalogRowForLegacyId,
  listableFuckbuffCatalogRows,
} from '@codebuff/common/types/fuckbuff-model-catalog'
import { fuckbuffPlanRequired } from '@codebuff/common/util/fuckbuff-model-selection'

import type {
  FuckbuffAccessTier,
  FuckbuffModelOption,
} from '@codebuff/common/constants/fuckbuff-models'
import type { ReasoningEffort } from '@codebuff/common/constants/reasoning-effort'
import type {
  FuckbuffCatalogBadge,
  FuckbuffCatalogRow,
  FuckbuffModelCatalog,
} from '@codebuff/common/types/fuckbuff-model-catalog'
import type { FuckbuffFreebucksInfo } from '@codebuff/common/types/fuckbuff-session'

export interface FuckbuffModelDirectory {
  /** The catalog this directory answers from; null in fallback mode. */
  readonly catalog: FuckbuffModelCatalog | null
  /** The picker's rows for this viewer, in list order (before any price sort). */
  pickerModels(
    accessTier: FuckbuffAccessTier | null | undefined,
    hasPaidSubscription: boolean,
  ): readonly FuckbuffModelOption[]
  /** The row for an id (or key); an unknown one gets a best-effort row, as
   *  `getFuckbuffModel` does, so display code never has to null-check. */
  get(id: string): FuckbuffModelOption
  /** A model this client can name at all (`isSupportedFuckbuffModelId`). */
  isKnown(id: string | null | undefined): boolean
  /** A model the picker offers (`isFuckbuffModelId`). */
  isPickerModel(id: string | null | undefined): boolean
  /** The catalog row behind an id or key; always undefined in fallback mode. */
  row(id: string | null | undefined): FuckbuffCatalogRow | undefined
  efforts(id: string | null | undefined): readonly ReasoningEffort[] | null
  defaultEffort(id: string | null | undefined): ReasoningEffort | null
  isAvailable(id: string, now: Date): boolean
  unavailableLabel(id: string, now: Date): string | undefined
  isPremium(id: string | null | undefined): boolean
  isReward(id: string | null | undefined): boolean
  isLimitedOffer(id: string | null | undefined): boolean
  /** What the referral banner's earned-session action starts. */
  readonly rewardModelId: string
  /** The always-joinable row a pick steps down to. */
  readonly fallbackModelId: string
  recommendedModelId(
    accessTier: FuckbuffAccessTier | null | undefined,
    options?: { premiumExhausted?: boolean },
  ): string
  supersededBy(
    id: string,
    visibleIds: readonly string[],
  ): FuckbuffModelOption['supersededBy'] | undefined
  /** Whether the picker draws this row locked (paid plan required). */
  planRequired(
    id: string,
    hasPaidSubscription: boolean,
    freebucks: FuckbuffFreebucksInfo | null | undefined,
    /** Fallback mode only: the resolved access tier, read when the server
     *  sent no verdict (see `fuckbuffPlanRequired`). */
    accessTier?: FuckbuffAccessTier | null,
  ): boolean
  /** The pill set a row carries. Fallback mode draws its compiled flags
   *  itself and gets none here. */
  badges(id: string): readonly FuckbuffCatalogBadge[]
  contextWindow(id: string | null | undefined): number
  /** What an arbitrary stored value selects (`resolveSupportedFuckbuffModel`). */
  resolveSelection(id: string | null | undefined): string
  /** What an explicit pick sends to admission for this viewer. */
  resolveForAccessTier(
    id: string,
    accessTier: FuckbuffAccessTier | null | undefined,
    hasPaidSubscription: boolean,
  ): string
  withdrawnMessage(id: string): string
  /** Where a locked row's press goes; undefined means the CLI's own page. */
  readonly plansUrl: string | undefined
}

export const compiledFuckbuffModelDirectory: FuckbuffModelDirectory = {
  catalog: null,
  pickerModels: (accessTier, hasPaidSubscription) =>
    getFuckbuffModelsForAccessTier(accessTier, hasPaidSubscription),
  get: (id) => getFuckbuffModel(id),
  isKnown: (id) => isSupportedFuckbuffModelId(id),
  isPickerModel: (id) => isFuckbuffModelId(id),
  row: () => undefined,
  efforts: (id) => getFuckbuffModelEfforts(id),
  defaultEffort: (id) => getFuckbuffModelDefaultEffort(id),
  isAvailable: (id, now) => isFuckbuffModelAvailable(id, now),
  unavailableLabel: (id, now) => getFuckbuffModelUnavailableLabel(id, now),
  isPremium: (id) => isFuckbuffPremiumModelId(id),
  isReward: (id) => isFuckbuffRewardModelId(id),
  isLimitedOffer: (id) => isFuckbuffLimitedOfferModelId(id),
  rewardModelId: FUCKBUFF_REWARD_MODEL_ID,
  fallbackModelId: FALLBACK_FUCKBUFF_MODEL_ID,
  recommendedModelId: (accessTier, options) =>
    getRecommendedFuckbuffModelId(accessTier, options),
  supersededBy: (id, visibleIds) => getFuckbuffModelSupersededBy(id, visibleIds),
  planRequired: (id, hasPaidSubscription, freebucks, accessTier) =>
    fuckbuffPlanRequired(id, hasPaidSubscription, freebucks, accessTier),
  badges: () => [],
  contextWindow: (id) =>
    (id ? FUCKBUFF_MODEL_CONTEXT_WINDOWS[id] : undefined) ??
    FUCKBUFF_DEFAULT_CONTEXT_WINDOW,
  resolveSelection: (id) => resolveSupportedFuckbuffModel(id),
  resolveForAccessTier: (id, accessTier, hasPaidSubscription) =>
    resolveFuckbuffModelForAccessTier(id, accessTier, hasPaidSubscription),
  withdrawnMessage: (id) => fuckbuffWithdrawnModelMessage(id),
  plansUrl: undefined,
}

/**
 * A catalog row in the shape the picker already draws. `id` is the KEY.
 *
 * The compiled presentation flags (`isNew`, `experimental`, `promotional`,
 * ...) stay unset on purpose: a catalog row says all of that through its
 * `badges`, which the picker draws generically, so a new kind of pill needs
 * no client release. Availability is always `always`: a row the server does
 * not want joined is one it does not list, or lists `locked`.
 */
export function fuckbuffCatalogRowModelOption(
  row: FuckbuffCatalogRow,
): FuckbuffModelOption {
  return {
    id: row.key,
    displayName: row.displayName,
    tagline: row.tagline,
    ...(row.taglineTooltip ? { taglineTooltip: row.taglineTooltip } : {}),
    availability: 'always',
    ...(row.warning ? { warning: row.warning } : {}),
    dataUse: row.dataUse,
    premium: row.premium,
    multimodal: row.multimodal,
    // Display only (the server owns the wire effort), so the option's
    // narrower provider-scale union is widened rather than a rung dropped.
    ...(row.reasoningEffort || row.defaultEffort
      ? {
          reasoningEffort: (row.reasoningEffort ??
            row.defaultEffort) as FuckbuffModelOption['reasoningEffort'],
        }
      : {}),
    ...(row.efforts?.length ? { efforts: row.efforts } : {}),
    ...(row.defaultEffort ? { defaultEffort: row.defaultEffort } : {}),
  }
}

export function catalogFuckbuffModelDirectory(
  catalog: FuckbuffModelCatalog,
  now: number = Date.now(),
): FuckbuffModelDirectory {
  // A row scheduled to open later does not exist for this client until it
  // opens: it
  // is never listed, selected, mapped onto, or sent. Every lookup below reads
  // these rows only, so no path through the directory can reach one.
  const listable = { rows: listableFuckbuffCatalogRows(catalog, now) }
  const rowsByKey = new Map(listable.rows.map((row) => [row.key, row]))
  const options = new Map(
    listable.rows.map((row) => [row.key, fuckbuffCatalogRowModelOption(row)]),
  )
  /** The row an id or key names: a key directly, a legacy id by digest. */
  const rowFor = (id: string | null | undefined) =>
    id
      ? (rowsByKey.get(id) ?? findFuckbuffCatalogRowForLegacyId(listable, id))
      : undefined
  const keyForLegacy = (legacyId: string) =>
    findFuckbuffCatalogRowForLegacyId(listable, legacyId)?.key
  const recommendedKey = (() => {
    if (catalog.recommendedKey && rowsByKey.has(catalog.recommendedKey))
      return catalog.recommendedKey
    return (
      listable.rows.find((row) => row.access === 'open')?.key ??
      listable.rows[0]?.key ??
      FALLBACK_FUCKBUFF_MODEL_ID
    )
  })()
  const fallbackKey =
    catalog.fallbackKey && rowsByKey.has(catalog.fallbackKey)
      ? catalog.fallbackKey
      : recommendedKey
  const rewardKey = keyForLegacy(FUCKBUFF_REWARD_MODEL_ID)
  const limitedOfferKeys = new Set(
    FUCKBUFF_LIMITED_OFFER_MODEL_IDS.flatMap((id) => {
      const key = keyForLegacy(id)
      return key ? [key] : []
    }),
  )
  const displayNameOf = (id: string) =>
    rowFor(id)?.displayName ?? getFuckbuffModel(id).displayName

  return {
    catalog,
    pickerModels: () => [...options.values()],
    get: (id) => {
      const row = rowFor(id)
      // An id no row names (a session admitted before the catalog arrived)
      // still gets its compiled name rather than a blank.
      return row ? options.get(row.key)! : getFuckbuffModel(id)
    },
    isKnown: (id) => rowFor(id) !== undefined,
    isPickerModel: (id) => rowFor(id) !== undefined,
    row: rowFor,
    efforts: (id) => {
      const efforts = rowFor(id)?.efforts
      return efforts && efforts.length > 0 ? efforts : null
    },
    defaultEffort: (id) => {
      const row = rowFor(id)
      if (!row?.efforts?.length) return null
      // Same rule as the compiled ladder: no stated default means the top.
      return row.defaultEffort ?? row.efforts[row.efforts.length - 1]!
    },
    isAvailable: (id) => rowFor(id) !== undefined,
    unavailableLabel: () => undefined,
    isPremium: (id) => rowFor(id)?.premium ?? false,
    isReward: (id) =>
      rewardKey !== undefined && rowFor(id)?.key === rewardKey,
    isLimitedOffer: (id) => {
      const key = rowFor(id)?.key
      return key !== undefined && limitedOfferKeys.has(key)
    },
    rewardModelId: rewardKey ?? FUCKBUFF_REWARD_MODEL_ID,
    fallbackModelId: fallbackKey,
    // The server already resolved the recommendation for THIS viewer; a
    // spent pool is handled by the picker stepping down to a joinable row.
    recommendedModelId: () => recommendedKey,
    // Supersession is a compiled concept. The catalog says it with a badge or
    // a warning, which the row already carries.
    supersededBy: () => undefined,
    // The server's per-viewer verdict, already folded into `access`.
    planRequired: (id) => rowFor(id)?.access === 'locked',
    badges: (id) => rowFor(id)?.badges ?? [],
    contextWindow: (id) =>
      rowFor(id)?.contextWindow ?? FUCKBUFF_DEFAULT_CONTEXT_WINDOW,
    resolveSelection: (id) => rowFor(id)?.key ?? recommendedKey,
    // The rows are already this viewer's; nothing else is admissible.
    resolveForAccessTier: (id) => rowFor(id)?.key ?? recommendedKey,
    withdrawnMessage: (id) =>
      `${displayNameOf(id)} is no longer available in Fuckbuff. We recommend using ${displayNameOf(recommendedKey)} instead.`,
    plansUrl: catalog.plansUrl,
  }
}

/** The handle a key is sent as, from the catalog held right now. A row that
 *  has not opened yet has no handle this client will send. */
export function fuckbuffCatalogHandleFor(
  catalog: FuckbuffModelCatalog | null,
  key: string,
  now: number = Date.now(),
): string | undefined {
  if (!catalog) return undefined
  return listableFuckbuffCatalogRows(catalog, now).find((row) => row.key === key)
    ?.handle
}
