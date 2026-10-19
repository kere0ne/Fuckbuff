import { describe, expect, test } from 'bun:test'

import { fuckbuffAdmissionNotice } from '../use-fuckbuff-chat-admission'

import type { FuckbuffSessionResponse } from '../../types/fuckbuff-session'

describe('fuckbuffAdmissionNotice', () => {
  test('a suspended account is pointed at the appeal page', () => {
    const notice = fuckbuffAdmissionNotice({
      status: 'banned',
    } as FuckbuffSessionResponse)
    expect(notice).toContain('https://freebuff.com/account?tab=standing')
    expect(notice).toContain('support@freebuff.com')
  })

  test('a Freebucks shortfall is told in hours', () => {
    const notice = fuckbuffAdmissionNotice({
      status: 'rate_limited',
      freebucksShortfall: { price: 15, balance: 7 },
    } as FuckbuffSessionResponse)
    expect(notice).toStartWith('Not enough hours: 1 hour available.')
    expect(notice).not.toContain('Freebucks')
  })
})
