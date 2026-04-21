import { ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { AuthUser } from '../users/user.types';
import { UpsertTargetDto } from './dto/upsert-target.dto';

@Injectable()
export class TargetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
  ) {}

  async list(user: AuthUser) {
    const ids = await this.usersService.getAccessibleUserIds(user);
    const targets = await this.prisma.target.findMany({
      where: { userId: { in: ids } },
      orderBy: [{ month: 'desc' }, { userId: 'asc' }],
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    const months = Array.from(new Set(targets.map((t) => t.month)));
    const achievements: Record<string, Record<string, number>> = {};
    for (const m of months) {
      const [y, mo] = m.split('-').map(Number);
      const start = new Date(y, mo - 1, 1);
      const end = new Date(y, mo, 1);
      const rows = await this.prisma.sale.groupBy({
        by: ['userId'],
        where: {
          userId: { in: ids },
          createdAt: { gte: start, lt: end },
        },
        _sum: { amount: true },
      });
      achievements[m] = {};
      for (const r of rows) {
        achievements[m][r.userId] = r._sum.amount ? Number(r._sum.amount) : 0;
      }
    }

    return targets.map((t) => ({
      ...t,
      targetAmount: Number(t.targetAmount),
      achievedAmount: achievements[t.month]?.[t.userId] ?? Number(t.achievedAmount),
    }));
  }

  async upsert(user: AuthUser, dto: UpsertTargetDto) {
    const ids = await this.usersService.getAccessibleUserIds(user);
    if (!ids.includes(dto.userId)) {
      throw new ForbiddenException('Cannot set target for this user');
    }
    return this.prisma.target.upsert({
      where: { userId_month: { userId: dto.userId, month: dto.month } },
      create: {
        userId: dto.userId,
        month: dto.month,
        targetAmount: new Prisma.Decimal(dto.targetAmount),
      },
      update: { targetAmount: new Prisma.Decimal(dto.targetAmount) },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
  }
}
