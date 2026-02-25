import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': resolve(__dirname, 'src') },
  },
  // 상대경로 — Tauri 커스텀 프로토콜과 웹 배포 모두 호환
  base: './',
  build: {
    outDir: './dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:46123',
        changeOrigin: true,
      },
    },
  },
  clearScreen: false,
});
