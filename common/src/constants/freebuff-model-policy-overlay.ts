/**
 * A seam through which the SERVER's model catalog overrides the compiled
 * per-model policy: session price, effort ladder, which tiers may open a
 * model, and the daily session limit — and supplies models the compiled
 * catalog does not know at all.
 *
 * The compiled policy functions (freebucksSessionPrice,
 * getFuckbuffModelEfforts, isFuckbuffSessionModelAllowedForAccessTier, ...)
 * consult the registered overlay first and fall back to their compiled
 * answer when it has none. Only the web API registers one (from the stored
 * catalog, web/src/server/model-catalog/). Clients never do, so in a client
 * every function here behaves exactly as it did before the seam existed.
 *
 * Every method returns `undefined` for "no override" — never a default — so a
 * model the catalog leaves alone keeps its compiled behaviour.
 */
import type { FuckbuffModelOption } from './fuckbuff-models'
import type { ReasoningEffort } from './reasoning-effort'

/** How a tier sees a model: selectable, listed-but-paywalled, or absent. */
export type FuckbuffTierAccess = 'open' | 'locked' | 'hidden'

export interface FuckbuffModelPolicyOverlay {
  /** A model option for an id only the catalog knows (catalog-only model). */
  model?(modelId: string): FuckbuffModelOption | undefined
  /** Every enabled catalog model id (compiled and catalog-only), for callers
   *  that enumerate — a price map, a lock list. */
  catalogModelIds?(): readonly string[]
  /** Freebucks per session. 0 = unmetered-but-listed. */
  price?(modelId: string): number | undefined
  /** Crossed-out list price shown beside a discounted `price`. */
  listPrice?(modelId: string): number | undefined
  /** One-line notice that replaces the tagline in pickers. */
  priceNotice?(modelId: string): string | undefined
  /** A provider outage: refuse before tier fallback, purchases, or chat substitution. */
  unavailableMessage?(modelId: string): string | undefined
  efforts?(
    modelId: string,
  ):
    | { efforts: readonly ReasoningEffort[]; defaultEffort?: ReasoningEffort }
    | undefined
  tierAccess?(
    modelId: string,
    tier: 'full' | 'limited',
  ): FuckbuffTierAccess | undefined
  /** A `locked` model opens free for a viewer resolved to the US. */
  usOpen?(modelId: string): boolean | undefined
  /** `null` = explicitly no limit. */
  dailySessionLimit?(modelId: string): number | null | undefined
}

let overlay: FuckbuffModelPolicyOverlay | null = null

export function setFuckbuffModelPolicyOverlay(
  next: FuckbuffModelPolicyOverlay | null,
): void {
  overlay = next
}

export function getFuckbuffModelPolicyOverlay(): FuckbuffModelPolicyOverlay | null {
  return overlay
}
