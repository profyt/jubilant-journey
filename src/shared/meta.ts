export interface DocumentMeta {
  id: string;
  _version: number;
  _updatedAt: number;
  _deleted?: boolean;
}

export const META_KEYS = ['id', '_version', '_updatedAt', '_deleted'] as const;

export function stripMeta<T extends Record<string, unknown>>(
  doc: T,
): Omit<T, keyof DocumentMeta> {
  const result = { ...doc };
  for (const key of META_KEYS) {
    delete result[key];
  }
  return result as Omit<T, keyof DocumentMeta>;
}

export function withMeta(
  id: string,
  payload: Record<string, unknown>,
  existing?: DocumentMeta | null,
): DocumentMeta & Record<string, unknown> {
  const now = Date.now();
  const version = existing ? existing._version + 1 : 1;
  const { id: _ignored, _version, _updatedAt, _deleted, ...rest } = payload;
  void _ignored;
  void _version;
  void _updatedAt;
  void _deleted;
  return {
    ...rest,
    id,
    _version: version,
    _updatedAt: now,
  };
}

export function withSoftDelete(
  doc: DocumentMeta & Record<string, unknown>,
): DocumentMeta & Record<string, unknown> {
  return {
    ...doc,
    _deleted: true,
    _version: doc._version + 1,
    _updatedAt: Date.now(),
  };
}
