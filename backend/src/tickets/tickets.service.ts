import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ActivityType, Prisma } from '@prisma/client';
import { CrmGateway } from '../crm/crm.gateway';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { AuthUser } from '../users/user.types';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { QueryTicketsDto } from './dto/query-tickets.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';

const DEFAULT_LIMIT = 50;

@Injectable()
export class TicketsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly crm: CrmGateway,
  ) {}

  async create(user: AuthUser, dto: CreateTicketDto) {
    const accessibleIds = await this.usersService.getAccessibleUserIds(user);
    if (!accessibleIds.includes(dto.assignedTo)) {
      throw new ForbiddenException('Cannot assign ticket outside your downline');
    }

    const ticket = await this.prisma.ticket.create({
      data: {
        customerName: dto.customerName,
        phone: dto.phone,
        type: dto.type,
        priority: dto.priority ?? undefined,
        status: dto.status ?? undefined,
        assignedTo: dto.assignedTo,
        leadId: dto.leadId ?? null,
        slaDeadline: dto.slaDeadline ? new Date(dto.slaDeadline) : null,
        resolutionNotes: dto.resolutionNotes,
      },
    });

    await this.prisma.activity.create({
      data: {
        type: ActivityType.NOTE,
        referenceId: ticket.id,
        ticketId: ticket.id,
        userId: user.id,
        metadata: { action: 'TICKET_CREATED', status: ticket.status },
      },
    });

    this.crm.broadcast('crm', { resource: 'ticket', action: 'created', id: ticket.id });
    return ticket;
  }

  async findAll(user: AuthUser, query: QueryTicketsDto) {
    const accessibleIds = await this.usersService.getAccessibleUserIds(user);
    const page = query.page ?? 1;
    const limit = query.limit ?? DEFAULT_LIMIT;

    const where: Prisma.TicketWhereInput = { assignedTo: { in: accessibleIds } };
    if (query.search) {
      where.OR = [
        { customerName: { contains: query.search, mode: 'insensitive' } },
        { phone: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (query.status) where.status = query.status;
    if (query.type) where.type = query.type;
    if (query.priority) where.priority = query.priority;
    if (query.assignedTo && accessibleIds.includes(query.assignedTo)) {
      where.assignedTo = query.assignedTo;
    }

    const listSelect = {
      id: true,
      customerName: true,
      phone: true,
      type: true,
      priority: true,
      status: true,
      assignedTo: true,
      leadId: true,
      slaDeadline: true,
      createdAt: true,
      updatedAt: true,
      lead: { select: { id: true, name: true } },
    } satisfies Prisma.TicketSelect;

    const [total, data] = await Promise.all([
      this.prisma.ticket.count({ where }),
      this.prisma.ticket.findMany({
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
    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
      include: {
        assignee: { select: { id: true, name: true, email: true } },
        lead: { select: { id: true, name: true, phone: true } },
      },
    });
    if (!ticket || !accessibleIds.includes(ticket.assignedTo)) throw new NotFoundException('Ticket not found');
    return ticket;
  }

  async update(user: AuthUser, id: string, dto: UpdateTicketDto) {
    const accessibleIds = await this.usersService.getAccessibleUserIds(user);
    const ticket = await this.prisma.ticket.findUnique({ where: { id } });
    if (!ticket || !accessibleIds.includes(ticket.assignedTo)) throw new ForbiddenException('Ticket is not in your accessible scope');
    if (dto.assignedTo && !accessibleIds.includes(dto.assignedTo)) throw new ForbiddenException('Cannot reassign outside your downline');

    const data: Prisma.TicketUncheckedUpdateInput = {};
    if (dto.customerName !== undefined) data.customerName = dto.customerName;
    if (dto.phone !== undefined) data.phone = dto.phone;
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.priority !== undefined) data.priority = dto.priority;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.assignedTo !== undefined) data.assignedTo = dto.assignedTo;
    if (dto.leadId !== undefined) data.leadId = dto.leadId;
    if (dto.slaDeadline !== undefined) data.slaDeadline = dto.slaDeadline ? new Date(dto.slaDeadline) : null;
    if (dto.resolutionNotes !== undefined) data.resolutionNotes = dto.resolutionNotes;

    const updated = await this.prisma.ticket.update({ where: { id }, data });

    await this.prisma.activity.create({
      data: {
        type: ActivityType.STATUS_CHANGE,
        referenceId: updated.id,
        ticketId: updated.id,
        userId: user.id,
        metadata: { action: 'TICKET_UPDATED', status: updated.status },
      },
    });

    this.crm.broadcast('crm', { resource: 'ticket', action: 'updated', id: updated.id });
    return updated;
  }

  async exportCsv(user: AuthUser, query: QueryTicketsDto) {
    const result = await this.findAll(user, { ...query, limit: 5000, page: 1 });
    return result.data;
  }
}
