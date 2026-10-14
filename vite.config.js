import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'shared'),
      '@lib': path.resolve(__dirname, 'src/lib'),
      '@components': path.resolve(__dirname, 'src/components'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8787',
    },
  },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1600,
  },
});
