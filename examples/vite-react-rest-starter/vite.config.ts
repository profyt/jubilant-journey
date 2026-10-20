import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { createMockSyncMiddleware } from './mockSyncMiddleware';

const root = path.resolve(__dirname, '../..');

/** Dev/preview mock REST for pull/push with Authorization checks. */
function mockSyncApi(): Plugin {
  return {
    name: 'mock-sync-api',
    configureServer(server) {
      server.middlewares.use(createMockSyncMiddleware());
    },
    configurePreviewServer(server) {
      server.middlewares.use(createMockSyncMiddleware());
    },
  };
}

const base = process.env.VITE_BASE || '/';

export default defineConfig({
  base,
  plugins: [react(), mockSyncApi()],
  resolve: {
    alias: {
      'worker-sync-db/react': path.resolve(root, 'dist/react/index.js'),
      'worker-sync-db': path.resolve(root, 'dist/index.js'),
    },
  },
  worker: { format: 'es' },
  server: {
    port: 5174,
    fs: { allow: [root, __dirname] },
  },
  optimizeDeps: {
    exclude: ['worker-sync-db'],
  },
  build: {
    assetsDir: 'assets',
  },
});
