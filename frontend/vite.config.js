import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import process from 'node:process'

// https://vitejs.dev/config/
export default defineConfig({
  cacheDir: '.vite-cache',
  plugins: [react()],
  server: {
    allowedHosts: process.env.SPACE_E2E_ISOLATED === '1' ? ['host.docker.internal'] : [],
  },
})
