export type DbErrorCode =
  | 'NotFound'
  | 'Conflict'
  | 'WorkerDead'
  | 'SchemaMismatch'
  | 'NotConnected'
  | 'Timeout'
  | 'InvalidRequest'
  | 'StorageError';

export interface DbError {
  code: DbErrorCode;
  message: string;
}

export function dbError(code: DbErrorCode, message: string): DbError {
  return { code, message };
}

export class DatabaseError extends Error {
  readonly code: DbErrorCode;

  constructor(error: DbError) {
    super(error.message);
    this.name = 'DatabaseError';
    this.code = error.code;
  }
}
