import { build } from 'esbuild'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const bundle = await build({
  entryPoints: [fileURLToPath(new URL('../src/features/spaces/spaces.test.jsx', import.meta.url))],
  bundle: true, write: false, platform: 'node', format: 'cjs', jsx: 'automatic',
  external: ['react', 'react/*', 'react-dom/*', '@tanstack/react-query', 'axios'],
  loader: { '.css': 'empty' }, define: { 'import.meta.env': '{}' },
  alias: { '@/shared/api/client': fileURLToPath(new URL('../src/shared/api/client.js', import.meta.url)) },
})
const compiled = { exports: {} }
new Function('require', 'module', 'exports', bundle.outputFiles[0].text)(createRequire(import.meta.url), compiled, compiled.exports)
