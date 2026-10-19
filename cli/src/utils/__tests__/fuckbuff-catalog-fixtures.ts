import { fuckbuffLegacyModelDigest } from '@codebuff/common/types/fuckbuff-model-catalog'

import type {
  FuckbuffCatalogRow,
  FuckbuffModelCatalog,
} from '@codebuff/common/types/fuckbuff-model-catalog'

/** A catalog row with sensible defaults; `legacyIds` become its digests. */
export function catalogRow(
  key: string,
  overrides: Partial<FuckbuffCatalogRow> & { legacyIds?: string[] } = {},
): FuckbuffCatalogRow {
  const { legacyIds, ...rest } = overrides
  return {
    key,
    handle: `fbm1.${key}-h1`,
    displayName: `Model ${key}`,
    tagline: `Tagline ${key}`,
    badges: [],
    multimodal: false,
    premium: false,
    dataUse: 'service',
    access: 'open',
    sortOrder: 10,
    ...(legacyIds
      ? { legacyDigests: legacyIds.map(fuckbuffLegacyModelDigest) }
      : {}),
    ...rest,
  }
}

export function catalogFixture(
  rows: FuckbuffCatalogRow[],
  overrides: Partial<FuckbuffModelCatalog> = {},
): FuckbuffModelCatalog {
  return {
    protocol: 1,
    version: 'v1',
    issuedAt: 1_000_000,
    refreshAt: 1_000_000 + 30 * 60_000,
    rows,
    recommendedKey: rows[0]?.key,
    fallbackKey: rows[rows.length - 1]?.key,
    plansUrl: 'https://freebuff.com/plans?from=catalog',
    ...overrides,
  }
}

/** Every catalog handle in a catalog, by key, re-minted as `-h<n>`. */
export function rotateHandles(
  catalog: FuckbuffModelCatalog,
  generation: number,
): FuckbuffModelCatalog {
  return {
    ...catalog,
    rows: catalog.rows.map((row) => ({
      ...row,
      handle: `fbm1.${row.key}-h${generation}`,
    })),
  }
}
