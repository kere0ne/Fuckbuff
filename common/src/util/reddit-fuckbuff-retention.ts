const DAY_MS = 24 * 60 * 60 * 1000

/** PostHog-style retention windows to mirror in Reddit CAPI custom events. */
export const FUCKBUFF_REDDIT_RETENTION_MILESTONE_DAYS = [1, 7, 24] as const

export type FuckbuffRedditRetentionMilestoneDays =
  (typeof FUCKBUFF_REDDIT_RETENTION_MILESTONE_DAYS)[number]

export type FuckbuffRedditConversionPlan = {
  fireFirstPrompt: boolean
  retentionMilestones: FuckbuffRedditRetentionMilestoneDays[]
}

function daysBetween(fromDateKey: string, toDateKey: string): number {
  const from = new Date(`${fromDateKey}T00:00:00.000Z`).getTime()
  const to = new Date(`${toDateKey}T00:00:00.000Z`).getTime()
  if (Number.isNaN(from) || Number.isNaN(to)) {
    throw new Error(`Invalid date key range: ${fromDateKey} -> ${toDateKey}`)
  }
  return Math.round((to - from) / DAY_MS)
}

/** First successful fuckbuff prompt = first-ever usage day recorded. */
export function isFirstFuckbuffPrompt(params: {
  previousUsageDays: readonly string[]
  newUsageDayRecorded: boolean
}): boolean {
  return params.newUsageDayRecorded && params.previousUsageDays.length === 0
}

/** Exact calendar-day milestones reached by this newly recorded usage day. */
export function getFuckbuffRetentionMilestonesToFire(params: {
  previousUsageDays: readonly string[]
  todayDateKey: string
  newUsageDayRecorded: boolean
}): FuckbuffRedditRetentionMilestoneDays[] {
  if (!params.newUsageDayRecorded) {
    return []
  }

  const firstDay = [...params.previousUsageDays, params.todayDateKey].reduce(
    (min, dateKey) => (dateKey < min ? dateKey : min),
  )
  const daysSinceFirstToday = daysBetween(firstDay, params.todayDateKey)

  return FUCKBUFF_REDDIT_RETENTION_MILESTONE_DAYS.filter(
    (milestone) => daysSinceFirstToday === milestone,
  )
}

export function planFuckbuffRedditConversionEvents(params: {
  previousUsageDays: readonly string[]
  todayDateKey: string
  newUsageDayRecorded: boolean
}): FuckbuffRedditConversionPlan {
  return {
    fireFirstPrompt: isFirstFuckbuffPrompt(params),
    retentionMilestones: getFuckbuffRetentionMilestonesToFire(params),
  }
}
