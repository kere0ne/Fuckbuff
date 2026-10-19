// The label/dots/perk-note logic is shared with Fuckbuff Desktop and lives in
// common; this module re-exports it and adds the terminal rendering and layout
// gating only the CLI needs.
export {
  FUCKBUFF_STREAK_WEEK,
  getFuckbuffStreakBonusNote,
} from '@codebuff/common/util/fuckbuff-streak-line'
export type { FuckbuffStreakLine } from '@codebuff/common/util/fuckbuff-streak-line'

import {
  FUCKBUFF_STREAK_WEEK,
  getFuckbuffStreakBonusNote,
  getFuckbuffStreakLine as getSharedFuckbuffStreakLine,
} from '@codebuff/common/util/fuckbuff-streak-line'

import type { FuckbuffStreakLine } from '@codebuff/common/util/fuckbuff-streak-line'

const FUCKBUFF_STREAK_BONUS_MIN_HEIGHT = 30

/** Progress glyphs for a terminal — the same ●/○ pair the shared module and
 *  the desktop app use. Bullet and middle dot were tried here because U+25CF
 *  is missing from a few terminal fonts and lands as a tofu box, but • and ·
 *  differ only in size: at a glance a partial week and a full one look alike,
 *  which is the whole point of the row. Filled-vs-hollow reads instantly, and
 *  the CLI already bets on ●/○ for its agent status indicators, so a font that
 *  can't draw them is already visibly broken elsewhere.
 *
 *  If a font ever fails these, █/░ (Block Elements) is the fallback pair: the
 *  ASCII logo and the progress bar are built from them, so anything that
 *  renders the CLI at all renders those. */
const TERMINAL_DOT_CHARS = { filled: '●', empty: '○' }

/** The streak line as the CLI draws it. */
export function getFuckbuffStreakLine(
  streak: number,
): FuckbuffStreakLine | null {
  return getSharedFuckbuffStreakLine(streak, TERMINAL_DOT_CHARS)
}

/** Returns the earned perk note only when the landing layout can show it
 * without crowding the picker or wrapping onto additional rows. */
export function getFuckbuffStreakBonusNoteForLayout(params: {
  streak: number
  accessTier: 'full' | 'limited'
  /** From the streak response: Freebucks a streak day pays on the meter, or
   *  null/undefined (an older server) for the session copy. */
  freebucksDailyBonus?: number | null
  terminalHeight: number
  availableWidth: number
}): string | null {
  if (params.streak < FUCKBUFF_STREAK_WEEK) return null
  if (params.terminalHeight < FUCKBUFF_STREAK_BONUS_MIN_HEIGHT) return null

  const note = getFuckbuffStreakBonusNote(params)
  if (!note || note.length > params.availableWidth) return null

  return note
}
