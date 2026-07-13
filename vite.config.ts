import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

/**
 * Rolldown-native vendor split.
 *
 * Vite 8 / Rolldown에서 `rollupOptions.output.manualChunks`는 더 이상
 * 노출되지 않고, `rolldownOptions.output.manualChunks`로 옮겨졌다. (이전
 * 시도에서 rollupOptions에 두니 build error: 'manualChunks' does not exist
 * in type 'RolldownOptions'.) function form이 가장 portable.
 *
 * 효과: react/react-dom/react-router, supabase, framer-motion이 각각 별도
 * vendor 청크로 추출되어 entry chunk에서 빠짐. 첫 페인트 TTI 개선 +
 * vendor URL이 안정되어 long-term cache 적중률 ↑.
 *
 * trade-off: 헤더 import chain(Layout → Header → NotificationCenter)에서
 * NotificationCenter는 이미 lazy로 분리되어 framer-motion이 entry 그래프에
 * 안 들어옴. 따라서 manualChunks는 entry에서 framer-motion을 빼는 것보단
 * entry가 더 작아지지 않도록 만드는 안전망 역할. 명백한 효과는 entry 청크
 * 축소가 아닌 vendor URL의 cache-friendliness.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rolldownOptions: {
      output: {
        manualChunks(id) {
          if (
            id.includes('node_modules/react/') ||
            id.includes('node_modules/react-dom/') ||
            id.includes('node_modules/react-router') ||
            id.includes('node_modules/@remix-run') ||
            id.includes('node_modules/scheduler/')
          ) {
            return 'vendor-react';
          }
          if (id.includes('node_modules/@supabase/')) {
            return 'vendor-supabase';
          }
          if (
            id.includes('node_modules/framer-motion') ||
            id.includes('node_modules/motion-') ||
            id.includes('node_modules/motion/')
          ) {
            return 'vendor-framer';
          }
          return undefined;
        },
      },
    },
  },
})
