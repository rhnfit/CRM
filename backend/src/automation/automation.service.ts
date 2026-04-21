import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  ActivityType,
  AutomationRunStatus,
  AutomationTriggerType,
  LeadStatus,
  MessageType,
  NotificationChannel,
  NotificationType,
  Prisma,
} from '@prisma/client';
import { Cron } from '@nestjs/schedule';
import { Queue } from 'bullmq';
import { IntegrationsService } from '../integrations/integrations.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { AUTOMATION_QUEUE } from '../queue/queue.module';
import { CreateFlowDto } from './dto/create-flow.dto';
import { CreateTemplateDto } from './dto/create-template.dto';

type FlowStep = {
  type: string;
  config?: Record<string, unknown>;
};

@Injectable()
export class AutomationService implements OnModuleInit {
  private readonly log = new Logger(AutomationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly integrations: IntegrationsService,
    private readonly notifications: NotificationsService,
    @InjectQueue(AUTOMATION_QUEUE) private readonly automationQueue: Queue,
  ) {}

  async onModuleInit() {
    await this.ensureDefaultFlows();
  }

  async listFlows() {
    return this.prisma.automationFlow.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async createFlow(dto: CreateFlowDto) {
    return this.prisma.automationFlow.create({
      data: {
        name: dto.name,
        triggerType: dto.triggerType,
        isActive: dto.isActive ?? true,
        steps: dto.steps as unknown as Prisma.InputJsonValue,
      },
    });
  }

  async listTemplates() {
    return this.prisma.whatsappTemplate.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async createTemplate(dto: CreateTemplateDto) {
    return this.prisma.whatsappTemplate.upsert({
      where: { name: dto.name },
      update: {
        language: dto.language ?? 'en',
        body: dto.body,
        variables: dto.variables ?? {},
        isActive: dto.isActive ?? true,
      },
      create: {
        name: dto.name,
        language: dto.language ?? 'en',
        body: dto.body,
        variables: dto.variables ?? {},
        isActive: dto.isActive ?? true,
      },
    });
  }

  async trigger(triggerType: AutomationTriggerType, leadId: string) {
    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId },
      include: { assignee: { select: { id: true, name: true } } },
    });
    if (!lead) return;

    const flows = await this.prisma.automationFlow.findMany({
      where: { triggerType, isActive: true },
      orderBy: { createdAt: 'asc' },
    });

