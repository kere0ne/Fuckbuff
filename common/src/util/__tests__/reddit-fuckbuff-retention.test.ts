import { describe, expect, test } from 'bun:test'

import {
  getFuckbuffRetentionMilestonesToFire,
  isFirstFuckbuffPrompt,
  planFuckbuffRedditConversionEvents,
} from '@codebuff/common/util/reddit-fuckbuff-retention'

describe('isFirstFuckbuffPrompt', () => {
  test('returns true on first-ever usage day', () => {
    expect(
      isFirstFuckbuffPrompt({
        previousUsageDays: [],
        newUsageDayRecorded: true,
      }),
    ).toBe(true)
  })

  test('returns false on repeat prompts same day', () => {
    expect(
      isFirstFuckbuffPrompt({
        previousUsageDays: ['2026-06-30'],
        newUsageDayRecorded: false,
      }),
    ).toBe(false)
  })

  test('returns false on a later usage day', () => {
    expect(
      isFirstFuckbuffPrompt({
        previousUsageDays: ['2026-06-30'],
        newUsageDayRecorded: true,
      }),
    ).toBe(false)
  })
})

describe('getFuckbuffRetentionMilestonesToFire', () => {
  test('returns nothing on first-ever usage day', () => {
    expect(
      getFuckbuffRetentionMilestonesToFire({
        previousUsageDays: [],
        todayDateKey: '2026-06-30',
        newUsageDayRecorded: true,
      }),
    ).toEqual([])
  })

  test('returns nothing when no new usage day was recorded', () => {
    expect(
      getFuckbuffRetentionMilestonesToFire({
        previousUsageDays: ['2026-06-30'],
        todayDateKey: '2026-07-01',
        newUsageDayRecorded: false,
      }),
    ).toEqual([])
  })

  test('fires 1d retention on day 1', () => {
    expect(
      getFuckbuffRetentionMilestonesToFire({
        previousUsageDays: ['2026-06-30'],
        todayDateKey: '2026-07-01',
        newUsageDayRecorded: true,
      }),
    ).toEqual([1])
  })

  test('does not repeat 1d on day 2', () => {
    expect(
      getFuckbuffRetentionMilestonesToFire({
        previousUsageDays: ['2026-06-30', '2026-07-01'],
        todayDateKey: '2026-07-02',
        newUsageDayRecorded: true,
      }),
    ).toEqual([])
  })

  test('fires 7d retention on day 7', () => {
    expect(
      getFuckbuffRetentionMilestonesToFire({
        previousUsageDays: ['2026-06-30', '2026-07-01'],
        todayDateKey: '2026-07-07',
        newUsageDayRecorded: true,
      }),
    ).toEqual([7])
  })

  test('does not backfill missed milestones after a long gap', () => {
    expect(
      getFuckbuffRetentionMilestonesToFire({
        previousUsageDays: ['2026-06-01'],
        todayDateKey: '2026-07-01',
        newUsageDayRecorded: true,
      }),
    ).toEqual([])
  })

  test('fires 24d retention only on exact day 24', () => {
    expect(
      getFuckbuffRetentionMilestonesToFire({
        previousUsageDays: ['2026-06-01', '2026-06-02'],
        todayDateKey: '2026-06-25',
        newUsageDayRecorded: true,
      }),
    ).toEqual([24])
  })
})

describe('planFuckbuffRedditConversionEvents', () => {
  test('first prompt only on day 0', () => {
    expect(
      planFuckbuffRedditConversionEvents({
        previousUsageDays: [],
        todayDateKey: '2026-06-30',
        newUsageDayRecorded: true,
      }),
    ).toEqual({ fireFirstPrompt: true, retentionMilestones: [] })
  })

  test('1d retention without first prompt on day 1', () => {
    expect(
      planFuckbuffRedditConversionEvents({
        previousUsageDays: ['2026-06-30'],
        todayDateKey: '2026-07-01',
        newUsageDayRecorded: true,
      }),
    ).toEqual({ fireFirstPrompt: false, retentionMilestones: [1] })
  })
})
