import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly log = new Logger(RedisService.name);
  private readonly client: Redis | null;

  constructor(config: ConfigService) {
    const url = config.get<string>('REDIS_URL');
    if (!url || url === 'redis://') {
      this.log.warn('REDIS_URL not set — round-robin uses time-based fallback');
      this.client = null;
    } else {
      this.client = new Redis(url, { maxRetriesPerRequest: 2, lazyConnect: true });
    }
  }

  enabled(): boolean {
    return this.client !== null;
  }

  status(): string {
    return this.client?.status ?? 'disabled';
  }

  async ping(): Promise<boolean> {
    if (!this.client) return false;
    try {
      if (this.client.status === 'wait') await this.client.connect();
      return (await this.client.ping()) === 'PONG';
    } catch {
      return false;
    }
  }

  async get(key: string): Promise<string | null> {
    if (!this.client) return null;
    try {
      if (this.client.status === 'wait') await this.client.connect();
      return await this.client.get(key);
    } catch {
      return null;
    }
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    if (!this.client) return;
    try {
      if (this.client.status === 'wait') await this.client.connect();
      await this.client.setex(key, ttlSeconds, value);
    } catch {
      /* silently degrade */
    }
  }

  async del(key: string): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.del(key);
    } catch {
      /* silently degrade */
    }
  }

  async incr(key: string): Promise<number> {
    if (!this.client) {
      return Math.floor(Date.now() / 1000);
    }
    try {
      if (this.client.status === 'wait') {
        await this.client.connect();
      }
      return await this.client.incr(key);
    } catch {
      this.log.warn(`Redis incr failed for ${key}, using fallback`);
      return Math.floor(Date.now() / 1000);
    }
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.quit();
    }
  }
}
