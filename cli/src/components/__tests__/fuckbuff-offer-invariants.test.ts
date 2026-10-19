// The CLI can offer two kinds of fuckbuff row: the picker grid, and the referral banner's earned
// GLM 5.2 action. Both end up as a POST the server gates, and as a free-mode root agent that has
// to allow the model — so a row this surface can show must survive all of it. Desktop shipped the
// mirror-image of this bug (an offered GLM row its own route answered 400 for), which is what
// these lock down here.

import { describe, expect, test } from 'bun:test'

import { getFuckbuffRootAgentIdForModel } from '@codebuff/common/constants/free-agents'
import {
  FUCKBUFF_LIMITED_TIER_PLAN_ONLY_MODEL_IDS,
  FUCKBUFF_PRO_ONLY_CATALOG_MODEL_IDS,
  FUCKBUFF_REWARD_MODEL_ID,
  getFuckbuffModelsForAccessTier,
  FUCKBUFF_GLM_V52_MODEL_ID,
  FUCKBUFF_GPT_6_LUNA_MODEL_ID,
  LIMITED_FUCKBUFF_MODEL_ID,
} from '@codebuff/common/constants/fuckbuff-models'
import { fuckbuffOfferViolations } from '@codebuff/common/testing/fuckbuff-offer-invariants'
import { fuckbuffPlanRequired } from '@codebuff/common/util/fuckbuff-model-selection'

import {
  resolveFuckbuffModelPickForSession,
  resolveFuckbuffModelSelectionForSession,
} from '../../hooks/use-fuckbuff-session'
import { fuckbuffCliOfferedModelIds } from '../fuckbuff-model-selector'

import type { FuckbuffAccessTier } from '@codebuff/common/constants/fuckbuff-models'
import type { FuckbuffSessionResponse } from '../../types/fuckbuff-session'

function cliAcceptsModel(
  model: string,
  accessTier: FuckbuffAccessTier,
  hasPaidSubscription = false,
): boolean {
  const session: FuckbuffSessionResponse = {
    status: 'none',
    accessTier,
    ...(hasPaidSubscription
      ? { subscription: { tierId: 'starter', tiers: [] } }
      : {}),
  }
  return resolveFuckbuffModelPickForSession(model, session) === model
}

/** The plan-lock list the server sends a planless viewer on this tier
 *  (`planRequiredModelIds` in web/src/server/free-session/public-api.ts). */
const serverLockList = (accessTier: FuckbuffAccessTier) =>
  accessTier === 'full'
    ? FUCKBUFF_PRO_ONLY_CATALOG_MODEL_IDS
    : FUCKBUFF_LIMITED_TIER_PLAN_ONLY_MODEL_IDS

/** Whether the picker draws this row LOCKED for a planless account, both
 *  with the server's verdict and with the tier fallback an older server (or
 *  an unavailable balance) leaves it on. The two must agree. */
const lockedForPlanless = (model: string, accessTier: FuckbuffAccessTier) => {
  const withVerdict = fuckbuffPlanRequired(
    model,
    false,
    { planRequiredModelIds: serverLockList(accessTier) },
    accessTier,
  )
  expect(fuckbuffPlanRequired(model, false, undefined, accessTier)).toBe(
    withVerdict,
  )
  return withVerdict
}

