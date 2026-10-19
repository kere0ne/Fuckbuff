import { listableFuckbuffCatalogRows } from '@codebuff/common/types/fuckbuff-model-catalog'
import { create } from 'zustand'

import {
  catalogFuckbuffModelDirectory,
  compiledFuckbuffModelDirectory,
} from '../utils/fuckbuff-model-directory'

import type { FuckbuffModelDirectory } from '../utils/fuckbuff-model-directory'
import type { FuckbuffModelCatalog } from '@codebuff/common/types/fuckbuff-model-catalog'

/**
 * The server model catalog this process holds, if any
 * (docs/fuckbuff-model-catalog.md). In memory only: a catalog carries handles,
 * which are minted per account and rotate, so none of it is ever written to
 * disk.
 *
 * `catalog !== null` IS catalog mode. Everything that differs between the two
 * modes reads `directory`, which is the compiled directory whenever there is
 * no catalog, so fallback mode is the pre-catalog behaviour by construction.
 *
 * Deliberately dependency-free (no settings, no session, no model store): the
 * model store and the session API read it, and the fetch controller
 * (utils/fuckbuff-model-catalog.ts) is the only writer.
 */
interface FuckbuffCatalogStore {
  catalog: FuckbuffModelCatalog | null
  directory: FuckbuffModelDirectory
  /**
   * Refetch the catalog after the server answered `fuckbuff_catalog_stale`.
   * Resolves true when a fresh catalog is now held (retry with the new
   * handle), false otherwise (surface the error). Registered by the
   * controller while it runs; null means nobody can refresh.
   */
  refreshAfterStale: (() => Promise<boolean>) | null
}

export const useFuckbuffCatalogStore = create<FuckbuffCatalogStore>(() => ({
  catalog: null,
  directory: compiledFuckbuffModelDirectory,
  refreshAfterStale: null,
}))

/** Replace the held catalog (null returns to fallback mode). Only the fetch
 *  controller and tests call this; it does not reconcile any selection.
 *
 *  Rows that have not opened yet (scheduled launches) are dropped here, before
 *  anything can read them, so the held catalog only ever has rows this client
 *  may list, select and send. A row that opens later appears with the next
 *  fetch (the server schedules one by `refreshAt`). */
export function setFuckbuffCatalog(catalog: FuckbuffModelCatalog | null): void {
  const now = Date.now()
  const held = catalog ? withoutUnopenedRows(catalog, now) : null
  useFuckbuffCatalogStore.setState({
    catalog: held,
    directory: held
      ? catalogFuckbuffModelDirectory(held, now)
      : compiledFuckbuffModelDirectory,
  })
}

function withoutUnopenedRows(
  catalog: FuckbuffModelCatalog,
  now: number,
): FuckbuffModelCatalog {
  const rows = listableFuckbuffCatalogRows(catalog, now)
  return rows.length === catalog.rows.length ? catalog : { ...catalog, rows }
}

export function getFuckbuffCatalog(): FuckbuffModelCatalog | null {
  return useFuckbuffCatalogStore.getState().catalog
}

export function isFuckbuffCatalogMode(): boolean {
  return useFuckbuffCatalogStore.getState().catalog !== null
}

/** Imperative read for non-React callers. */
export function getFuckbuffModelDirectory(): FuckbuffModelDirectory {
  return useFuckbuffCatalogStore.getState().directory
}

/** The directory for render code; re-renders when the mode or catalog changes. */
export function useFuckbuffModelDirectory(): FuckbuffModelDirectory {
  return useFuckbuffCatalogStore((s) => s.directory)
}
