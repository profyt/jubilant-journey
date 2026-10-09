import { useEffect, useState } from 'react';
import type { DatabaseClient } from '../client/createDatabase.js';
import type { CollectionSchema } from '../shared/schema.js';
import type { SyncStatus } from '../sync/RemoteSyncAdapter.js';
import { resolveDatabase, useDatabaseContext } from './DatabaseProvider.js';

export function useSyncStatus<S extends CollectionSchema>(
  db?: DatabaseClient<S> | null,
): SyncStatus | null {
  const ctx = useDatabaseContext();
  const client = resolveDatabase(db, ctx);
  const [status, setStatus] = useState<SyncStatus | null>(null);

  useEffect(() => {
    if (!client) {
      setStatus(null);
      return;
    }

    let cancelled = false;
    void client.getSyncStatus().then((s) => {
      if (!cancelled) setStatus(s);
    });

    const unsub = client.onSyncStatusChange(setStatus);
    return () => {
      cancelled = true;
      unsub();
    };
  }, [client]);

  return status;
}
