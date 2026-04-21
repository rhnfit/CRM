import { Injectable } from '@nestjs/common';
import { Department, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SafeRedisService } from '../redis/safe-redis.service';

@Injectable()
export class LeadRoundRobinService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: SafeRedisService,
  ) {}

  /** Picks next sales agent on the team for lead assignment. */
  async pickAssigneeForTeam(teamId: string): Promise<string | null> {
    const agents = await this.prisma.user.findMany({
      where: {
        teamId,
        role: Role.AGENT,
        department: Department.SALES,
        isActive: true,
      },
      orderBy: { id: 'asc' },
      select: { id: true },
    });
    if (agents.length === 0) {
      return null;
    }
    const n = agents.length;
    const tick = await this.redis.incr(
      `crm:rr:lead:${teamId}`,
      async () =>
        this.prisma.$transaction(async (tx) => {
          const counter = await tx.roundRobinCounter.upsert({
            where: { teamId },
            create: { teamId, lastAssignedIndex: -1 },
            update: {},
          });
          const next = (counter.lastAssignedIndex + 1) % n;
          await tx.roundRobinCounter.update({
            where: { teamId },
            data: { lastAssignedIndex: next },
          });
          return next + 1;
        }),
    );
    const idx = (Number(tick) - 1) % n;
    return agents[idx]?.id ?? null;
  }
}
