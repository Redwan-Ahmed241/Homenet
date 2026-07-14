export const CACHE_TTL = {
  LIST: 300_000,
  DETAIL: 600_000,
} as const;

export interface ICacheService {
  get<T>(key: string): Promise<T | undefined>;

  set(key: string, value: unknown, ttl?: number): Promise<void>;

  del(key: string): Promise<void>;

  getOrSet<T>(key: string, fetchFn: () => Promise<T>, ttl?: number): Promise<T>;

  delMany(keys: string[]): Promise<void>;

  generateKey(prefix: string, ...parts: (string | number | object)[]): string;
}
