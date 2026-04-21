import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import {
  AUTOMATION_QUEUE,
  NOTIFICATIONS_QUEUE,
  SLA_QUEUE,
  STALE_LEADS_QUEUE,
  WHATSAPP_OUTBOUND_QUEUE,
} from '../queue/queue.module';

@Injectable()
export class QueueHealthService {
  constructor(
    @InjectQueue(NOTIFICATIONS_QUEUE) private readonly notificationsQueue: Queue,
    @InjectQueue(SLA_QUEUE) private readonly slaQueue: Queue,
    @InjectQueue(STALE_LEADS_QUEUE) private readonly staleLeadsQueue: Queue,
    @InjectQueue(AUTOMATION_QUEUE) private readonly automationQueue: Queue,
    @InjectQueue(WHATSAPP_OUTBOUND_QUEUE) private readonly whatsappOutboundQueue: Queue,
  ) {}

  async getStatus() {
    const queues = [
      this.notificationsQueue,
      this.slaQueue,
      this.staleLeadsQueue,
      this.automationQueue,
      this.whatsappOutboundQueue,
    ];

    const checks = await Promise.all(
      queues.map(async (queue) => {
        try {
          const counts = await queue.getJobCounts(
            'waiting',
            'active',
            'completed',
            'failed',
            'delayed',
          );
          return { name: queue.name, healthy: true, status: 'UP', counts };
        } catch {
          return { name: queue.name, healthy: false, status: 'DOWN' };
        }
      }),
    );

    return {
      healthy: checks.every((q) => q.healthy),
      status: checks.every((q) => q.healthy) ? 'UP' : 'DEGRADED',
      queues: checks,
    };
  }
}
