import { Body, Controller, Get, Post, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../users/user.types';
import { CreateSaleDto } from './dto/create-sale.dto';
import { SalesService } from './sales.service';

@UseGuards(JwtAuthGuard)
@Controller('sales')
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Get()
  findAll(@CurrentUser() user: AuthUser) {
    return this.salesService.findAll(user);
  }

  @Get('export/csv')
  async exportCsv(@CurrentUser() user: AuthUser, @Res() res: Response) {
    const rows = await this.salesService.findAll(user);
    const header = 'id,leadName,leadPhone,product,amount,paymentStatus,orderSource,agentName,createdAt';
    const lines = rows.map((s) =>
      [
        s.id,
        `"${s.lead.name.replace(/"/g, '""')}"`,
        s.lead.phone,
        `"${s.product.replace(/"/g, '""')}"`,
        s.amount,
        s.paymentStatus,
        s.orderSource,
        `"${s.user.name.replace(/"/g, '""')}"`,
        s.createdAt.toISOString(),
      ].join(','),
    );
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=sales.csv');
    res.send([header, ...lines].join('\n'));
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateSaleDto) {
    return this.salesService.create(user, dto);
  }
}
