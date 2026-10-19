import { SUPPORTED_FUCKBUFF_MODELS } from '../constants/fuckbuff-models'
import { fuckbuffLegacyModelDigest } from '../types/fuckbuff-model-catalog'

import type { FuckbuffCatalogRow } from '../types/fuckbuff-model-catalog'

const COMPILED_ID_BY_DIGEST: ReadonlyMap<string, string> = new Map(
  SUPPORTED_FUCKBUFF_MODELS.map((model) => [
    fuckbuffLegacyModelDigest(model.id),
    model.id,
  ]),
)

/**
 * The compiled model id a server-catalog row replaces, by its legacy digests;
 * undefined for a catalog-only row. The CLI and Desktop both read it wherever
 * local policy is still keyed by compiled ids (which harness a row runs, the
 * picker's compiled flags), because a row's handle is opaque.
 */
export function compiledFuckbuffModelIdOfRow(
  row: Pick<FuckbuffCatalogRow, 'legacyDigests'>,
): string | undefined {
  for (const digest of row.legacyDigests ?? []) {
    const id = COMPILED_ID_BY_DIGEST.get(digest)
    if (id) return id
  }
  return undefined
}