    for (const flow of flows) {
      const runStartAt = new Date();
      try {
        await this.runFlow(flow.id, lead.id, 0, runStartAt.toISOString());
        await this.logRun(flow.name, lead.id, AutomationRunStatus.SUCCESS);
      } catch (error) {
        await this.logRun(flow.name, lead.id, AutomationRunStatus.FAILED, {
          error: (error as Error).message,
        });
      }
    }
  }

  async resumeFlow(flowId: string, leadId: string, fromStep: number, runStartedAtIso: string) {
    await this.runFlow(flowId, leadId, fromStep, runStartedAtIso);
  }

  private async runFlow(flowId: string, leadId: string, fromStep: number, runStartedAtIso: string) {
    const flow = await this.prisma.automationFlow.findUnique({ where: { id: flowId } });
    if (!flow || !flow.isActive) return;
    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId },
      include: { assignee: { select: { id: true } } },
    });
    if (!lead) return;

    const steps = (flow.steps as unknown as FlowStep[]) ?? [];
    const runStartAt = new Date(runStartedAtIso);
    for (let i = fromStep; i < steps.length; i++) {
      const continueRun = await this.executeStep(
        flow.id,
        lead.id,
        lead.assignedTo,
        steps[i],
        runStartAt,
        i,
      );
      if (!continueRun) {
        return;
      }
    }
  }

  @Cron('0 * * * *')
  async runNoResponseAutomation() {
    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const leads = await this.prisma.lead.findMany({
      where: {
        status: { in: [LeadStatus.NEW, LeadStatus.CONTACTED, LeadStatus.QUALIFIED, LeadStatus.TRIAL, LeadStatus.FOLLOW_UP] },
        OR: [{ lastContactedAt: null }, { lastContactedAt: { lt: cutoff } }],
        isDeleted: false,
      },
      select: { id: true },
      take: 200,
    });

    for (const lead of leads) {
      await this.prisma.lead.update({
        where: { id: lead.id },
        data: { status: LeadStatus.COLD },
      });
      await this.trigger(AutomationTriggerType.NO_RESPONSE, lead.id);
    }
  }

  @Cron('*/15 * * * *')
  async runFollowupAutomation() {
    const now = new Date();
    const in30 = new Date(now.getTime() + 30 * 60 * 1000);
    const leads = await this.prisma.lead.findMany({
      where: {
        nextFollowupAt: { gte: now, lt: in30 },
        status: { in: [LeadStatus.NEW, LeadStatus.CONTACTED, LeadStatus.QUALIFIED, LeadStatus.TRIAL, LeadStatus.FOLLOW_UP] },
        isDeleted: false,
      },
      select: { id: true },
      take: 200,
    });
    for (const lead of leads) {
      await this.trigger(AutomationTriggerType.FOLLOWUP, lead.id);
    }
  }

  private async executeStep(
    flowId: string,
    leadId: string,
    assignedTo: string,
    step: FlowStep,
    runStartAt: Date,
    stepIndex: number,
  ): Promise<boolean> {
    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId },
      include: { assignee: { select: { name: true } } },
    });
    if (!lead) return false;

    if (step.type === 'send_template') {
      const templateName = String(step.config?.templateName ?? 'default_intro');
      const template = await this.prisma.whatsappTemplate.findUnique({ where: { name: templateName } });
      if (!template || !template.isActive) return true;

      const rendered = this.renderTemplate(template.body, {
        name: lead.name,
        phone: lead.phone,
        assigneeName: lead.assignee?.name ?? '',
        status: lead.status,
      });

      await this.integrations.sendOutboundWhatsapp({
        leadId,
        body: rendered,
        messageType: MessageType.TEMPLATE,
      });
      return true;
    }

    if (step.type === 'update_status') {
      const status = String(step.config?.status ?? '');
      if (!status) return true;
      await this.prisma.lead.update({
        where: { id: leadId },
        data: { status: status as LeadStatus },
      });
      return true;
    }

    if (step.type === 'notify_agent') {
      const message = String(step.config?.message ?? 'Lead follow-up is due');
      await this.notifications.notifyUser({
        userId: assignedTo,
        type: NotificationType.MISSED_FOLLOWUP,
        message,
        channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
      });
      return true;
    }

    if (step.type === 'wait_hours') {
      const hours = Math.max(0, Number(step.config?.hours ?? 0));
      const delayMs = Math.floor(hours * 60 * 60 * 1000);
      await this.automationQueue.add(
        'resume-flow',
        {
          flowId,
          leadId,
          fromStep: stepIndex + 1,
          runStartedAt: runStartAt.toISOString(),
        },
        {
          delay: delayMs,
          attempts: 3,
          removeOnComplete: true,
          backoff: { type: 'exponential', delay: 5000 },
        },
      );
      return false;
    }

    if (step.type === 'check_reply') {
      const replied = await this.prisma.whatsappMessage.findFirst({
        where: {
          leadId,
          direction: 'inbound',
          timestamp: { gte: runStartAt },
        },
        select: { id: true },
      });
      const stopOnReply = Boolean(step.config?.stopOnReply ?? true);
      if (replied && stopOnReply) {
        await this.logRun('check_reply', leadId, AutomationRunStatus.SKIPPED, {
          reason: 'reply_detected',
        });
        return false;
      }
      return true;
    }

    if (step.type === 'assign_tag') {
      const tag = String(step.config?.tag ?? '').trim();
      if (!tag) return true;
      const tags = new Set(lead.automationTags);
      tags.add(tag);
      await this.prisma.lead.update({
        where: { id: leadId },
        data: { automationTags: Array.from(tags) },
      });
      return true;
    }

    return true;
  }

  private renderTemplate(body: string, values: Record<string, string>) {
    return body.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key: string) => {
      return values[key] ?? '';
    });
  }

  private async logRun(
    type: string,
    entityId: string,
    status: AutomationRunStatus,
    metadata?: Record<string, unknown>,
  ) {
    await this.prisma.automationLog.create({
      data: {
        type,
        entityId,
        status,
        metadata: (metadata ?? {}) as Prisma.InputJsonValue,
        leadId: entityId,
      },
    });
  }

  private async ensureDefaultFlows() {
    const count = await this.prisma.automationFlow.count();
    if (count > 0) return;

    await this.prisma.automationFlow.createMany({
      data: [
        {
          name: 'New Lead Instant Response',
          triggerType: AutomationTriggerType.NEW_LEAD,
          steps: [
            { type: 'send_template', config: { templateName: 'new_lead_intro' } },
            { type: 'notify_agent', config: { message: 'A new lead has been assigned to you' } },
          ],
        },
        {
          name: 'No Response Flow',
          triggerType: AutomationTriggerType.NO_RESPONSE,
          steps: [
            { type: 'wait_hours', config: { hours: 48 } },
            { type: 'check_reply', config: { stopOnReply: true } },
            { type: 'send_template', config: { templateName: 'no_response_48h' } },
            { type: 'assign_tag', config: { tag: 'no_response' } },
            { type: 'update_status', config: { status: 'COLD' } },
          ],
        },
        {
          name: 'Follow-up Reminder',
          triggerType: AutomationTriggerType.FOLLOWUP,
          steps: [
            { type: 'notify_agent', config: { message: 'Follow-up reminder for your lead' } },
          ],
        },
      ],
    });

    await this.prisma.whatsappTemplate.createMany({
      data: [
        {
          name: 'new_lead_intro',
          language: 'en',
          body: 'Hi {{name}}, thanks for your interest in RHN. Our specialist will assist you shortly.',
          variables: ['name'],
          isActive: true,
        },
        {
          name: 'no_response_48h',
          language: 'en',
          body: 'Hi {{name}}, we are here to help. Reply anytime for guidance or pricing details.',
          variables: ['name'],
          isActive: true,
        },
      ],
      skipDuplicates: true,
    });

    await this.prisma.activity.create({
      data: {
        type: ActivityType.NOTE,
        referenceId: 'system',
        userId: (await this.prisma.user.findFirst({ select: { id: true } }))?.id ?? '',
        metadata: { action: 'AUTOMATION_DEFAULTS_BOOTSTRAPPED' },
      },
    }).catch(() => undefined);
    this.log.log('Default automation flows initialized');
  }
}

