import { useQuery } from '@tanstack/react-query'

import { getAuthToken } from '../utils/auth'
import { getApiClient, setApiClientAuthToken } from '../utils/codebuff-api'
import { logger as defaultLogger } from '../utils/logger'

import type { FuckbuffStreakResponse } from '@codebuff/common/types/fuckbuff-streak'
import type { Logger } from '@codebuff/common/types/contracts/logger'

export const fuckbuffStreakQueryKeys = {
  all: ['fuckbuffStreak'] as const,
  current: () => [...fuckbuffStreakQueryKeys.all, 'current'] as const,
}

export async function fetchFuckbuffStreak(params: {
  authToken: string
  logger?: Logger
}): Promise<FuckbuffStreakResponse> {
  const { authToken, logger = defaultLogger } = params
  setApiClientAuthToken(authToken)
  const response = await getApiClient().get<FuckbuffStreakResponse>(
    '/api/v1/freebuff/streak',
    { retry: false },
  )

  if (!response.ok) {
    logger.error(
      { status: response.status, error: response.error },
      'Failed to fetch fuckbuff streak',
    )
    throw new Error(`Failed to fetch fuckbuff streak (HTTP ${response.status})`)
  }

  if (!response.data) {
    throw new Error('Failed to fetch fuckbuff streak: empty response')
  }

  return response.data
}

export function useFuckbuffStreakQuery(
  params: {
    enabled?: boolean
    logger?: Logger
  } = {},
) {
  const { enabled = true, logger = defaultLogger } = params
  const authToken = getAuthToken()

  return useQuery({
    queryKey: fuckbuffStreakQueryKeys.current(),
    queryFn: () => fetchFuckbuffStreak({ authToken: authToken!, logger }),
    enabled: enabled && !!authToken,
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    retry: false,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
}
