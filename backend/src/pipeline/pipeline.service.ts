import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ActivityType, LeadStatus, Prisma, Role } from '@prisma/client';
import { CrmGateway } from '../crm/crm.gateway';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { AuthUser } from '../users/user.types';
import { MoveLeadDto } from './dto/move-lead.dto';

const boardLeadSelect = {
  id: true,
  name: true,
  phone: true,
  source: true,
  status: true,
  leadScore: true,
  assignedTo: true,
  nextFollowupAt: true,
  kanbanOrder: true,
  stageId: true,
  pipelineId: true,
  updatedAt: true,
} satisfies Prisma.LeadSelect;

@Injectable()
export class PipelineService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly crm: CrmGateway,
  ) {}

  /** Pipelines visible to the user (default org pipeline + team pipelines in scope). */
  async listPipelines(user: AuthUser) {
    const me = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { teamId: true, department: true, role: true },
    });
    if (!me) throw new ForbiddenException();

    const where: Prisma.PipelineWhereInput =
      me.role === Role.SUPER_ADMIN
        ? {}
        : {
            OR: [
              { isDefault: true, teamId: null },
              ...(me.teamId ? [{ teamId: me.teamId }] : []),
            ],
          };

    const pipelines = await this.prisma.pipeline.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        stages: { orderBy: { sortOrder: 'asc' } },
        team: { select: { id: true, name: true } },
      },
    });

    return pipelines.map((p) => ({
      id: p.id,
      name: p.name,
      teamId: p.teamId,
      department: p.department,
      isDefault: p.isDefault,
      sortOrder: p.sortOrder,
      team: p.team,
      stages: p.stages.map((s) => ({
        id: s.id,
        name: s.name,
        sortOrder: s.sortOrder,
        mapsToStatus: s.mapsToStatus,
        color: s.color,
      })),
    }));
  }

  async getBoard(user: AuthUser, pipelineId: string) {
    await this.assertPipelineReadable(user, pipelineId);
    const accessibleIds = await this.usersService.getAccessibleUserIds(user);

    const pipeline = await this.prisma.pipeline.findUnique({
      where: { id: pipelineId },
      include: {
        stages: { orderBy: { sortOrder: 'asc' } },
        team: { select: { id: true, name: true } },
      },
    });
    if (!pipeline) throw new NotFoundException('Pipeline not found');

    const stagesOut = await Promise.all(
      pipeline.stages.map(async (stage) => {
        const leads = await this.prisma.lead.findMany({
          where: {
            stageId: stage.id,
            assignedTo: { in: accessibleIds },
            isDeleted: false,
          },
          select: boardLeadSelect,
          orderBy: [{ kanbanOrder: 'asc' }, { updatedAt: 'desc' }],
        });
        return {
          id: stage.id,
          name: stage.name,
          sortOrder: stage.sortOrder,
          mapsToStatus: stage.mapsToStatus,
          color: stage.color,
          leads,
        };
      }),
    );

    return {
      pipeline: {
        id: pipeline.id,
        name: pipeline.name,
        teamId: pipeline.teamId,
        department: pipeline.department,
        isDefault: pipeline.isDefault,
        team: pipeline.team,
      },
      stages: stagesOut,
    };
  }

  async moveLead(user: AuthUser, leadId: string, dto: MoveLeadDto) {
    const accessibleIds = await this.usersService.getAccessibleUserIds(user);
    const lead = await this.prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead || lead.isDeleted || !accessibleIds.includes(lead.assignedTo)) {
      throw new NotFoundException('Lead not found');
    }

    const stage = await this.prisma.pipelineStage.findUnique({
      where: { id: dto.stageId },
      include: { pipeline: true },
    });
    if (!stage) throw new NotFoundException('Stage not found');

    if (lead.pipelineId && stage.pipelineId !== lead.pipelineId) {
      throw new BadRequestException('Cannot move lead to a stage in another pipeline (v1)');
    }
    if (!lead.pipelineId) {
      await this.assertPipelineReadable(user, stage.pipelineId);
    } else {
      await this.assertPipelineReadable(user, stage.pipelineId);
    }

    const order =
      dto.kanbanOrder ??
      (await this.prisma.lead.count({
        where: {
          stageId: stage.id,
          assignedTo: { in: accessibleIds },
          isDeleted: false,
          id: { not: leadId },
        },
      }));

    const nextStatus = stage.mapsToStatus ?? lead.status;

    const updated = await this.prisma.lead.update({
      where: { id: leadId },
      data: {
        stageId: stage.id,
        pipelineId: stage.pipelineId,
        kanbanOrder: order,
        status: nextStatus,
      },
      select: boardLeadSelect,
    });

    await this.prisma.activity.create({
      data: {
        type: ActivityType.STATUS_CHANGE,
        referenceId: leadId,
        leadId,
        userId: user.id,
        metadata: {
          action: 'KANBAN_MOVE',
          stageId: stage.id,
          stageName: stage.name,
          previousStageId: lead.stageId,
          status: nextStatus,
        },
      },
    });

    this.crm.broadcast('crm', { resource: 'lead', action: 'updated', id: leadId });

    return updated;
  }

  /** Assigns pipeline + stage for a new lead from status (default pipeline). */
  async resolveStageForNewLead(status: LeadStatus) {
    const byMap = await this.prisma.pipelineStage.findFirst({
      where: {
        mapsToStatus: status,
        pipeline: { isDefault: true, teamId: null },
      },
      orderBy: { sortOrder: 'asc' },
    });
    if (byMap) {
      return { pipelineId: byMap.pipelineId, stageId: byMap.id };
    }
    const first = await this.prisma.pipelineStage.findFirst({
      where: { pipeline: { isDefault: true, teamId: null } },
      orderBy: { sortOrder: 'asc' },
    });
    if (!first) return null;
    return { pipelineId: first.pipelineId, stageId: first.id };
  }

  private async assertPipelineReadable(user: AuthUser, pipelineId: string) {
    const pipeline = await this.prisma.pipeline.findUnique({
      where: { id: pipelineId },
      select: { id: true, teamId: true, isDefault: true },
    });
    if (!pipeline) throw new NotFoundException('Pipeline not found');
    if (user.role === Role.SUPER_ADMIN) return;
    if (pipeline.isDefault && !pipeline.teamId) return;
    if (pipeline.teamId) {
      const me = await this.prisma.user.findUnique({
        where: { id: user.id },
        select: { teamId: true },
      });
      if (me?.teamId === pipeline.teamId) return;
      const accessible = await this.usersService.getAccessibleUserIds(user);
      const members = await this.prisma.user.findMany({
        where: { teamId: pipeline.teamId, id: { in: accessible } },
        select: { id: true },
        take: 1,
      });
      if (members.length) return;
    }
    throw new ForbiddenException('Pipeline not accessible');
  }
}
