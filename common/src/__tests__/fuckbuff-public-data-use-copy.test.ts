import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  FUCKBUFF_AI_TRAINING_NOTICE,
  FUCKBUFF_DATA_USE_GENERATED_MARKDOWN_BLOCK,
  FUCKBUFF_DATA_USE_GENERATED_MDX_BLOCK,
  FUCKBUFF_POLICY_METADATA,
  FUCKBUFF_PUBLIC_DATA_USE_COPY,
  renderFuckbuffDataUseFaqMarkdown,
  renderFuckbuffDataUseFaqMdx,
} from '../constants/fuckbuff-data-use'

const REPO_ROOT = resolve(import.meta.dir, '../../..')

function readRepoFile(path: string): string {
  return readFileSync(resolve(REPO_ROOT, path), 'utf8')
}

function generatedBlock(
  source: string,
  markers: { start: string; end: string },
): string {
  const start = source.indexOf(markers.start)
  const end = source.indexOf(markers.end, start)

  expect(start).toBeGreaterThanOrEqual(0)
  expect(end).toBeGreaterThan(start)

  return source.slice(start, end + markers.end.length)
}

describe('public Fuckbuff data-use copy', () => {
  test('the legal metadata stays aligned', () => {
    expect(FUCKBUFF_POLICY_METADATA).toEqual({
      version: '2026-11-12',
      effectiveDate: 'November 12, 2026',
      lastUpdated: 'October 13, 2026',
      privacyPolicyLastUpdated: 'October 18, 2026',
    })
    expect(FUCKBUFF_AI_TRAINING_NOTICE).toBe('May use data for AI training')
    expect(FUCKBUFF_PUBLIC_DATA_USE_COPY.storageAnswer).not.toContain(
      'Starting ',
    )
  })

  test.each([
    [
      'README.md',
      FUCKBUFF_DATA_USE_GENERATED_MARKDOWN_BLOCK,
      renderFuckbuffDataUseFaqMarkdown(),
    ],
    [
      'fuckbuff/cli/release/README.md',
      FUCKBUFF_DATA_USE_GENERATED_MARKDOWN_BLOCK,
      renderFuckbuffDataUseFaqMarkdown(),
    ],
    [
      'web/src/content/advanced/privacy.mdx',
      FUCKBUFF_DATA_USE_GENERATED_MDX_BLOCK,
      renderFuckbuffDataUseFaqMdx(),
    ],
    [
      'web/src/content/help/faq.mdx',
      FUCKBUFF_DATA_USE_GENERATED_MDX_BLOCK,
      renderFuckbuffDataUseFaqMdx(),
    ],
  ] as const)('%s matches canonical generated copy', (path, markers, copy) => {
    expect(generatedBlock(readRepoFile(path), markers)).toBe(copy)
  })

  test('landing-lab uses the canonical data-use FAQ', () => {
    expect(readRepoFile('landing-lab/src/components/sections/Faq.tsx'))
      .toContain(`    q: '${FUCKBUFF_PUBLIC_DATA_USE_COPY.storageQuestion}',
    a: '${FUCKBUFF_PUBLIC_DATA_USE_COPY.storageAnswer}',`)
  })
})
