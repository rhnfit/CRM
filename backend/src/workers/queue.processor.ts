import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { AutomationService } from '../automation/automation.service';
import { IntegrationsService } from '../integrations/integrations.service';
import {
  AUTOMATION_QUEUE,
  WHATSAPP_OUTBOUND_QUEUE,
} from '../queue/queue.module';

@Processor(AUTOMATION_QUEUE)
export class AutomationQueueProcessor extends WorkerHost {
  private readonly log = new Logger(AutomationQueueProcessor.name);

  constructor(private readonly automation: AutomationService) {
    super();
  }

  async process(job: Job<{ flowId: string; leadId: string; fromStep: number; runStartedAt: string }>) {
    if (job.name !== 'resume-flow') return;
    await this.automation.resumeFlow(
      job.data.flowId,
      job.data.leadId,
      job.data.fromStep,
      job.data.runStartedAt,
    );
    this.log.debug(`Resumed automation flow ${job.data.flowId} for lead ${job.data.leadId}`);
  }
}

@Processor(WHATSAPP_OUTBOUND_QUEUE)
export class WhatsappOutboundProcessor extends WorkerHost {
  constructor(private readonly integrations: IntegrationsService) {
    super();
  }

  async process(job: Job<{ messageId: string }>) {
    if (job.name !== 'send-outbound') return;
    await this.integrations.dispatchOutboundWhatsapp(job.data.messageId);
  }
}

