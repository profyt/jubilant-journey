import { defineConfig } from 'tsup';

const shared = {
  format: ['esm'] as const,
  dts: true,
  sourcemap: true,
  splitting: false,
  treeshake: true,
  target: 'es2022' as const,
};

export default defineConfig([
  {
    ...shared,
    entry: { index: 'src/index.ts' },
    clean: true,
    external: ['idb'],
  },
  {
    ...shared,
    entry: { 'react/index': 'src/react/index.ts' },
    external: ['react', 'react/jsx-runtime', 'react/jsx-dev-runtime'],
  },
  {
    ...shared,
    entry: {
      'shared-worker/entry': 'src/shared-worker/entry.ts',
      'dedicated-worker/entry': 'src/dedicated-worker/entry.ts',
    },
    external: ['idb'],
  },
]);
