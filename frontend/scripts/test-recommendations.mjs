import { build } from 'esbuild'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

// Use the existing Vite JSX transformer; no additional test dependency is needed.
const bundle = await build({
  entryPoints: [fileURLToPath(new URL('../src/features/recommendations/RecommendationResults.test.jsx', import.meta.url))],
  bundle: true,
  write: false,
  platform: 'node',
  format: 'cjs',
  jsx: 'automatic',
  external: ['react', 'react/*', 'react-dom/*'],
  loader: { '.css': 'empty' },
  define: { 'import.meta.env': '{}' },
})
const compiled = { exports: {} }
new Function('require', 'module', 'exports', bundle.outputFiles[0].text)(createRequire(import.meta.url), compiled, compiled.exports)
