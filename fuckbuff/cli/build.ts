#!/usr/bin/env bun

/**
 * Fuckbuff CLI build script.
 *
 * Wraps the existing CLI build-binary.ts with FUCKBUFF_MODE=true
 * to produce a free-only variant of the Codebuff CLI.
 *
 * Usage:
 *   bun fuckbuff/cli/build.ts <version>
 *
 * Example:
 *   bun fuckbuff/cli/build.ts 1.0.0
 */

import { spawnSync } from 'child_process'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(__dirname, '..', '..')

const version = process.argv[2]
if (!version) {
  console.error('Usage: bun fuckbuff/cli/build.ts <version>')
  process.exit(1)
}

console.log(`Building Fuckbuff v${version}...`)

const result = spawnSync(
  'bun',
  ['cli/scripts/build-binary.ts', 'fuckbuff', version],
  {
    cwd: repoRoot,
    stdio: 'inherit',
    env: {
      ...process.env,
      FUCKBUFF_MODE: 'true',
    },
  },
)

if (result.status !== 0) {
  console.error('Fuckbuff build failed')
  process.exit(result.status ?? 1)
}

console.log(`✅ Fuckbuff v${version} built successfully`)
