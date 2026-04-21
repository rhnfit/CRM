import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from './redis.service';

type Fallback<T> = () => Promise<T>;
type Operation<T> = () => Promise<T>;

@Injectable()
export class SafeRedisService {
  private readonly log = new Logger(SafeRedisService.name);

  constructor(private readonly redis: RedisService) {}

  async execute<T>(
    operationName: string,
    operation: Operation<T>,
    fallback: Fallback<T>,
    retries = 2,
  ): Promise<T> {
    if (!this.redis.enabled()) {
      return fallback();
    }

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const healthy = await this.redis.ping();
        if (!healthy) break;
        return await operation();
      } catch {
        if (attempt === retries) {
          this.log.warn(`${operationName} failed after retries, using fallback`);
          break;
        }
      }
    }

    return fallback();
  }

  async get(key: string): Promise<string | null> {
    return this.execute('redis.get', () => this.redis.get(key), async () => null);
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    return this.execute(
      'redis.set',
      () => this.redis.set(key, value, ttlSeconds),
      async () => undefined,
    );
  }

  async del(key: string): Promise<void> {
    return this.execute('redis.del', () => this.redis.del(key), async () => undefined);
  }

  async incr(key: string, fallback: Fallback<number>): Promise<number> {
    return this.execute('redis.incr', () => this.redis.incr(key), fallback);
  }
}
