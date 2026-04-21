import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Department, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SafeRedisService } from '../redis/safe-redis.service';
import { AuthUser } from './user.types';

const SCOPE_TTL = 60; // seconds

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: SafeRedisService,
  ) {}

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  /** Invalidate cached scope when user roles or teams change. */
  async invalidateScopeCache(userId: string) {
    await this.redis.del(`scope:${userId}`);
  }

  async getAccessibleUserIds(user: AuthUser): Promise<string[]> {
    const cacheKey = `scope:${user.id}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as string[];
    }

    const ids = await this.computeAccessibleUserIds(user);
    await this.redis.set(cacheKey, JSON.stringify(ids), SCOPE_TTL);
    return ids;
  }

  private async computeAccessibleUserIds(user: AuthUser): Promise<string[]> {
    const baseSelect = { id: true };
    const activeOnly = { isActive: true };

    if (user.role === Role.DIRECTOR) {
      const users = await this.prisma.user.findMany({ where: activeOnly, select: baseSelect });
      return users.map((u) => u.id);
    }

    if (user.role === Role.MANAGER) {
      const users = await this.prisma.user.findMany({
        where: { department: user.department, ...activeOnly },
        select: baseSelect,
      });
      return users.map((u) => u.id);
    }

    if (user.role === Role.SALES_HEAD || user.role === Role.SUPPORT_HEAD) {
      const dept = user.role === Role.SALES_HEAD ? Department.SALES : Department.SUPPORT;
      const users = await this.prisma.user.findMany({
        where: { department: dept, ...activeOnly },
        select: baseSelect,
      });
      return users.map((u) => u.id);
    }

    if (user.role === Role.TEAM_LEADER) {
      const users = await this.prisma.user.findMany({
        where: {
          OR: [{ id: user.id }, { teamId: user.teamId ?? undefined }],
          ...activeOnly,
        },
        select: baseSelect,
      });
      return users.map((u) => u.id);
    }

    return [user.id];
  }

  getCrmDepartments(user: AuthUser): Department[] | null {
    if (user.role === Role.DIRECTOR) return null;
    if (user.role === Role.MANAGER) return [user.department];
    if (user.role === Role.SALES_HEAD) return [Department.SALES];
    if (user.role === Role.SUPPORT_HEAD) return [Department.SUPPORT];
    return [user.department];
  }

  async assertTeamInScope(user: AuthUser, teamId: string) {
    const team = await this.prisma.team.findUnique({ where: { id: teamId } });
    if (!team) throw new NotFoundException('Team not found');
    const scope = this.getCrmDepartments(user);
    if (scope && !scope.includes(team.department)) {
      throw new ForbiddenException('Team is outside your scope');
    }
    return team;
  }

  async updatePassword(userId: string, passwordHash: string) {
    return this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
  }

  async listAssignableUsers(user: AuthUser) {
    const ids = await this.getAccessibleUserIds(user);
    return this.prisma.user.findMany({
      where: { id: { in: ids }, isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, email: true, role: true, department: true, teamId: true },
    });
  }
}
