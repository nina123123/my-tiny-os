import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // Relative base so the build works on GitHub Pages (/my-tiny-os/) or any custom domain.
  base: './',
  // Lets several dev servers run side by side without fighting over the dep-optimizer cache.
  cacheDir: process.env.VITE_CACHE_DIR || 'node_modules/.vite',
  plugins: [react()],
})
