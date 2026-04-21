import { Controller, Get } from '@nestjs/common';
import { DbHealthService } from './db-health.service';
import { QueueHealthService } from './queue-health.service';
import { RedisHealthService } from '../redis/redis-health.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly redisHealth: RedisHealthService,
    private readonly dbHealth: DbHealthService,
    private readonly queueHealth: QueueHealthService,
  ) {}

  @Get('redis')
  async redis() {
    return this.redisHealth.getStatus();
  }

  @Get('db')
  async db() {
    return this.dbHealth.getStatus();
  }

  @Get('queue')
  async queue() {
    return this.queueHealth.getStatus();
  }

  @Get()
  async overall() {
    const [redis, db, queue] = await Promise.all([
      this.redisHealth.getStatus(),
      this.dbHealth.getStatus(),
      this.queueHealth.getStatus(),
    ]);
    return {
      status: redis.healthy && db.healthy && queue.healthy ? 'UP' : 'DEGRADED',
      redis,
      db,
      queue,
    };
  }
}
