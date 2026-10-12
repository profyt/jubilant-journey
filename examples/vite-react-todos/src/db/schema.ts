import { defineSchema } from 'worker-sync-db';

export const schema = defineSchema({
  todos: {
    keyPath: 'id',
    indexes: { byStatus: 'status' },
  },
  activity: {
    keyPath: 'id',
    indexes: { byAt: 'at' },
  },
});

export type TodoStatus = 'open' | 'done';

export type Todo = {
  id: string;
  title: string;
  status: TodoStatus;
  agent?: string;
};

export type TodoDoc = Todo & {
  _version: number;
  _updatedAt: number;
  _deleted?: boolean;
};

export type ActivityKind =
  | 'agent_write'
  | 'agent_toggle'
  | 'remote_pull'
  | 'sync'
  | 'user';

export type Activity = {
  id: string;
  at: number;
  kind: ActivityKind;
  agent: string;
  message: string;
};

export type ActivityDoc = Activity & {
  _version: number;
  _updatedAt: number;
  _deleted?: boolean;
};
