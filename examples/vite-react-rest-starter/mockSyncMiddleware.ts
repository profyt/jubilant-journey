/**
 * Tiny in-memory REST sync backend for the starter (Vite middleware).
 * Demonstrates Authorization header checks + push/pull contract.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { STARTER_AUTH_TOKEN } from './src/sync/auth.js';

type Doc = {
  id: string;
  title: string;
  _version: number;
  _updatedAt: number;
  _deleted?: boolean;
};

const store = new Map<string, Doc>();

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(Buffer.from(c)));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function json(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

export function createMockSyncMiddleware(): (
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void,
) => void {
  return (req, res, next) => {
    void (async () => {
      const url = req.url ?? '';
      if (!url.startsWith('/api/sync/')) {
        next();
        return;
      }

      const auth = req.headers.authorization ?? '';
      if (auth !== `Bearer ${STARTER_AUTH_TOKEN}`) {
        json(res, 401, {
          error: `Unauthorized — send Authorization: Bearer ${STARTER_AUTH_TOKEN}`,
        });
        return;
      }

      if (req.method === 'GET' && url.startsWith('/api/sync/pull')) {
        const u = new URL(url, 'http://local');
        const since = Number(u.searchParams.get('cursor') ?? '0') || 0;
        const changes = [...store.values()]
          .filter((d) => d._updatedAt > since)
          .map((doc) => ({
            collection: 'notes',
            kind: doc._deleted ? 'delete' : 'put',
            doc,
          }));
        json(res, 200, {
          changes,
          nextCursor: String(Date.now()),
        });
        return;
      }

      if (req.method === 'POST' && url.startsWith('/api/sync/push')) {
        const raw = await readBody(req);
        const body = JSON.parse(raw || '{}') as {
          ops?: Array<{
            opId: string;
            doc: Doc;
          }>;
        };
        const applied: string[] = [];
        for (const op of body.ops ?? []) {
          store.set(op.doc.id, { ...op.doc });
          applied.push(op.opId);
        }
        json(res, 200, { applied, conflicts: [] });
        return;
      }

      json(res, 404, { error: 'not found' });
    })();
  };
}
