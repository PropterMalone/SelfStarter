import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/SelfStarter/', // GitHub Pages serves from /<repo-name>/
  build: {
    outDir: 'dist',
  },
})
