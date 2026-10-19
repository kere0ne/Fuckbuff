import type { FuckbuffIpPrivacySignal } from '../types/fuckbuff-session'

export const FUCKBUFF_HARD_BLOCKED_PRIVACY_SIGNALS = [
  'vpn',
  'proxy',
  'tor',
  'res_proxy',
] as const satisfies readonly FuckbuffIpPrivacySignal[]

type FuckbuffHardBlockedPrivacySignal =
  (typeof FUCKBUFF_HARD_BLOCKED_PRIVACY_SIGNALS)[number]

const FUCKBUFF_HARD_BLOCKED_PRIVACY_SIGNAL_SET =
  new Set<FuckbuffIpPrivacySignal>(FUCKBUFF_HARD_BLOCKED_PRIVACY_SIGNALS)

const FUCKBUFF_HARD_BLOCKED_PRIVACY_SIGNAL_LABELS: Record<
  FuckbuffHardBlockedPrivacySignal,
  string
> = {
  vpn: 'VPN',
  proxy: 'proxy',
  res_proxy: 'proxy',
  tor: 'Tor',
}

export function isFuckbuffHardBlockedPrivacySignal(
  signal: FuckbuffIpPrivacySignal,
): signal is FuckbuffHardBlockedPrivacySignal {
  return FUCKBUFF_HARD_BLOCKED_PRIVACY_SIGNAL_SET.has(signal)
}

export function formatFuckbuffHardBlockedPrivacySignals(
  signals: readonly FuckbuffIpPrivacySignal[] | null | undefined,
): string {
  const labels = Array.from(
    new Set(
      (signals ?? []).flatMap((signal): string[] => {
        if (!isFuckbuffHardBlockedPrivacySignal(signal)) return []
        return [FUCKBUFF_HARD_BLOCKED_PRIVACY_SIGNAL_LABELS[signal]]
      }),
    ),
  )

  if (labels.length === 0) return 'VPN, proxy, or Tor'
  if (labels.length === 1) return labels[0]
  return `${labels.slice(0, -1).join(', ')} or ${labels[labels.length - 1]}`
}

export function formatFuckbuffHardBlockedMessage(
  signals: readonly FuckbuffIpPrivacySignal[] | null | undefined,
): string {
  return `Fuckbuff cannot be used from ${formatFuckbuffHardBlockedPrivacySignals(
    signals,
  )} traffic. Please disable it and try again.`
}
