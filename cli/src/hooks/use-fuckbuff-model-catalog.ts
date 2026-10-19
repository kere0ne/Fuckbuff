import { useEffect } from 'react'

import { getAuthTokenDetails } from '../utils/auth'
import { IS_FUCKBUFF } from '../utils/constants'
import { startFuckbuffModelCatalog } from '../utils/fuckbuff-model-catalog'

/**
 * Keeps the server model catalog (docs/fuckbuff-model-catalog.md) for the
 * signed-in account while mounted. Must be called BEFORE `useFuckbuffSession`
 * in the same component: effects run in order, and the session's first
 * request waits for the first catalog only if the fetch has already started.
 */
export function useFuckbuffModelCatalog({
  enabled = true,
}: { enabled?: boolean } = {}): void {
  useEffect(() => {
    if (!IS_FUCKBUFF || !enabled) return
    const { token } = getAuthTokenDetails()
    if (!token) return
    return startFuckbuffModelCatalog(token)
  }, [enabled])
}
