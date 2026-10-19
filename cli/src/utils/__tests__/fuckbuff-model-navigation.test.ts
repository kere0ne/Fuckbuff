import { describe, expect, test } from 'bun:test'

import {
  fuckbuffModelNavigationDirectionForKey,
  nextFuckbuffModelId,
} from '../fuckbuff-model-navigation'

describe('nextFuckbuffModelId', () => {
  test('moves to the next model when moving forward', () => {
    const modelIds = ['glm', 'minimax']

    expect(
      nextFuckbuffModelId({
        modelIds,
        focusedId: 'minimax',
        direction: 'forward',
      }),
    ).toBe('glm')
  })

  test('moves to the previous model when moving backward', () => {
    const modelIds = ['glm', 'minimax']

    expect(
      nextFuckbuffModelId({
        modelIds,
        focusedId: 'minimax',
        direction: 'backward',
      }),
    ).toBe('glm')
  })

  test('wraps through every model regardless of selectability', () => {
    const modelIds = ['glm', 'minimax', 'other']

    expect(
      nextFuckbuffModelId({
        modelIds,
        focusedId: 'minimax',
        direction: 'forward',
      }),
    ).toBe('other')
  })

  test('returns null when no model exists', () => {
    expect(
      nextFuckbuffModelId({
        modelIds: [],
        focusedId: 'glm',
        direction: 'forward',
      }),
    ).toBeNull()
  })
})

describe('fuckbuffModelNavigationDirectionForKey', () => {
  test('maps arrow keys to model navigation directions', () => {
    expect(fuckbuffModelNavigationDirectionForKey({ name: 'down' })).toBe(
      'forward',
    )
    expect(fuckbuffModelNavigationDirectionForKey({ name: 'right' })).toBe(
      'forward',
    )
    expect(fuckbuffModelNavigationDirectionForKey({ name: 'up' })).toBe(
      'backward',
    )
    expect(fuckbuffModelNavigationDirectionForKey({ name: 'left' })).toBe(
      'backward',
    )
  })

  test('maps tab and shift-tab to model navigation directions', () => {
    expect(fuckbuffModelNavigationDirectionForKey({ name: 'tab' })).toBe(
      'forward',
    )
    expect(
      fuckbuffModelNavigationDirectionForKey({ name: 'tab', shift: true }),
    ).toBe('backward')
  })

  test('maps terminal tab sequences to model navigation directions', () => {
    expect(fuckbuffModelNavigationDirectionForKey({ sequence: '\t' })).toBe(
      'forward',
    )
    expect(
      fuckbuffModelNavigationDirectionForKey({ sequence: '\x1b[9u' }),
    ).toBe('forward')
    expect(
      fuckbuffModelNavigationDirectionForKey({ sequence: '\x1b[Z' }),
    ).toBe('backward')
    expect(
      fuckbuffModelNavigationDirectionForKey({ sequence: '\x1b[9;2u' }),
    ).toBe('backward')
    expect(
      fuckbuffModelNavigationDirectionForKey({ sequence: '\x1b[27;2;9~' }),
    ).toBe('backward')
  })

  test('ignores non-navigation keys', () => {
    expect(fuckbuffModelNavigationDirectionForKey({ name: 'enter' })).toBeNull()
  })
})
