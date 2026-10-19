import { formatHours, formatHoursShort } from './fuckbuff-hours'

import type { FuckbuffSessionLedgerEntry } from '../types/fuckbuff-usage'

/**
 * The two lines a per-session charge reads as, so the hub, the CLI and Desktop
 * all describe one session's cost identically.
 *
 * Hours only, and never a fraction of one (`formatHours`, product 2026-10-15):
 * a return smaller than an hour would otherwise read as "0 hours" for balance
 * that really did come back, which is the opposite of what this list is for.
 * It says "Under 1 hr back" instead.
 */

/** Where the session's charge was drawn from, for the row's own line. */
export function fuckbuffChargeSourceText(
  entry: Pick<FuckbuffSessionLedgerEntry, 'charged' | 'chargedFromWallet'>,
): string | null {
  if (entry.chargedFromWallet <= 0) return null
  return entry.chargedFromWallet >= entry.charged
    ? 'From your wallet'
    : 'Part from your wallet'
}

/**
 * What came back from the hour, as text. `null` while the hour can still
 * return something — the caller says when it settles, in the reader's own
 * clock, which is the question behind every "my refund was 0" report.
 */
export function fuckbuffChargeReturnText(
  entry: Pick<FuckbuffSessionLedgerEntry, 'returned' | 'settlesAt'>,
  now: Date = new Date(),
): string | null {
  if (entry.settlesAt && new Date(entry.settlesAt).getTime() > now.getTime())
    return null
  if (entry.returned <= 0) return 'None back'
  // Positive but under an hour: the hour it belongs to is whole, so saying
  // "0 hrs" would deny a return that happened.
  if (formatHours(entry.returned) === '0') return 'Under 1 hr back'
  return `${formatHoursShort(entry.returned)} back`
}

/** What the session took when it started: always a whole number of hours. */
export function fuckbuffChargeChargedText(
  entry: Pick<FuckbuffSessionLedgerEntry, 'charged'>,
): string {
  return formatHoursShort(entry.charged)
}
