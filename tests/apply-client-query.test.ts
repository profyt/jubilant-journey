import { describe, expect, it } from 'vitest';
import { applyClientQueryOptions } from '../src/client/applyClientQuery.js';

describe('applyClientQueryOptions', () => {
  const rows = [
    { id: '1', title: 'Banana', status: 'open' },
    { id: '2', title: 'Apple', status: 'done' },
    { id: '3', title: 'Cherry', status: 'open' },
  ];

  it('filters and sorts then limits', () => {
    const result = applyClientQueryOptions(rows, {
      filter: (d) => d.status === 'open',
      orderBy: { field: 'title', direction: 'asc' },
      limit: 1,
    });
    expect(result).toEqual([{ id: '1', title: 'Banana', status: 'open' }]);
  });

  it('sorts descending', () => {
    const result = applyClientQueryOptions(rows, {
      orderBy: { field: 'title', direction: 'desc' },
    });
    expect(result.map((r) => r.title)).toEqual(['Cherry', 'Banana', 'Apple']);
  });
});
