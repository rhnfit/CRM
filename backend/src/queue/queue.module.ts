import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

export const NOTIFICATIONS_QUEUE = 'notifications';
export const SLA_QUEUE = 'sla';
export const STALE_LEADS_QUEUE = 'stale-leads';
export const AUTOMATION_QUEUE = 'automation';
export const WHATSAPP_OUTBOUND_QUEUE = 'whatsapp-outbound';

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const baseConnection = {
          maxRetriesPerRequest: 1,
          enableOfflineQueue: false,
        };
        const url = config.get<string>('REDIS_URL');
        if (!url) {
          return { connection: { host: 'localhost', port: 6379, ...baseConnection } };
        }
        // Parse redis://host:port or rediss://host:port
        try {
          const parsed = new URL(url);
          return {
            connection: {
              host: parsed.hostname,
              port: parsed.port ? Number(parsed.port) : 6379,
              password: parsed.password || undefined,
              tls: parsed.protocol === 'rediss:' ? {} : undefined,
              ...baseConnection,
            },
          };
        } catch {
          return { connection: { host: 'localhost', port: 6379, ...baseConnection } };
        }
      },
    }),
    BullModule.registerQueue(
      { name: NOTIFICATIONS_QUEUE },
      { name: SLA_QUEUE },
      { name: STALE_LEADS_QUEUE },
      { name: AUTOMATION_QUEUE },
      { name: WHATSAPP_OUTBOUND_QUEUE },
    ),
  ],
  exports: [BullModule],
})
export class QueueModule {}
