import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Department, Prisma, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../users/user.types';
import { AdminCreateTeamDto } from './dto/admin-create-team.dto';
import { AdminCreateUserDto } from './dto/admin-create-user.dto';
import { AdminUpdateTeamDto } from './dto/admin-update-team.dto';
import { AdminUpdateUserDto } from './dto/admin-update-user.dto';

const userPublicSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  department: true,
  teamId: true,
  managerId: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  private departmentsInScope(actor: AuthUser): Department[] | null {
    if (actor.role === Role.DIRECTOR) {
      return null;
    }
    if (actor.role === Role.MANAGER) {
      return [actor.department];
    }
    if (actor.role === Role.SALES_HEAD) {
      return [Department.SALES];
    }
    if (actor.role === Role.SUPPORT_HEAD) {
      return [Department.SUPPORT];
    }
    return [];
  }

  private assertDepartmentAllowed(actor: AuthUser, department: Department) {
    const scope = this.departmentsInScope(actor);
    if (scope === null) {
      return;
    }
    if (!scope.includes(department)) {
      throw new ForbiddenException('Outside your administrative scope');
    }
  }

  private assertCanAssignDirector(actor: AuthUser, role: Role) {
    if (role === Role.DIRECTOR && actor.role !== Role.DIRECTOR) {
      throw new ForbiddenException('Only a Director can assign the Director role');
    }
  }

  private async writeAudit(
    actor: AuthUser,
    action: string,
    entity: string,
    entityId: string,
    meta?: Record<string, unknown>,
  ) {
    await this.prisma.auditLog.create({
      data: {
        userId: actor.id,
        action,
        entity,
        entityId,
        meta: (meta ?? {}) as Prisma.InputJsonValue,
      },
    });
  }

  async stats(actor: AuthUser) {
    const scope = this.departmentsInScope(actor);
    const userWhere = scope ? { department: { in: scope } } : {};
    const teamWhere = scope ? { department: { in: scope } } : {};

    const [users, teams, leads, tickets] = await Promise.all([
      this.prisma.user.count({ where: userWhere }),
      this.prisma.team.count({ where: teamWhere }),
      this.prisma.lead.count({
        where: scope
          ? { assignee: { department: { in: scope } } }
          : {},
      }),
      this.prisma.ticket.count({
        where: scope
          ? { assignee: { department: { in: scope } } }
          : {},
      }),
    ]);

    return { users, teams, leads, tickets };
  }

  async listUsers(actor: AuthUser) {
    const scope = this.departmentsInScope(actor);
    return this.prisma.user.findMany({
      where: scope ? { department: { in: scope } } : {},
      orderBy: { createdAt: 'desc' },
      select: userPublicSelect,
    });
  }

  async createUser(actor: AuthUser, dto: AdminCreateUserDto) {
    this.assertDepartmentAllowed(actor, dto.department);
    this.assertCanAssignDirector(actor, dto.role);

    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new BadRequestException('Email already in use');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        passwordHash,
        role: dto.role,
        department: dto.department,
        teamId: dto.teamId,
        managerId: dto.managerId,
        isActive: dto.isActive ?? true,
      },
      select: userPublicSelect,
    });

    await this.writeAudit(actor, 'USER_CREATE', 'User', user.id, { email: user.email });
    return user;
  }

  async updateUser(actor: AuthUser, id: string, dto: AdminUpdateUserDto) {
    const target = await this.prisma.user.findUnique({ where: { id } });
    if (!target) {
      throw new NotFoundException('User not found');
    }
    this.assertDepartmentAllowed(actor, target.department);

    if (dto.department) {
      this.assertDepartmentAllowed(actor, dto.department);
    }
    if (dto.role) {
      this.assertCanAssignDirector(actor, dto.role);
    }

    const { password, ...rest } = dto;
    const data: Prisma.UserUpdateInput = { ...rest };
    if (password) {
      data.passwordHash = await bcrypt.hash(password, 10);
    }

    const user = await this.prisma.user.update({
      where: { id },
      data,
      select: userPublicSelect,
    });

    await this.writeAudit(actor, 'USER_UPDATE', 'User', user.id, { fields: Object.keys(dto) });
    return user;
  }

  async listTeams(actor: AuthUser) {
    const scope = this.departmentsInScope(actor);
    return this.prisma.team.findMany({
      where: scope ? { department: { in: scope } } : {},
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { members: true } },
        manager: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async createTeam(actor: AuthUser, dto: AdminCreateTeamDto) {
    this.assertDepartmentAllowed(actor, dto.department);

    const team = await this.prisma.team.create({
      data: {
        name: dto.name,
        department: dto.department,
        managerId: dto.managerId,
      },
      include: {
        _count: { select: { members: true } },
        manager: { select: { id: true, name: true, email: true } },
      },
    });

    await this.writeAudit(actor, 'TEAM_CREATE', 'Team', team.id, { name: team.name });
    return team;
  }

  async listAudit(actor: AuthUser) {
    const scope = this.departmentsInScope(actor);
    const where: Prisma.AuditLogWhereInput = scope
      ? { user: { department: { in: scope } } }
      : {};
    return this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { user: { select: { id: true, name: true, email: true } } },
    });
  }

  async updateTeam(actor: AuthUser, id: string, dto: AdminUpdateTeamDto) {
    const team = await this.prisma.team.findUnique({ where: { id } });
    if (!team) {
      throw new NotFoundException('Team not found');
    }
    this.assertDepartmentAllowed(actor, team.department);
    if (dto.department) {
      this.assertDepartmentAllowed(actor, dto.department);
    }

    const updated = await this.prisma.team.update({
      where: { id },
      data: dto,
      include: {
        _count: { select: { members: true } },
        manager: { select: { id: true, name: true, email: true } },
      },
    });

    await this.writeAudit(actor, 'TEAM_UPDATE', 'Team', updated.id, { fields: Object.keys(dto) });
    return updated;
  }
}
