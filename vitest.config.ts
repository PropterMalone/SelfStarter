import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '*.config.*',
        'src/main.tsx',
        'src/popup/index.tsx',
        'src/popup/App.tsx',
        'src/popup/hooks/',
        'src/types/',
        'src/popup/components/index.ts',
      ],
    },
  },
})
