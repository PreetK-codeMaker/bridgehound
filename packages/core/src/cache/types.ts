/**
 * Cache values must be JSON-safe. Callers serialize bigints via
 * `serializeBigInts` from ./serialize before calling `set`, and revive them
 * with `deserializeBigInts` after `get`. This keeps the contract honest
 * across in-memory and JSON-backed (Redis) implementations.
 */
export interface CacheAdapter {
  get<T>(key: string): Promise<T | null>
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>
  delete(key: string): Promise<void>
}
