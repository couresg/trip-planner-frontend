/// <reference types="vitest/config" />
import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:8080', changeOrigin: true },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['src/test/setup.ts'],
    // 개발 PC(Asia/Seoul)는 일본 도시와 오프셋이 같아 브라우저 시간대로 잘못 표시해도 테스트가 통과한다.
    // 일부러 먼 시간대로 고정해 그런 실수가 드러나게 한다.
    env: { TZ: 'America/Los_Angeles' },
  },
})
