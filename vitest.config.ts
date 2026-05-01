import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
  test: {
    projects: [
      {
        plugins: [],
        resolve: {
          alias: { '@': path.resolve(__dirname, '.') },
        },
        test: {
          name: 'monitor',
          environment: 'node',
          include: ['tests/**/*.test.ts'],
        },
      },
      {
        plugins: [react()],
        resolve: {
          alias: { '@': path.resolve(__dirname, '.') },
        },
        test: {
          name: 'studio',
          environment: 'jsdom',
          globals: true,
          setupFiles: ['./vitest.setup.ts'],
          fakeTimers: { toFake: ['Date'] },
          include: ['lib/studio/**/*.test.ts'],
        },
      },
    ],
  },
})
