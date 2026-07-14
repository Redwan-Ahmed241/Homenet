import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { LoggerService } from '../logger/logger.service.js';
import type { ICacheService } from './cache.service.interface.js';

@Injectable()
export class CacheService implements ICacheService {
  constructor(
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly logger: LoggerService,
  ) {}

  async get<T>(key: string): Promise<T | undefined> {
    const value = await this.cacheManager.get<T>(key);
    if (value !== undefined) {
      this.logger.debug(`Cache hit: ${key}`, {
        fileName: 'cache.service.ts',
        functionName: 'get',
        lineNumber: 16,
      });
    } else {
      this.logger.debug(`Cache miss: ${key}`, {
        fileName: 'cache.service.ts',
        functionName: 'get',
        lineNumber: 21,
      });
    }
    return value;
  }

  async set(key: string, value: unknown, ttl?: number): Promise<void> {
    await this.cacheManager.set(key, value, ttl);
    this.logger.trace(`Cache set: ${key}${ttl ? ` ttl=${ttl}` : ''}`, {
      fileName: 'cache.service.ts',
      functionName: 'set',
      lineNumber: 29,
    });
  }

  async del(key: string): Promise<void> {
    await this.cacheManager.del(key);
    this.logger.trace(`Cache del: ${key}`, {
      fileName: 'cache.service.ts',
      functionName: 'del',
      lineNumber: 35,
    });
  }

  async getOrSet<T>(key: string, fetchFn: () => Promise<T>, ttl?: number): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== undefined) {
      return cached;
    }
    const value = await fetchFn();
    await this.set(key, value, ttl);
    return value;
  }

  async delMany(keys: string[]): Promise<void> {
    await Promise.all(keys.map((key) => this.del(key)));
  }

  generateKey(prefix: string, ...parts: (string | number | object)[]): string {
    const serialized = parts.map((p) => {
      if (typeof p === 'object') return JSON.stringify(p);
      return String(p);
    });
    return `${prefix}:${serialized.join(':')}`;
  }
}
