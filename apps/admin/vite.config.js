import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { createRequire } from 'node:module'
import path from 'node:path'

const require = createRequire(import.meta.url)

// Kit de mise à jour : après le build, génère dist/sw.js et dist/version.json
// (voir deploy-kit/ à la racine du projet et docs/DEPLOIEMENT-SANS-INTERRUPTION.md).
function updateKit() {
  let outDir = 'dist'
  let root = process.cwd()
  return {
    name: 'shopika-update-kit',
    apply: 'build',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir)
      root = config.root
    },
    closeBundle() {
      const { buildUpdateKit } = require('./tools/build-update-kit.cjs')
      buildUpdateKit({
        root: outDir,
        prefix: 'shopika-admin',
        spa: true,
        releaseFile: path.join(root, 'release.json'),
        pkgFile: path.join(root, 'package.json'),
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), updateKit()],
  server: { port: 5173, strictPort: true }
})
