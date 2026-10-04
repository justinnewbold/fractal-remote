import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const pkg = JSON.parse(readFileSync('./package.json', 'utf8'))

/**
 * Vercel exposes the commit as an env var; a local build has to ask git. Either
 * can be absent, so neither is assumed.
 */
function commit() {
  if (process.env.VERCEL_GIT_COMMIT_SHA) return process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 7)
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim()
  } catch {
    return 'local'
  }
}

/*
 * /version.json in every deploy: what the Developer page's What's live reads
 * (shared/whats-live.mjs) to say which version the website is on, without a
 * key or a guess.
 */
const versionFile = () => ({
  name: 'version-file',
  generateBundle() {
    this.emitFile({
      type: 'asset',
      fileName: 'version.json',
      source: `${JSON.stringify({ version: pkg.version, commit: commit(), built: new Date().toISOString().slice(0, 16).replace('T', ' ') })}\n`
    })
  }
})

export default defineConfig({
  plugins: [react(), versionFile()],
  define: {
    // Shown in the UI. Which build is running has been mistaken for a code bug
    // more than once, so it should be readable without asking.
    __APP_VERSION__: JSON.stringify(pkg.version),
    __COMMIT__: JSON.stringify(commit()),
    __BUILT_AT__: JSON.stringify(new Date().toISOString().slice(0, 16).replace('T', ' ')),
    __BUILD_STAMP__: JSON.stringify(new Date().toISOString().slice(0, 16).replace('T', ' '))
  },
  build: { outDir: 'dist' }
})
