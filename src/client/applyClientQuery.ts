import type { QueryOptions } from '../shared/schema.js';

/**
 * Apply client-only `filter` / `orderBy` / deferred `limit` after an IDB query.
 */
export function applyClientQueryOptions<T extends Record<string, unknown>>(
  rows: T[],
  opts: Pick<QueryOptions, 'filter' | 'orderBy' | 'limit'>,
): T[] {
  let next = rows;
  if (opts.filter) {
    next = next.filter((doc) => opts.filter!(doc));
  }
  if (opts.orderBy) {
    const dir = opts.orderBy.direction === 'desc' ? -1 : 1;
    const field = opts.orderBy.field;
    next = [...next].sort((a, b) => {
      const av = a[field];
      const bv = b[field];
      if (av === bv) return 0;
      if (av === undefined || av === null) return 1;
      if (bv === undefined || bv === null) return -1;
      return av < bv ? -dir : av > bv ? dir : 0;
    });
  }
  if (opts.limit !== undefined) {
    next = next.slice(0, opts.limit);
  }
  return next;
}
