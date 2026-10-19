import {
  DEFAULT_FUCKBUFF_MODEL_ID,
  resolveAvailableFuckbuffModel,
} from '@codebuff/common/constants/fuckbuff-models'
import {
  getFreebucksInfo,
  getFuckbuffServerAccessTier,
  getSubscriptionInfo,
} from '@codebuff/common/types/fuckbuff-session'
import { getFuckbuffModelPresets } from '@codebuff/common/util/fuckbuff-model-presets'
import { getFuckbuffModelMeter } from '@codebuff/common/util/fuckbuff-session-pools'
import { create } from 'zustand'

import { getFuckbuffModelDirectory } from './fuckbuff-catalog-store'
import {
  loadFuckbuffCatalogReasoningEfforts,
  loadFuckbuffModelKeyPreference,
  loadFuckbuffModelPreference,
  loadFuckbuffReasoningEfforts,
  saveFuckbuffCatalogReasoningEffort,
  saveFuckbuffModelKeyPreference,
  saveFuckbuffModelPreference,
  saveFuckbuffReasoningEffort,
} from '../utils/settings'

import type { FuckbuffSessionResponse } from '../types/fuckbuff-session'
import type { ReasoningEffort } from '@codebuff/common/constants/reasoning-effort'

/**
 * Holds the user's currently-selected fuckbuff model. Initialized from the
 * persisted settings file so fuckbuff defaults to whatever model the user
 * last picked.
 *
 * `setSelectedModel` is in-memory only — it does NOT persist. Persistence
 * happens on an explicit model pick (`selectFuckbuffChatModel`, or the legacy
 * `startFuckbuffSession` picker path), so
 * server-driven auto-flips (`model_locked`, `model_unavailable`, takeover)
 * can update the in-memory selection without overwriting the user's saved
 * preference. The latter previously caused users to get permanently flipped
 * to the fallback model after a single auto-fallback.
 *
 * Components on the landing screen read this to highlight the current row in
 * the model picker; the session hook reads it to decide which model to start.
 *
 * Reasoning effort is the opposite: `setReasoningEffort` DOES persist, because
 * every write to it is an explicit user act (the model picker). There is no
 * server-driven effort flip to protect against — the server clamps rather than
 * telling the client what it chose.
 *
 * In catalog mode (docs/fuckbuff-model-catalog.md) `selectedModel` holds a
 * catalog KEY rather than a model id, the same value the session response
 * carries there. Keys and ids never collide, so both kinds share this field
 * and the effort map; the directory decides what a value means.
 */
interface FuckbuffModelStore {
  selectedModel: string
  setSelectedModel: (model: string) => void
  /** Until the user picks, the selection follows fuckbuffDefaultModelForSession. */
  hasExplicitPick: boolean
  /** Per-model effort overrides. A model absent from this map runs its catalog
   *  default; see saveFuckbuffReasoningEffort for why absence is the "default"
   *  state rather than a stored null. */
  reasoningEffortByModel: Record<string, ReasoningEffort>
  setReasoningEffort: (
    model: string,
    effort: ReasoningEffort | undefined,
  ) => void
}

const savedFuckbuffModelPick = loadFuckbuffModelPreference()

export const useFuckbuffModelStore = create<FuckbuffModelStore>((set) => ({
  selectedModel: resolveAvailableFuckbuffModel(
    savedFuckbuffModelPick ?? DEFAULT_FUCKBUFF_MODEL_ID,
  ),
  setSelectedModel: (model) =>
    set({ selectedModel: getFuckbuffModelDirectory().resolveSelection(model) }),
  hasExplicitPick:
    savedFuckbuffModelPick !== undefined ||
    loadFuckbuffModelKeyPreference() !== undefined,
  reasoningEffortByModel: {
    ...loadFuckbuffReasoningEfforts(),
    ...loadFuckbuffCatalogReasoningEfforts(),
  },
  setReasoningEffort: (model, effort) => {
    if (getFuckbuffModelDirectory().row(model)?.key === model) {
      saveFuckbuffCatalogReasoningEffort(model, effort)
    } else {
      saveFuckbuffReasoningEffort(model, effort)
    }
    set((state) => {
      const next = { ...state.reasoningEffortByModel }
      if (effort === undefined) {
        delete next[model]
      } else {
        next[model] = effort
      }
      return { reasoningEffortByModel: next }
    })
  },
}))

