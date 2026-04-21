import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  ActivityType,
  NotificationChannel,
  NotificationType,
  TicketStatus,
} from '@prisma/client';
import { Queue } from 'bullmq';
import { CrmGateway } from '../crm/crm.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  NOTIFICATIONS_QUEUE,
  SLA_QUEUE,
  STALE_LEADS_QUEUE,
} from '../queue/queue.module';

@Injectable()
export class WorkersService {
  private readonly log = new Logger(WorkersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crm: CrmGateway,
    private readonly notifications: NotificationsService,
    @InjectQueue(SLA_QUEUE) private readonly slaQueue: Queue,
    @InjectQueue(STALE_LEADS_QUEUE) private readonly staleQueue: Queue,
    @InjectQueue(NOTIFICATIONS_QUEUE) private readonly notifQueue: Queue,
  ) {}

  private async safeQueueAdd(queue: Queue, name: string, data: unknown, opts?: Record<string, unknown>) {
    try {
      await queue.add(name, data, opts);
    } catch {
      this.log.warn(`Queue add skipped (${queue.name}:${name})`);
    }
  }

  /** Scheduled every minute — enqueues SLA breach jobs. */
  @Cron(CronExpression.EVERY_MINUTE)
  async slaScan() {
    const now = new Date();
    const breached = await this.prisma.ticket.findMany({
      where: {
        status: { not: TicketStatus.CLOSED },
        slaDeadline: { lt: now, not: null },
      },
      select: {
        id: true,
        assignedTo: true,
        slaDeadline: true,
        customerName: true,
        assignee: { select: { email: true, name: true } },
      },
      take: 50,
    });
    if (breached.length === 0) return;

    for (const t of breached) {
      const already = await this.prisma.activity.findFirst({
        where: {
          referenceId: t.id,
          type: ActivityType.STATUS_CHANGE,
          metadata: { path: ['action'], equals: 'SLA_BREACH' },
        },
        select: { id: true },
      });
      if (already) continue;

      await this.prisma.activity.create({
        data: {
          type: ActivityType.STATUS_CHANGE,
          referenceId: t.id,
          ticketId: t.id,
          userId: t.assignedTo,
          metadata: { action: 'SLA_BREACH', slaDeadline: t.slaDeadline?.toISOString() },
        },
      });

      this.crm.broadcast('crm', { resource: 'ticket', action: 'sla_breach', id: t.id });

      await this.safeQueueAdd(
        this.slaQueue,
        'sla-breach',
        { ticketId: t.id, customerName: t.customerName, assigneeEmail: t.assignee.email },
        { attempts: 3, backoff: { type: 'exponential', delay: 5000 }, removeOnComplete: true },
      );

      await this.notifications.sendAlert({
        subject: `SLA breach — ticket for ${t.customerName}`,
        text: `Ticket ${t.id} (${t.customerName}) has breached its SLA deadline of ${t.slaDeadline?.toISOString()}.`,
        html: `<p><strong>SLA BREACH</strong></p><p>Ticket <code>${t.id}</code> for <strong>${t.customerName}</strong> breached SLA at <em>${t.slaDeadline?.toISOString()}</em>.</p>`,
      });
      await this.notifications.notifyUser({
        userId: t.assignedTo,
        type: NotificationType.SLA_BREACH,
        message: `Ticket ${t.id} breached SLA`,
        channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
      });
    }
    this.log.log(`SLA scan flagged ${breached.length} ticket(s)`);
  }

  /** Scheduled every 15 minutes — nudges stale leads. */
  @Cron('*/15 * * * *')
  async staleLeadNudge() {
    const hours = Number(process.env.STALE_LEAD_HOURS ?? '24');
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);

    const stale = await this.prisma.lead.findMany({
      where: {
        status: { in: ['NEW', 'CONTACTED', 'FOLLOW_UP'] },
        updatedAt: { lt: cutoff },
      },
      select: {
        id: true,
        assignedTo: true,
        name: true,
        assignee: { select: { email: true, name: true } },
      },
      take: 50,
    });
    if (stale.length === 0) return;

    for (const lead of stale) {
      const already = await this.prisma.activity.findFirst({
        where: {
          referenceId: lead.id,
          type: ActivityType.NOTE,
          metadata: { path: ['action'], equals: 'STALE_NUDGE' },
          createdAt: { gt: cutoff },
        },
        select: { id: true },
      });
      if (already) continue;

      await this.prisma.activity.create({
        data: {
          type: ActivityType.NOTE,
          referenceId: lead.id,
          leadId: lead.id,
          userId: lead.assignedTo,
          metadata: { action: 'STALE_NUDGE', hours },
        },
      });

      this.crm.broadcast('crm', { resource: 'lead', action: 'stale_nudge', id: lead.id });

      await this.safeQueueAdd(
        this.staleQueue,
        'stale-lead',
        { leadId: lead.id, leadName: lead.name, assigneeEmail: lead.assignee.email },
        { attempts: 3, backoff: { type: 'exponential', delay: 5000 }, removeOnComplete: true },
      );

      await this.notifications.sendAlert({
        subject: `Stale lead — ${lead.name}`,
        text: `Lead "${lead.name}" (${lead.id}) has had no activity for ${hours}h. Assigned to ${lead.assignee.name}.`,
      });
      await this.notifications.notifyUser({
        userId: lead.assignedTo,
        type: NotificationType.MISSED_FOLLOWUP,
        message: `Lead "${lead.name}" needs follow-up`,
        channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
      });
    }
    this.log.log(`Nudged ${stale.length} stale lead(s)`);
  }

  /** Daily follow-up reminders at 9 AM. */
  @Cron('0 9 * * 1-6')
  async followUpReminders() {
    const now = new Date();
    const windowEnd = new Date(now.getTime() + 3 * 60 * 60 * 1000);

    const leads = await this.prisma.lead.findMany({
      where: {
        nextFollowupAt: { gte: now, lt: windowEnd },
        status: { notIn: ['CONVERTED', 'LOST'] },
      },
      select: {
        id: true,
        name: true,
        phone: true,
        nextFollowupAt: true,
        assignee: { select: { email: true, name: true } },
      },
      take: 100,
    });
    if (leads.length === 0) return;

    await this.notifications.sendAlert({
      subject: `${leads.length} follow-up(s) due in next 3 hours`,
      text: leads
        .map((l) => `• ${l.name} (${l.phone}) — due ${l.nextFollowupAt?.toISOString()}`)
        .join('\n'),
      html: `<ul>${leads.map((l) => `<li><strong>${l.name}</strong> (${l.phone}) — ${l.nextFollowupAt?.toLocaleString()}</li>`).join('')}</ul>`,
    });

    for (const l of leads) {
      await this.safeQueueAdd(
        this.notifQueue,
        'follow-up-reminder',
        { leadId: l.id, leadName: l.name, assigneeEmail: l.assignee.email },
        { attempts: 2, removeOnComplete: true },
      );
    }
    this.log.log(`Follow-up reminders queued: ${leads.length}`);
  }
}
