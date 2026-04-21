import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { AuthUser } from '../users/user.types';

@Injectable()
export class IncentivesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly config: ConfigService,
  ) {}

  async list(user: AuthUser) {
    const ids = await this.usersService.getAccessibleUserIds(user);
    return this.prisma.incentive.findMany({
      where: { userId: { in: ids } },
      orderBy: [{ month: 'desc' }, { userId: 'asc' }],
      include: { user: { select: { id: true, name: true, email: true } } },
    });
  }

  async computeMonth(user: AuthUser, month: string) {
    const ids = await this.usersService.getAccessibleUserIds(user);
    const pct = Number(this.config.get<string>('INCENTIVE_PERCENT') ?? '0.05');

    const [y, m] = month.split('-').map(Number);
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 1);

    const grouped = await this.prisma.sale.groupBy({
      by: ['userId'],
      where: {
        userId: { in: ids },
        createdAt: { gte: start, lt: end },
      },
      _sum: { amount: true },
    });

    const results = [];
    for (const row of grouped) {
      const salesAmount = row._sum.amount ? new Prisma.Decimal(row._sum.amount) : new Prisma.Decimal(0);
      const incentiveAmount = salesAmount.mul(new Prisma.Decimal(pct));
      const r = await this.prisma.incentive.upsert({
        where: {
          userId_month: { userId: row.userId, month },
        },
        create: {
          userId: row.userId,
          month,
          salesAmount,
          incentiveAmount,
        },
        update: {
          salesAmount,
          incentiveAmount,
        },
        include: { user: { select: { id: true, name: true, email: true } } },
      });
      results.push(r);
    }

    return { month, percent: pct, count: results.length, incentives: results };
  }
}
