import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ActivityType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { AuthUser } from '../users/user.types';
import { CreateActivityNoteDto } from './dto/create-activity-note.dto';

@Injectable()
export class ActivitiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
  ) {}

  private async assertReferenceAccess(user: AuthUser, referenceId: string) {
    const accessible = await this.usersService.getAccessibleUserIds(user);
    const lead = await this.prisma.lead.findUnique({ where: { id: referenceId } });
    if (lead) {
      if (!accessible.includes(lead.assignedTo)) {
        throw new ForbiddenException('No access to this lead');
      }
      return;
    }
    const ticket = await this.prisma.ticket.findUnique({ where: { id: referenceId } });
    if (ticket) {
      if (!accessible.includes(ticket.assignedTo)) {
        throw new ForbiddenException('No access to this ticket');
      }
      return;
    }
    throw new NotFoundException('Lead or ticket not found for this reference');
  }

  async listByReference(user: AuthUser, referenceId: string) {
    await this.assertReferenceAccess(user, referenceId);
    return this.prisma.activity.findMany({
      where: { referenceId },
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async addNote(user: AuthUser, referenceId: string, dto: CreateActivityNoteDto) {
    await this.assertReferenceAccess(user, referenceId);
    return this.prisma.activity.create({
      data: {
        type: ActivityType.NOTE,
        referenceId,
        userId: user.id,
        metadata: { body: dto.body },
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });
  }
}
