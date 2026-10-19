import { existsSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
export const REPO_ROOT = resolve(__dirname, '../../..')

export function getFuckbuffBinaryPath(): string {
  if (process.env.FUCKBUFF_BINARY) {
    return resolve(process.env.FUCKBUFF_BINARY)
  }
  return resolve(REPO_ROOT, 'cli/bin/fuckbuff')
}

export function requireFuckbuffBinary(): string {
  const binaryPath = getFuckbuffBinaryPath()
  if (!existsSync(binaryPath)) {
    throw new Error(
      `Fuckbuff binary not found at ${binaryPath}. ` +
        'Build with: bun fuckbuff/cli/build.ts <version>',
    )
  }
  return binaryPath
}
