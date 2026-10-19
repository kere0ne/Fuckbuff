import {
  FUCKBUFF_CLI_CATALOG_ROOT_AGENT_ID,
  getFuckbuffBase3RootAgentIdForModel,
  getFuckbuffRootAgentIdForModel,
} from '@codebuff/common/constants/free-agents'

import { getFuckbuffModelDirectory } from '../state/fuckbuff-catalog-store'
import { getSelectedFuckbuffModel } from '../state/fuckbuff-model-store'
import {
  AGENT_MODE_TO_ID,
  CLI_HARNESS,
  IS_FUCKBUFF,
  type AgentMode,
} from './constants'

/**
 * Fuckbuff is locked to LITE (chat-store's setAgentMode is a no-op when
 * IS_FUCKBUFF), so this is effectively "which root does the selected model
 * run". Both harnesses have a root per picker model; CLI_HARNESS picks the
 * family. Fable 5.1 is a deliberate base2 exception for its trace campaign.
 * The default is currently base3; keeping both branches live preserves the
 * release-based rollback path for the CLI.
 *
 * Takes a plain model id: a catalog row has no id and runs the catalog root
 * (see `getAgentIdForMode`).
 */
export function getFuckbuffCliAgentIdForModel(model: string): string {
  return CLI_HARNESS === 'base3'
    ? getFuckbuffBase3RootAgentIdForModel(model)
    : getFuckbuffRootAgentIdForModel(model)
}

/**
 * The root a turn on this selection runs. A catalog row (the selection is a
 * catalog key) runs the ONE catalog root, whose definition is built at runtime
 * from the row (`fuckbuffCatalogRootAgent`); a compiled model keeps its own.
 */
export function getFuckbuffCliAgentIdForSelection(selection: string): string {
  return getFuckbuffModelDirectory().row(selection)?.key === selection
    ? FUCKBUFF_CLI_CATALOG_ROOT_AGENT_ID
    : getFuckbuffCliAgentIdForModel(selection)
}

export function getAgentIdForMode(agentMode: AgentMode): string {
  if (IS_FUCKBUFF && agentMode === 'LITE') {
    return getFuckbuffCliAgentIdForSelection(getSelectedFuckbuffModel())
  }

  return AGENT_MODE_TO_ID[agentMode]
}
