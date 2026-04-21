import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { ActivityType, LeadStatus, Prisma } from '@prisma/client';
import { calculateLeadScore } from '../leads/lead-score.util';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { AuthUser } from '../users/user.types';
import { CreateSaleDto } from './dto/create-sale.dto';

@Injectable()
export class SalesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
  ) {}

  private saleScopeWhere(accessibleIds: string[]): Prisma.SaleWhereInput {
    return {
      OR: [{ userId: { in: accessibleIds } }, { lead: { assignedTo: { in: accessibleIds } } }],
    };
  }

  async findAll(user: AuthUser) {
    const accessibleIds = await this.usersService.getAccessibleUserIds(user);
    return this.prisma.sale.findMany({
      where: this.saleScopeWhere(accessibleIds),
      orderBy: { createdAt: 'desc' },
      include: {
        lead: { select: { id: true, name: true, phone: true, status: true } },
        user: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async create(user: AuthUser, dto: CreateSaleDto) {
    if (
      dto.closedLeadStatus != null &&
      dto.closedLeadStatus !== LeadStatus.WON &&
      dto.closedLeadStatus !== LeadStatus.CONVERTED
    ) {
      throw new BadRequestException('closedLeadStatus must be WON or CONVERTED');
    }
    const accessibleIds = await this.usersService.getAccessibleUserIds(user);
    const lead = await this.prisma.lead.findUnique({ where: { id: dto.leadId } });
    if (!lead || !accessibleIds.includes(lead.assignedTo)) {
      throw new ForbiddenException('Cannot create sale for this lead');
    }

    const sale = await this.prisma.sale.create({
      data: {
        leadId: dto.leadId,
        userId: user.id,
        amount: new Prisma.Decimal(dto.amount),
        product: dto.product,
        paymentStatus: dto.paymentStatus,
        orderSource: dto.orderSource,
        cac: dto.cac !== undefined ? new Prisma.Decimal(dto.cac) : null,
        paymentProofUrl: dto.paymentProofUrl ?? null,
        trnId: dto.trnId?.trim() ? dto.trnId.trim() : null,
      },
      include: {
        lead: { select: { id: true, name: true, phone: true } },
        user: { select: { id: true, name: true } },
      },
    });

    await this.prisma.activity.create({
      data: {
        type: ActivityType.PAYMENT,
        referenceId: lead.id,
        leadId: lead.id,
        userId: user.id,
        metadata: { action: 'SALE_CREATED', saleId: sale.id, amount: dto.amount },
      },
    });

    const isPaid = ['PAID', 'SUCCESS', 'COMPLETED'].includes(String(dto.paymentStatus).toUpperCase());
    if (isPaid) {
      const closed =
        dto.closedLeadStatus === LeadStatus.CONVERTED ? LeadStatus.CONVERTED : LeadStatus.WON;
      const updatedLead = await this.prisma.lead.update({
        where: { id: lead.id },
        data: {
          status: closed,
          convertedAt: new Date(),
          lastActivityType: ActivityType.PAYMENT,
          engagementCount: { increment: 1 },
        },
      });
      await this.prisma.lead.update({
        where: { id: lead.id },
        data: {
          leadScore: calculateLeadScore({
            source: updatedLead.source,
            engagementCount: updatedLead.engagementCount,
            createdAt: updatedLead.createdAt,
            firstResponseAt: updatedLead.contactedAt,
          }),
        },
      });
    }

    return sale;
  }
}
