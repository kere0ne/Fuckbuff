import { describe, expect, test } from 'bun:test'

import {
  normalizeRepoFullName,
  repoFullNameFromRemote,
} from './sponsored-proposal-target'

describe('repoFullNameFromRemote', () => {
  // The three forms a real `origin` actually takes. All three have to land on
  // one key, or the same repository is two targets depending on how it was
  // cloned.
  for (const remote of [
    'https://github.com/codebuff/fuckbuff.git',
    'https://github.com/codebuff/fuckbuff',
    'git@github.com:codebuff/fuckbuff.git',
    'ssh://git@github.com/codebuff/fuckbuff.git',
    'https://user:token@github.com/codebuff/fuckbuff.git',
    '  git@github.com:Codebuff/Fuckbuff.git  ',
  ]) {
    test(`resolves ${remote.trim()}`, () => {
      expect(repoFullNameFromRemote(remote)).toBe('codebuff/fuckbuff')
    })
  }

  // Self-hosted still yields a stable key: the name's job is stability, not
  // provenance.
  test('keeps a non-GitHub host', () => {
    expect(repoFullNameFromRemote('git@git.example.com:team/app.git')).toBe(
      'team/app',
    )
  })

  test('takes the last two segments of a deeper path', () => {
    expect(
      repoFullNameFromRemote('https://gitlab.com/group/subgroup/app.git'),
    ).toBe('subgroup/app')
  })

  // Null is the ordinary answer, not an error: a folder with no GitHub remote
  // gets no proposal, and the caller's response is to offer nothing.
  for (const remote of [
    undefined,
    null,
    '',
    '   ',
    'not a remote',
    '/home/user/code/thing',
    'github.com',
    // A SCHEME IS NOT A HOST. `file://` satisfies the scheme test and then
    // leaves an absolute path behind, so without an explicit refusal the last
    // two directories of somebody's laptop became the repository name.
    'file:///home/user/code/thing',
    'file://./relative/thing',
  ]) {
    test(`refuses ${JSON.stringify(remote)}`, () => {
      expect(repoFullNameFromRemote(remote)).toBeNull()
    })
  }
})

describe('normalizeRepoFullName', () => {
  test('lowercases, so one repository is never two targets', () => {
    expect(normalizeRepoFullName('Codebuff/Fuckbuff')).toBe(
      'codebuff/fuckbuff',
    )
  })

  test('drops a trailing .git and surrounding slashes', () => {
    expect(normalizeRepoFullName('/codebuff/fuckbuff.git/')).toBe(
      'codebuff/fuckbuff',
    )
  })

  // This string becomes an index key and travels in a query parameter, so the
  // shape is a gate rather than a formatting nicety.
  for (const raw of [
    'codebuff',
    'codebuff/fuckbuff/extra',
    '../../etc/passwd',
    // `.` is inside the character class, so a dot-only segment matched the
    // shape test whole and a traversal reached the index key wearing exactly
    // the form the gate exists to enforce.
    '../..',
    './.',
    'codebuff/..',
    '../fuckbuff',
    'codebuff/free buff',
    'https://github.com/codebuff/fuckbuff',
    '',
  ]) {
    test(`refuses ${JSON.stringify(raw)}`, () => {
      expect(normalizeRepoFullName(raw)).toBeNull()
    })
  }
})
