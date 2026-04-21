import { InjectQueue } from '@nestjs/bullmq';
import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ActivityType,
  Department,
  LeadSource,
  LeadStatus,
  MessageStatus,
  MessageType,
  Role,
} from '@prisma/client';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { LeadRoundRobinService } from '../assignment/lead-round-robin.service';
import { calculateLeadScore } from '../leads/lead-score.util';
import { WHATSAPP_OUTBOUND_QUEUE } from '../queue/queue.module';
import { UsersService } from '../users/users.service';
import { AuthUser } from '../users/user.types';
import { IngestCallDto } from './dto/ingest-call.dto';

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  return digits.length ? digits : raw.trim();
}

@Injectable()
export class IntegrationsService {
  private readonly log = new Logger(IntegrationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly roundRobin: LeadRoundRobinService,
    private readonly usersService: UsersService,
    private readonly config: ConfigService,
    @InjectQueue(WHATSAPP_OUTBOUND_QUEUE) private readonly whatsappQueue: Queue,
  ) {}

  async ingestWhatsappPayload(body: Record<string, unknown>) {
    const status = this.extractWhatsappStatus(body);
    if (status?.id) {
      await this.applyWhatsappStatus(status.id, status.status);
      return { ok: true, statusUpdated: true };
    }

    const msg = this.extractWhatsappMessage(body);
    if (!msg) {
      this.log.debug('WhatsApp webhook: no message extracted');
      return { ok: true, ignored: true };
    }

    const phone = normalizePhone(msg.from);
    let lead = await this.prisma.lead.findUnique({ where: { phone } });

    if (!lead) {
      const assignedTo = await this.pickDefaultLeadOwner();
      if (!assignedTo) {
        this.log.warn('No user available to assign auto-created lead');
        return { ok: false, error: 'no_assignee' };
      }
      lead = await this.prisma.lead.create({
        data: {
          name: `WhatsApp ${phone}`,
          phone,
          source: LeadSource.WHATSAPP,
          status: LeadStatus.NEW,
          assignedTo,
        },
      });
    }

    await this.prisma.whatsappMessage.create({
      data: {
        externalId: msg.id,
        phone,
        body: msg.text,
        direction: msg.direction,
        content: msg.text,
        messageType: MessageType.TEXT,
        status: MessageStatus.RECEIVED,
        timestamp: new Date(),
        leadId: lead.id,
      },
    });

    await this.prisma.activity.create({
      data: {
        type: ActivityType.WHATSAPP,
        referenceId: lead.id,
        leadId: lead.id,
        userId: lead.assignedTo,
        metadata: { direction: msg.direction, preview: msg.text.slice(0, 200) },
      },
    });

    // Update lastContactedAt on the lead
    const updatedLead = await this.prisma.lead.update({
      where: { id: lead.id },
      data: {
        lastContactedAt: new Date(),
        contactedAt: lead.contactedAt ?? new Date(),
        engagementCount: { increment: 1 },
        lastActivityType: ActivityType.WHATSAPP,
      },
    });
    await this.prisma.lead.update({
      where: { id: lead.id },
      data: {
        leadScore: calculateLeadScore({
          source: updatedLead.source,
          engagementCount: updatedLead.engagementCount,
          createdAt: updatedLead.createdAt,
          firstResponseAt: updatedLead.contactedAt,
        }),
      },
    });

    return { ok: true, leadId: lead.id };
  }

  async sendOutboundWhatsapp(params: {
    leadId: string;
    body: string;
    messageType?: MessageType;
  }) {
    const lead = await this.prisma.lead.findUnique({ where: { id: params.leadId } });
    if (!lead) return { ok: false, reason: 'lead_not_found' };

    const message = await this.prisma.whatsappMessage.create({
      data: {
        phone: lead.phone,
        body: params.body,
        direction: 'outbound',
        content: params.body,
        messageType: params.messageType ?? MessageType.TEXT,
        status: MessageStatus.SENT,
        timestamp: new Date(),
        leadId: lead.id,
      },
    });
    await this.whatsappQueue.add(
      'send-outbound',
      { messageId: message.id },
      { attempts: 4, backoff: { type: 'exponential', delay: 5000 }, removeOnComplete: true },
    );

    await this.prisma.activity.create({
      data: {
        type: ActivityType.WHATSAPP,
        referenceId: lead.id,
        leadId: lead.id,
        userId: lead.assignedTo,
        metadata: { direction: 'outbound', preview: params.body.slice(0, 200) },
      },
    });

    const updatedLead = await this.prisma.lead.update({
      where: { id: lead.id },
      data: {
        lastContactedAt: new Date(),
        contactedAt: lead.contactedAt ?? new Date(),
        engagementCount: { increment: 1 },
        lastActivityType: ActivityType.WHATSAPP,
      },
    });
    await this.prisma.lead.update({
      where: { id: lead.id },
      data: {
        leadScore: calculateLeadScore({
          source: updatedLead.source,
          engagementCount: updatedLead.engagementCount,
          createdAt: updatedLead.createdAt,
          firstResponseAt: updatedLead.contactedAt,
        }),
      },
    });

    return { ok: true };
  }