/** Imperative read for non-React callers (the session hook's tick loop and
 *  the chat-completions metadata builder). */
export function getSelectedFuckbuffModel(): string {
  return useFuckbuffModelStore.getState().selectedModel
}

/** The Desktop and Web slider's Balanced stop, or the catalog's
 *  recommendation when the meter cannot start it, as on Desktop and Web. */
export function fuckbuffDefaultModelForSession(
  session: FuckbuffSessionResponse,
): string {
  const directory = getFuckbuffModelDirectory()
  const accessTier = getFuckbuffServerAccessTier(session)
  const freebucks = getFreebucksInfo(session)
  const isSubscriber = Boolean(
    getSubscriptionInfo(session)?.tierId ?? freebucks?.planId,
  )
  const balanced = getFuckbuffModelPresets({
    accessTier,
    isSubscriber,
    balance: freebucks?.balance,
    // The catalog's rows, so a catalog-only stop (MiMo v2.6 Flash Slow) is offered only
    // while it is listed and open, and the server's pick for this viewer (MiMo
    // Slow for a planless limited account). Without a catalog the compiled
    // ladder stands.
    ...(directory.catalog
      ? {
          models: directory
            .pickerModels(accessTier, isSubscriber)
            .map((model) => ({
              id: model.id,
              displayName: model.displayName,
              available: !directory.planRequired(
                model.id,
                isSubscriber,
                freebucks,
              ),
            })),
          recommendedModelId: directory.recommendedModelId(accessTier),
        }
      : {}),
  }).find((preset) => preset.id === 'balanced')!
  const model = directory.resolveSelection(balanced.modelId)
  return getFuckbuffModelMeter({ model, freebucks }).canStart
    ? model
    : directory.recommendedModelId(accessTier)
}

/**
 * The user's effort override for a model, or null when they have none.
 *
 * Re-checked against the model's CURRENT ladder on every read rather than
 * trusted from the map. A rung can leave a catalog row between the save and
 * this read (a client update, a model re-tuned), and sending a rung the model
 * no longer offers is worse than sending nothing: the server would clamp it
 * down to something the user never picked, while sending nothing lands on the
 * model's own default — the same place a fresh user lands.
 */
export function getFuckbuffReasoningEffortForModel(
  model: string,
): ReasoningEffort | null {
  const directory = getFuckbuffModelDirectory()
  const efforts = useFuckbuffModelStore.getState().reasoningEffortByModel
  const saved = efforts[model] ?? legacyEffortForCatalogKey(model, efforts)
  if (!saved) return null
  return directory.efforts(model)?.includes(saved) ? saved : null
}

/**
 * A catalog row with no effort of its own inherits the one saved for the
 * compiled model it replaces, so a user's pick survives the move to the
 * catalog. Read-only: the first explicit choice on the row is what persists.
 */
function legacyEffortForCatalogKey(
  key: string,
  efforts: Record<string, ReasoningEffort>,
): ReasoningEffort | undefined {
  const directory = getFuckbuffModelDirectory()
  if (directory.row(key)?.key !== key) return undefined
  for (const [id, effort] of Object.entries(efforts)) {
    if (id !== key && directory.row(id)?.key === key) return effort
  }
  return undefined
}

/**
 * Persist an explicit pick so the next launch opens on it: the row key in
 * catalog mode, the model id in fallback mode (which also clears the saved
 * key; see `saveFuckbuffModelPreference`).
 */
export function persistFuckbuffModelPick(model: string): void {
  useFuckbuffModelStore.setState({ hasExplicitPick: true })
  if (getFuckbuffModelDirectory().row(model)?.key === model) {
    saveFuckbuffModelKeyPreference(model)
  } else {
    saveFuckbuffModelPreference(model)
  }
}

/** What a turn on this model will ACTUALLY run at, override or not — the value
 *  the pickers display. Null when the model exposes no ladder. */
export function getEffectiveFuckbuffReasoningEffort(
  model: string,
): ReasoningEffort | null {
  return (
    getFuckbuffReasoningEffortForModel(model) ??
    getFuckbuffModelDirectory().defaultEffort(model)
  )
}

/** The override for whichever model is selected right now. Sent verbatim as
 *  `fuckbuff_reasoning_effort`; null means "send nothing". */
export function getSelectedFuckbuffReasoningEffort(): ReasoningEffort | null {
  return getFuckbuffReasoningEffortForModel(getSelectedFuckbuffModel())
}
