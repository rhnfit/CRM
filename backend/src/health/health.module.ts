import { Module } from '@nestjs/common';
import { DbHealthService } from './db-health.service';
import { HealthController } from './health.controller';
import { QueueHealthService } from './queue-health.service';

@Module({
  controllers: [HealthController],
  providers: [DbHealthService, QueueHealthService],
})
export class HealthModule {}
