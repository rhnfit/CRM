import { Global, Module } from '@nestjs/common';
import { RedisHealthService } from './redis-health.service';
import { RedisService } from './redis.service';
import { SafeRedisService } from './safe-redis.service';

@Global()
@Module({
  providers: [RedisService, RedisHealthService, SafeRedisService],
  exports: [RedisService, RedisHealthService, SafeRedisService],
})
export class RedisModule {}