  async dispatchOutboundWhatsapp(messageId: string) {
    const message = await this.prisma.whatsappMessage.findUnique({
      where: { id: messageId },
      include: { lead: true },
    });
    if (!message || message.direction !== 'outbound') return;

    const apiToken = this.config.get<string>('WHATSAPP_API_TOKEN');
    const phoneNumberId = this.config.get<string>('WHATSAPP_PHONE_NUMBER_ID');
    if (!apiToken || !phoneNumberId) {
      this.log.warn('WhatsApp API token/phone number not configured');
      return;
    }

    const url = `https://graph.facebook.com/v22.0/${phoneNumberId}/messages`;
    const payload = {
      messaging_product: 'whatsapp',
      to: message.phone,
      type: 'text',
      text: { body: message.body },
    };
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      await this.prisma.whatsappMessage.update({
        where: { id: message.id },
        data: {
          status: MessageStatus.FAILED,
        },
      });
      throw new Error(`WhatsApp send failed: ${JSON.stringify(body)}`);
    }

    const externalId = Array.isArray(body.messages)
      ? String((body.messages[0] as Record<string, unknown>)?.id ?? '')
      : '';

    await this.prisma.whatsappMessage.update({
      where: { id: message.id },
      data: {
        status: MessageStatus.DELIVERED,
        externalId: externalId || undefined,
      },
    });
  }

  async ingestCall(actor: AuthUser, dto: IngestCallDto) {
    const accessible = await this.usersService.getAccessibleUserIds(actor);
    if (!accessible.includes(dto.userId)) {
      throw new ForbiddenException('Cannot record call for this user');
    }

    if (dto.leadId) {
      const lead = await this.prisma.lead.findUnique({ where: { id: dto.leadId } });
      if (!lead || !accessible.includes(lead.assignedTo)) {
        throw new ForbiddenException('Cannot attach call to this lead');
      }
    }

    const call = await this.prisma.call.create({
      data: {
        callId: dto.callId,
        userId: dto.userId,
        leadId: dto.leadId,
        callType: dto.callType,
        duration: dto.duration,
        recordingUrl: dto.recordingUrl,
      },
    });

    if (dto.leadId) {
      await Promise.all([
        this.prisma.activity.create({
          data: {
            type: ActivityType.CALL,
            referenceId: dto.leadId,
            userId: dto.userId,
            metadata: {
              callId: call.id,
              externalCallId: dto.callId,
              duration: dto.duration,
              recordingUrl: dto.recordingUrl,
            },
          },
        }),
        this.prisma.lead.update({
          where: { id: dto.leadId },
          data: {
            lastContactedAt: new Date(),
            contactedAt: new Date(),
            engagementCount: { increment: 1 },
            lastActivityType: ActivityType.CALL,
          },
        }),
      ]);
      const lead = await this.prisma.lead.findUnique({ where: { id: dto.leadId } });
      if (lead) {
        await this.prisma.lead.update({
          where: { id: lead.id },
          data: {
            leadScore: calculateLeadScore({
              source: lead.source,
              engagementCount: lead.engagementCount,
              createdAt: lead.createdAt,
              firstResponseAt: lead.contactedAt,
            }),
          },
        });
      }
    }

    return call;
  }

  private extractWhatsappMessage(body: Record<string, unknown>) {
    try {
      const entry = (body.entry as Record<string, unknown>[])?.[0];
      const change = (entry?.changes as Record<string, unknown>[])?.[0];
      const value = change?.value as Record<string, unknown>;
      const messages = value?.messages as Record<string, unknown>[];
      const m = messages?.[0];
      if (!m) return null;
      const from = String(m.from ?? '');
      const id = m.id != null ? String(m.id) : undefined;
      const text = String((m.text as Record<string, unknown>)?.body ?? m.body ?? '');
      const direction = 'inbound';
      return { from, id, text, direction };
    } catch {
      return null;
    }
  }

  private extractWhatsappStatus(body: Record<string, unknown>) {
    try {
      const entry = (body.entry as Record<string, unknown>[])?.[0];
      const change = (entry?.changes as Record<string, unknown>[])?.[0];
      const value = change?.value as Record<string, unknown>;
      const statuses = value?.statuses as Record<string, unknown>[];
      const s = statuses?.[0];
      if (!s) return null;
      const id = String(s.id ?? '');
      const status = String(s.status ?? '').toUpperCase();
      return { id, status };
    } catch {
      return null;
    }
  }

  private async applyWhatsappStatus(externalId: string, statusRaw: string) {
    const mapped =
      statusRaw === 'READ'
        ? MessageStatus.READ
        : statusRaw === 'FAILED'
          ? MessageStatus.FAILED
          : statusRaw === 'DELIVERED'
            ? MessageStatus.DELIVERED
            : MessageStatus.SENT;
    await this.prisma.whatsappMessage.updateMany({
      where: { externalId },
      data: { status: mapped },
    });
  }

  private async pickDefaultLeadOwner(): Promise<string | null> {
    const team = await this.prisma.team.findFirst({
      where: { department: Department.SALES },
      orderBy: { createdAt: 'asc' },
    });
    if (team) {
      const rr = await this.roundRobin.pickAssigneeForTeam(team.id);
      if (rr) return rr;
    }
    const u = await this.prisma.user.findFirst({
      where: { department: Department.SALES, isActive: true, role: Role.AGENT },
      orderBy: { createdAt: 'asc' },
    });
    return u?.id ?? null;
  }
}
