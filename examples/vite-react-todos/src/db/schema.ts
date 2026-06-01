import type { CollectionSchema } from 'worker-sync-db';

export const schema = {
  todos: {
    keyPath: 'id',
    indexes: { byStatus: 'status' },
  },
} as const satisfies CollectionSchema;

export type TodoStatus = 'open' | 'done';

export type Todo = {
  id: string;
  title: string;
  status: TodoStatus;
};

export type TodoDoc = Todo & {
  _version: number;
  _updatedAt: number;
  _deleted?: boolean;
};
