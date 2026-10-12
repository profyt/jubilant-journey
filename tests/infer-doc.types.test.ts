import { describe, expectTypeOf, it } from 'vitest';
import { defineCollection, defineSchema } from '../src/shared/defineSchema.js';
import type { DocInput, InferDoc } from '../src/shared/schema.js';

describe('InferDoc typing', () => {
  it('preserves fields from defineCollection', () => {
    const schema = defineSchema({
      todos: defineCollection<{
        id: string;
        title: string;
        status: 'open' | 'done';
      }>({
        keyPath: 'id',
        indexes: { byStatus: 'status' },
      }),
      notes: {
        keyPath: 'id',
      },
    });

    type Todo = InferDoc<typeof schema, 'todos'>;
    type Note = InferDoc<typeof schema, 'notes'>;
    type TodoIn = DocInput<typeof schema, 'todos'>;

    expectTypeOf<Todo>().toMatchTypeOf<{
      id: string;
      title: string;
      status: 'open' | 'done';
      _version: number;
      _updatedAt: number;
    }>();

    expectTypeOf<TodoIn>().toMatchTypeOf<{
      id: string;
      title: string;
      status: 'open' | 'done';
    }>();

    // Untyped collection stays loose
    expectTypeOf<Note>().toMatchTypeOf<Record<string, unknown> & { id: string }>();
  });
});
