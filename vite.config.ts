import { readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

/** Size of every public download, read at build time so the Overview never lists a stale size. */
const downloadDirectory = fileURLToPath(new URL('./public/downloads/', import.meta.url))
const downloadBytes = Object.fromEntries(
  readdirSync(downloadDirectory).map((name) => [name, statSync(`${downloadDirectory}${name}`).size]),
)

export default defineConfig({
  base: './',
  plugins: [react()],
  define: {
    __DOWNLOAD_BYTES__: JSON.stringify(downloadBytes),
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
})
