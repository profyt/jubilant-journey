import { describe, expect, it } from 'vitest';
import type { DatabaseDiagnostics } from '../src/client/createDatabase.js';

describe('DatabaseDiagnostics shape', () => {
  it('documents expected fields', () => {
    const sample: DatabaseDiagnostics = {
      workerMode: 'shared',
      crossTabTransport: 'shared-worker',
      queueDepth: 0,
      pending: 0,
      lastSyncAt: null,
      lastError: null,
      nextSyncAt: null,
      online: true,
      paused: false,
    };
    expect(sample.queueDepth).toBe(sample.pending);
  });
});
