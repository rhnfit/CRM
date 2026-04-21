import { Injectable } from '@nestjs/common';
import { RedisService } from './redis.service';

@Injectable()
export class RedisHealthService {
  constructor(private readonly redis: RedisService) {}

  async getStatus() {
    const healthy = await this.redis.ping();
    return {
      healthy,
      status: healthy ? 'UP' : 'DOWN',
      client: this.redis.status(),
      enabled: this.redis.enabled(),
    };
  }
}
