import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { AutomationModule } from '../automation/automation.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import {
  AUTOMATION_QUEUE,
  NOTIFICATIONS_QUEUE,
  SLA_QUEUE,
  STALE_LEADS_QUEUE,
  WHATSAPP_OUTBOUND_QUEUE,
} from '../queue/queue.module';
import { AutomationQueueProcessor, WhatsappOutboundProcessor } from './queue.processor';
import { WorkersService } from './workers.service';

@Module({
  imports: [
    AutomationModule,
    IntegrationsModule,
    BullModule.registerQueue(
      { name: SLA_QUEUE },
      { name: STALE_LEADS_QUEUE },
      { name: NOTIFICATIONS_QUEUE },
      { name: AUTOMATION_QUEUE },
      { name: WHATSAPP_OUTBOUND_QUEUE },
    ),
  ],
  providers: [WorkersService, AutomationQueueProcessor, WhatsappOutboundProcessor],
})
export class WorkersModule {}
