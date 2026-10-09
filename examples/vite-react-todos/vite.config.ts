import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const root = path.resolve(__dirname, '../..');
const base = process.env.VITE_BASE || '/';

export default defineConfig({
  base,
  plugins: [react()],
  resolve: {
    alias: {
      'worker-sync-db/react': path.resolve(root, 'dist/react/index.js'),
      'worker-sync-db': path.resolve(root, 'dist/index.js'),
    },
  },
  worker: {
    format: 'es',
  },
  server: {
    port: 5173,
    fs: { allow: [root, __dirname] },
  },
  optimizeDeps: {
    exclude: ['worker-sync-db'],
  },
  build: {
    sourcemap: true,
    // Ensure worker assets keep hashed names under assets/ with the site base.
    assetsDir: 'assets',
  },
});
