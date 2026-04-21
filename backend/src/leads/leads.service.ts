import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ActivityType,
  AutomationTriggerType,
  LeadStatus,
  NotificationChannel,
  NotificationType,
  Prisma,
} from '@prisma/client';
import { AutomationService } from '../automation/automation.service';
import { CrmGateway } from '../crm/crm.gateway';
import { calculateLeadScore } from './lead-score.util';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { AuthUser } from '../users/user.types';
import { LeadRoundRobinService } from '../assignment/lead-round-robin.service';
import { PipelineService } from '../pipeline/pipeline.service';
import { SalesService } from '../sales/sales.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { PostCallFollowupDto } from './dto/post-call-followup.dto';
import { QueryLeadsDto } from './dto/query-leads.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';

const DEFAULT_LIMIT = 50;

@Injectable()
export class LeadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly roundRobin: LeadRoundRobinService,
    private readonly crm: CrmGateway,
    private readonly automation: AutomationService,
    private readonly notifications: NotificationsService,
    private readonly salesService: SalesService,
    private readonly pipelineService: PipelineService,
  ) {}

  async create(user: AuthUser, dto: CreateLeadDto) {
    const accessibleIds = await this.usersService.getAccessibleUserIds(user);

    let assignedTo = dto.assignedTo;
    if (!assignedTo && dto.autoAssignTeamId) {
      await this.usersService.assertTeamInScope(user, dto.autoAssignTeamId);
      assignedTo = (await this.roundRobin.pickAssigneeForTeam(dto.autoAssignTeamId)) ?? undefined;
      if (!assignedTo) throw new BadRequestException('No sales agent on this team for auto-assignment');
    }
    if (!assignedTo) throw new BadRequestException('Provide assignedTo or autoAssignTeamId');
    if (!accessibleIds.includes(assignedTo)) throw new ForbiddenException('Cannot assign lead outside your downline');

    const status = dto.status ?? LeadStatus.NEW;
    const stageRef = await this.pipelineService.resolveStageForNewLead(status);

    const lead = await this.prisma.lead.create({
      data: {
        name: dto.name,
        phone: dto.phone,
        source: dto.source,
        campaign: dto.campaign,
        productInterest: dto.productInterest,
        leadScore: dto.leadScore ?? 0,
        status,
        assignedTo,
        nextFollowupAt: dto.nextFollowupAt ? new Date(dto.nextFollowupAt) : null,
        ...(stageRef ? { pipelineId: stageRef.pipelineId, stageId: stageRef.stageId } : {}),
      },
    });
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

    await this.prisma.activity.create({
      data: {
        type: ActivityType.NOTE,
        referenceId: lead.id,
        leadId: lead.id,
        userId: user.id,
        metadata: { action: 'LEAD_CREATED', status: lead.status },
      },
    });

    await this.prisma.lead.update({
      where: { id: lead.id },
      data: { lastActivityType: ActivityType.NOTE },
    });

    await this.notifications.notifyUser({
      userId: lead.assignedTo,
      type: NotificationType.NEW_ASSIGNMENT,
      message: `New lead assigned: ${lead.name} (${lead.phone})`,
      channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
    });

    await this.automation.trigger(AutomationTriggerType.NEW_LEAD, lead.id);

    this.crm.broadcast('crm', { resource: 'lead', action: 'created', id: lead.id });
    return lead;
  }

  async findAll(user: AuthUser, query: QueryLeadsDto) {
    const accessibleIds = await this.usersService.getAccessibleUserIds(user);
    const page = query.page ?? 1;
    const limit = query.limit ?? DEFAULT_LIMIT;

    const where: Prisma.LeadWhereInput = {
      assignedTo: { in: accessibleIds },
      isDeleted: false,
    };
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { phone: { contains: query.search, mode: 'insensitive' } },
        { productInterest: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (query.status) where.status = query.status;
    if (query.source) where.source = query.source;
    if (query.assignedTo && accessibleIds.includes(query.assignedTo)) {
      where.assignedTo = query.assignedTo;
    }
    if (query.campaign) where.campaign = { contains: query.campaign, mode: 'insensitive' };

    const listSelect = {
      id: true,
      name: true,
      phone: true,
      source: true,
      campaign: true,
      productInterest: true,
      leadScore: true,
      status: true,
      assignedTo: true,
      contactedAt: true,
      lastContactedAt: true,
      nextFollowupAt: true,
      lastActivityType: true,
      createdAt: true,
      updatedAt: true,
      stageId: true,
      pipelineId: true,
      kanbanOrder: true,
      stage: { select: { id: true, name: true, sortOrder: true } },
    } satisfies Prisma.LeadSelect;

    const [total, data] = await Promise.all([
      this.prisma.lead.count({ where }),
      this.prisma.lead.findMany({
        where,
        select: listSelect,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async findOne(user: AuthUser, id: string) {
    const accessibleIds = await this.usersService.getAccessibleUserIds(user);
    const lead = await this.prisma.lead.findUnique({
      where: { id },
      include: { assignee: { select: { id: true, name: true, email: true } } },
    });
    if (!lead || lead.isDeleted || !accessibleIds.includes(lead.assignedTo)) {
      throw new NotFoundException('Lead not found');
    }
    return lead;
  }

  async update(user: AuthUser, id: string, dto: UpdateLeadDto) {
    const accessibleIds = await this.usersService.getAccessibleUserIds(user);
    const lead = await this.prisma.lead.findUnique({ where: { id } });
    if (!lead || lead.isDeleted || !accessibleIds.includes(lead.assignedTo)) {
      throw new ForbiddenException('Lead is not in your accessible scope');
    }
    if (dto.assignedTo && !accessibleIds.includes(dto.assignedTo)) {
      throw new ForbiddenException('Cannot reassign outside your downline');
    }

    if (dto.status === LeadStatus.WON || dto.status === LeadStatus.CONVERTED) {
      if (dto.saleAmount == null || !dto.paymentProofUrl?.trim()) {
        throw new BadRequestException(
          'Closing as won or converted requires sale amount and payment proof (upload or paste a link).',
        );
      }
      await this.salesService.create(user, {
        leadId: id,
        amount: dto.saleAmount,
        product: dto.saleProduct?.trim() || 'Sale',
        paymentStatus: 'PAID',
        orderSource: 'crm',
        paymentProofUrl: dto.paymentProofUrl.trim(),
        trnId: dto.trnId?.trim(),
        closedLeadStatus: dto.status,
      });
      this.crm.broadcast('crm', { resource: 'lead', action: 'updated', id });
      return this.findOne(user, id);
    }

    const data: Prisma.LeadUncheckedUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.phone !== undefined) data.phone = dto.phone;
    if (dto.source !== undefined) data.source = dto.source;
    if (dto.campaign !== undefined) data.campaign = dto.campaign;
    if (dto.productInterest !== undefined) data.productInterest = dto.productInterest;
    if (dto.leadScore !== undefined) data.leadScore = dto.leadScore;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.assignedTo !== undefined) data.assignedTo = dto.assignedTo;
    if (dto.nextFollowupAt !== undefined) {
      data.nextFollowupAt = dto.nextFollowupAt ? new Date(dto.nextFollowupAt) : null;
    }

    const updated = await this.prisma.lead.update({ where: { id }, data });
    const lifecycleUpdate: Prisma.LeadUpdateInput = {};
    if (updated.status === 'CONTACTED' && !updated.contactedAt) lifecycleUpdate.contactedAt = new Date();
    if (updated.status === 'QUALIFIED' && !updated.qualifiedAt) lifecycleUpdate.qualifiedAt = new Date();
    if (updated.status === 'TRIAL' && !updated.trialAt) lifecycleUpdate.trialAt = new Date();
    if ((updated.status === 'WON' || updated.status === 'CONVERTED') && !updated.convertedAt) lifecycleUpdate.convertedAt = new Date();
    if (Object.keys(lifecycleUpdate).length > 0) {
      await this.prisma.lead.update({ where: { id }, data: lifecycleUpdate });
    }
    await this.prisma.lead.update({
      where: { id },
      data: {
        leadScore: calculateLeadScore({
          source: updated.source,
          engagementCount: updated.engagementCount,
          createdAt: updated.createdAt,
          firstResponseAt: updated.contactedAt,
        }),
      },
    });

    await this.prisma.activity.create({
      data: {
        type: ActivityType.STATUS_CHANGE,
        referenceId: updated.id,
        leadId: updated.id,
        userId: user.id,
        metadata: { action: 'LEAD_UPDATED', status: updated.status },
      },
    });

    await this.prisma.lead.update({
      where: { id: updated.id },
      data: { lastActivityType: ActivityType.STATUS_CHANGE },
    });

    this.crm.broadcast('crm', { resource: 'lead', action: 'updated', id: updated.id });
    return updated;
  }

  async softDelete(user: AuthUser, id: string) {
    const accessibleIds = await this.usersService.getAccessibleUserIds(user);
    const lead = await this.prisma.lead.findUnique({ where: { id } });
    if (!lead || !accessibleIds.includes(lead.assignedTo)) {
      throw new ForbiddenException('Lead not in scope');
    }
    const deleted = await this.prisma.lead.update({
      where: { id },
      data: { isDeleted: true },
    });
    await this.prisma.activity.create({
      data: {
        type: ActivityType.STATUS_CHANGE,
        referenceId: id,
        leadId: id,
        userId: user.id,
        metadata: { action: 'LEAD_DELETED' },
      },
    });
    this.crm.broadcast('crm', { resource: 'lead', action: 'deleted', id });
    return deleted;
  }

  async bulkReassign(user: AuthUser, leadIds: string[], assignedTo: string) {
    const accessibleIds = await this.usersService.getAccessibleUserIds(user);
    if (!accessibleIds.includes(assignedTo)) {
      throw new ForbiddenException('Target user is outside your downline');
    }
    const leads = await this.prisma.lead.findMany({
      where: { id: { in: leadIds }, isDeleted: false },
      select: { id: true, assignedTo: true },
    });
    const allowed = leads.filter((l) => accessibleIds.includes(l.assignedTo));
    if (allowed.length === 0) throw new ForbiddenException('None of the leads are in scope');

    const allowedIds = allowed.map((l) => l.id);
    await this.prisma.lead.updateMany({ where: { id: { in: allowedIds } }, data: { assignedTo } });
    await this.prisma.activity.createMany({
      data: allowedIds.map((leadId) => ({
        type: ActivityType.STATUS_CHANGE,
        referenceId: leadId,
        leadId,
        userId: user.id,
        metadata: { action: 'BULK_REASSIGN', newAssignee: assignedTo },
      })),
    });
    this.crm.broadcast('crm', { resource: 'lead', action: 'bulk_reassign', ids: allowedIds });
    return { reassigned: allowedIds.length, skipped: leadIds.length - allowedIds.length };
  }

  /** CSV export — returns flat array for serialisation. */
  async exportCsv(user: AuthUser, query: QueryLeadsDto) {
    const result = await this.findAll(user, { ...query, limit: 5000, page: 1 });
    return result.data;
  }

  async postCallFollowup(user: AuthUser, leadId: string, dto: PostCallFollowupDto) {
    const accessibleIds = await this.usersService.getAccessibleUserIds(user);
    const lead = await this.prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead || lead.isDeleted || !accessibleIds.includes(lead.assignedTo)) {
      throw new ForbiddenException('Lead is not in your accessible scope');
    }

    const isConversion = dto.status === LeadStatus.WON || dto.status === LeadStatus.CONVERTED;
    if (isConversion && (dto.saleAmount == null || !dto.paymentProofUrl?.trim())) {
      throw new BadRequestException(
        'Won/converted outcomes require sale amount and payment proof (upload or paste a link).',
      );
    }

    try {
      await this.prisma.call.create({
        data: {
          callId: dto.callId,
          userId: user.id,
          leadId,
          callType: dto.callType,
          duration: dto.duration,
        },
      });
    } catch {
      throw new BadRequestException('Could not log call (duplicate call reference?)');
    }

    await this.prisma.activity.create({
      data: {
        type: ActivityType.CALL,
        referenceId: leadId,
        leadId,
        userId: user.id,
        metadata: {
          externalCallId: dto.callId,
          duration: dto.duration,
          outcome: dto.status,
          callType: dto.callType,
        },
      },
    });

    if (dto.note?.trim()) {
      await this.prisma.activity.create({
        data: {
          type: ActivityType.NOTE,
          referenceId: leadId,
          leadId,
          userId: user.id,
          metadata: { body: dto.note.trim(), context: 'post_call' },
        },
      });
    }

    if (isConversion) {
      await this.salesService.create(user, {
        leadId,
        amount: dto.saleAmount!,
        product: dto.saleProduct?.trim() || 'Sale',
        paymentStatus: 'PAID',
        orderSource: 'call',
        paymentProofUrl: dto.paymentProofUrl!.trim(),
        trnId: dto.trnId?.trim(),
        closedLeadStatus: dto.status,
      });
    } else {
      await this.prisma.lead.update({
        where: { id: leadId },
        data: {
          status: dto.status,
          lastContactedAt: new Date(),
          contactedAt: lead.contactedAt ?? new Date(),
          engagementCount: { increment: 1 },
          lastActivityType: ActivityType.CALL,
        },
      });
      const updated = await this.prisma.lead.findUnique({ where: { id: leadId } });
      if (updated) {
        const lifecycleUpdate: Prisma.LeadUpdateInput = {};
        if (updated.status === 'CONTACTED' && !updated.contactedAt) lifecycleUpdate.contactedAt = new Date();
        if (updated.status === 'QUALIFIED' && !updated.qualifiedAt) lifecycleUpdate.qualifiedAt = new Date();
        if (updated.status === 'TRIAL' && !updated.trialAt) lifecycleUpdate.trialAt = new Date();
        if ((updated.status === 'WON' || updated.status === 'CONVERTED') && !updated.convertedAt) {
          lifecycleUpdate.convertedAt = new Date();
        }
        if (Object.keys(lifecycleUpdate).length > 0) {
          await this.prisma.lead.update({ where: { id: leadId }, data: lifecycleUpdate });
        }
        await this.prisma.lead.update({
          where: { id: leadId },
          data: {
            leadScore: calculateLeadScore({
              source: updated.source,
              engagementCount: updated.engagementCount,
              createdAt: updated.createdAt,
              firstResponseAt: updated.contactedAt,
            }),
          },
        });
      }
      await this.prisma.activity.create({
        data: {
          type: ActivityType.STATUS_CHANGE,
          referenceId: leadId,
          leadId,
          userId: user.id,
          metadata: { action: 'POST_CALL_STATUS', status: dto.status },
        },
      });
    }

    this.crm.broadcast('crm', { resource: 'lead', action: 'updated', id: leadId });
    return this.findOne(user, leadId);
  }

  async getTimeline(user: AuthUser, leadId: string) {
    const accessibleIds = await this.usersService.getAccessibleUserIds(user);
    const lead = await this.prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead || lead.isDeleted || !accessibleIds.includes(lead.assignedTo)) {
      throw new ForbiddenException('Lead is not in your accessible scope');
    }

    const [activities, tickets, messages, calls, sales] = await Promise.all([
      this.prisma.activity.findMany({
        where: { referenceId: leadId },
        include: { user: { select: { name: true, email: true } } },
      }),
      this.prisma.ticket.findMany({
        where: { leadId },
        include: { assignee: { select: { name: true, email: true } } },
      }),
      this.prisma.whatsappMessage.findMany({
        where: { leadId },
      }),
      this.prisma.call.findMany({
        where: { leadId },
        include: { user: { select: { name: true, email: true } } },
      }),
      this.prisma.sale.findMany({
        where: { leadId },
        include: { user: { select: { name: true, email: true } } },
      }),
    ]);

    const timeline = [
      ...activities.map((a) => ({ category: 'activity', type: a.type, date: a.createdAt, data: a })),
      ...tickets.map((t) => ({ category: 'ticket', type: 'TICKET', date: t.createdAt, data: t })),
      ...messages.map((m) => ({ category: 'message', type: 'WHATSAPP_MESSAGE', date: m.createdAt, data: m })),
      ...calls.map((c) => ({ category: 'call', type: 'DIRECT_CALL', date: c.createdAt, data: c })),
      ...sales.map((s) => ({ category: 'sale', type: 'SALE_CLOSED', date: s.createdAt, data: s })),
    ];

    return timeline.sort((a, b) => b.date.getTime() - a.date.getTime());
  }
}
