import { randomUUID } from 'node:crypto'

import {
  FUCKBUFF_CLIENT_ENV_METADATA_KEY,
  FUCKBUFF_INPUT_PROFILE_METADATA_KEY,
} from '@codebuff/common/constants/fuckbuff-client-descriptor'
import { FUCKBUFF_CLI_CLAIM_PREFIX } from '@codebuff/common/constants/fuckbuff-desktop-sessions'

import { getClientEnvironmentDescriptor } from './client-environment'
import { takeInputProfile } from './input-profile'

// A new identity for each CLI purchase, never shared through settings or cwd.
// The prefix also lets delayed DELETE/refund requests retain their protocol
// after the picker has switched models (limited offers use the legacy path),
// and tells the server this claim may resume a legacy CLI hour.
const CLI_MULTI_SESSION_PREFIX = FUCKBUFF_CLI_CLAIM_PREFIX

export function newFuckbuffCliInstanceId(): string {
  return `${CLI_MULTI_SESSION_PREFIX}${randomUUID()}`
}

export function fuckbuffCliAttemptId(instanceId?: string): string | undefined {
  return instanceId?.startsWith(CLI_MULTI_SESSION_PREFIX)
    ? instanceId.slice(CLI_MULTI_SESSION_PREFIX.length)
    : undefined
}

export function fuckbuffSessionMetadata(instanceId: string) {
  return {
    fuckbuff_instance_id: instanceId,
    // Use the existing wire protocol so released servers can serve this CLI.
    // The surface distinguishes native clients now that both use this store.
    ...(fuckbuffCliAttemptId(instanceId)
      ? { fuckbuff_multi_session: '1', surface: 'cli' }
      : {}),
  }
}

/**
 * The client descriptors for a run: this process's environment summary and,
 * when the prompt came from the composer, its input counts.
 */
export function clientDescriptorMetadata(
  promptText: string,
): Record<string, string> {
  const inputProfile = takeInputProfile(promptText)
  return {
    [FUCKBUFF_CLIENT_ENV_METADATA_KEY]: getClientEnvironmentDescriptor(),
    ...(inputProfile
      ? { [FUCKBUFF_INPUT_PROFILE_METADATA_KEY]: inputProfile }
      : {}),
  }
}