describe('fuckbuff rows the CLI offers', () => {
  // Every row the picker offers a planless account is either USABLE on the
  // tier, or LOCKED: drawn with no price, and a press opens the plans page
  // instead of starting a session (`fuckbuffPlanRequired`). Locked rows are
  // listed at full access since 2026-09-21 and at limited access since
  // 2026-09-30, and the subscriber cases below hold them to the usable bar.
  for (const accessTier of ['full', 'limited'] as const) {
    test(`are all usable or locked on the ${accessTier} tier`, () => {
      expect(
        fuckbuffOfferViolations({
          surface: `cli picker + referral banner (${accessTier})`,
          accessTier,
          offered: fuckbuffCliOfferedModelIds(accessTier).filter(
            (model) =>
              // Full access admits a paid-only row at the tier layer (the plan
              // gate is `checkProOnlyModel`), so only limited needs the filter.
              accessTier === 'full' || !lockedForPlanless(model, accessTier),
          ),
          // the CLI's own resolver, which every session start runs the selection through: a model
          // it coerces away is one the user picked and never got
          accepts: (model) => cliAcceptsModel(model, accessTier),
          rootAgentIdFor: getFuckbuffRootAgentIdForModel,
          catalog: 'supported',
        }),
      ).toEqual([])
    })
  }

  // A paid plan reaches limited regions, so a limited-region subscriber's grid gains the models
  // their plan meters. Its own surface: the CLI's own resolver has to keep the pick too, or the
  // user picks the model they bought and the session starts on MiMo.
  test('are all usable on the limited tier for a subscriber', () => {
    expect(
      fuckbuffOfferViolations({
        surface: 'cli picker + referral banner (limited, subscriber)',
        accessTier: 'limited',
        hasPaidSubscription: true,
        offered: fuckbuffCliOfferedModelIds('limited', true),
        accepts: (model) => cliAcceptsModel(model, 'limited', true),
        rootAgentIdFor: getFuckbuffRootAgentIdForModel,
        catalog: 'supported',
      }),
    ).toEqual([])
  })

  // The plan widens what may be PICKED, never what the free pools give. Since
  // 2026-09-30 it does not change which rows are LISTED either — only which
  // are locked — so the two grids are the same rows.
  test('the limited grid keeps every free row for a subscriber', () => {
    const free = fuckbuffCliOfferedModelIds('limited')
    const paid = fuckbuffCliOfferedModelIds('limited', true)
    expect(paid).toEqual(free)
    for (const id of free) {
      expect(fuckbuffPlanRequired(id, true, undefined, 'limited')).toBe(false)
    }
  })

  // The locked rows at limited access are EXACTLY the ones the server locks
  // for a planless viewer there: a row locked here but open on the server
  // hides something admission allows, and one open here but locked on the
  // server is the offered-but-refused row this file exists to catch.
  test('the limited grid locks exactly the server-locked rows for a planless account', () => {
    const offered = fuckbuffCliOfferedModelIds('limited')
    const locked = offered.filter((id) => lockedForPlanless(id, 'limited'))
    expect(locked).toEqual(
      offered.filter((id) =>
        FUCKBUFF_LIMITED_TIER_PLAN_ONLY_MODEL_IDS.includes(id),
      ),
    )
    expect(locked.length).toBeGreaterThan(0)
  })

  test('a limited subscriber startup keeps their saved plan model selected', () => {
    const paidSession: FuckbuffSessionResponse = {
      status: 'none',
      accessTier: 'limited',
      subscription: { tierId: 'starter', tiers: [] },
    }
    const unpaidSession: FuckbuffSessionResponse = {
      status: 'none',
      accessTier: 'limited',
    }

    expect(
      resolveFuckbuffModelSelectionForSession(
        FUCKBUFF_GPT_6_LUNA_MODEL_ID,
        paidSession,
        true,
      ),
    ).toBe(FUCKBUFF_GPT_6_LUNA_MODEL_ID)
    expect(
      resolveFuckbuffModelSelectionForSession(
        FUCKBUFF_GPT_6_LUNA_MODEL_ID,
        unpaidSession,
        true,
      ),
    ).toBe(LIMITED_FUCKBUFF_MODEL_ID)
  })

  test('the earned reward is offered on BOTH tiers', () => {
    // Limited access included: a bounty grant is redeemable there, so the row
    // has to be reachable there. The banner still only renders it against a
    // live balance.
    //
    // At FULL access it is also in the GRID since 2026-08-31 — the reward model
    // is GLM 5.3 Flash, an ordinary unmetered row and the CLI's default pick.
    // The old assertion that the grid never shows it was correct only while the
    // reward was GLM 5.2, which no tier's catalog listed.
    expect(fuckbuffCliOfferedModelIds('full')).toContain(
      FUCKBUFF_REWARD_MODEL_ID,
    )
    expect(fuckbuffCliOfferedModelIds('limited')).toContain(
      FUCKBUFF_REWARD_MODEL_ID,
    )
    // GLM 5.3 Flash is directly selectable in the limited grid as well.
    expect(getFuckbuffModelsForAccessTier('limited').map((m) => m.id)).toContain(
      FUCKBUFF_REWARD_MODEL_ID,
    )
  })

  // 'base2-free' is the fallback root, and its allowlist has never included the referral reward.
  // A GLM row that fell through to it would 403 with free_mode_invalid_agent_model on the first
  // turn instead of failing at selection, so the mapping is what keeps the reward runnable.
  test('the reward maps to its own root agent rather than the fallback', () => {
    expect(getFuckbuffRootAgentIdForModel(FUCKBUFF_GLM_V52_MODEL_ID)).toBe(
      'base2-free-glm',
    )
  })
})
