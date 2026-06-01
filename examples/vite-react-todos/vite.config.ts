import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'worker-sync-db': path.resolve(__dirname, '../..'),
    },
  },
  server: {
    port: 5173,
    fs: { allow: ['..', '../..'] },
  },
  optimizeDeps: {
    exclude: ['worker-sync-db'],
  },
});
