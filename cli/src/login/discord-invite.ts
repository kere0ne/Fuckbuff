import {
  FUCKBUFF_DISCORD_INVITE_URL,
  FUCKBUFF_DISCORD_MEMBERS_LABEL,
} from '@codebuff/common/constants/fuckbuff-community'

/**
 * The line a fresh Fuckbuff sign-in ends on, in the TUI's top banner and in
 * `fuckbuff login --plain`: the moment someone has just joined is the one
 * most worth inviting them to talk to us. Fuckbuff only — Codebuff's
 * community is a different server.
 */
export const DISCORD_AFTER_LOGIN_TEXT = `Talk directly with our team and ${FUCKBUFF_DISCORD_MEMBERS_LABEL} community members on Discord:`

export { FUCKBUFF_DISCORD_INVITE_URL }
