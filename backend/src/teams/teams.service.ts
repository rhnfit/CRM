import { Department } from '@prisma/client';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { AuthUser } from '../users/user.types';

@Injectable()
export class TeamsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
  ) {}

  async listForCrm(user: AuthUser, department?: Department) {
    const scope = this.usersService.getCrmDepartments(user);
    const where = scope ? { department: { in: scope } } : {};
    const filteredWhere =
      department
        ? ({
            ...where,
            department,
          })
        : where;

    return this.prisma.team.findMany({
      where: filteredWhere,
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { members: true } },
        manager: { select: { id: true, name: true, email: true } },
      },
    });
  }
}
