import { Body, Controller, Get, Param, Patch, Post, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../users/user.types';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { QueryTicketsDto } from './dto/query-tickets.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { TicketsService } from './tickets.service';

@UseGuards(JwtAuthGuard)
@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateTicketDto) {
    return this.ticketsService.create(user, dto);
  }

  @Get()
  findAll(@CurrentUser() user: AuthUser, @Query() query: QueryTicketsDto) {
    return this.ticketsService.findAll(user, query);
  }

  @Get('export/csv')
  async exportCsv(
    @CurrentUser() user: AuthUser,
    @Query() query: QueryTicketsDto,
    @Res() res: Response,
  ) {
    const rows = await this.ticketsService.exportCsv(user, query);
    const header = 'id,customerName,phone,type,priority,status,assignedTo,slaDeadline,createdAt';
    const lines = rows.map((r) =>
      [
        r.id,
        `"${r.customerName.replace(/"/g, '""')}"`,
        r.phone,
        r.type,
        r.priority,
        r.status,
        r.assignedTo,
        r.slaDeadline?.toISOString() ?? '',
        r.createdAt.toISOString(),
      ].join(','),
    );
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=tickets.csv');
    res.send([header, ...lines].join('\n'));
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.ticketsService.findOne(user, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateTicketDto,
  ) {
    return this.ticketsService.update(user, id, dto);
  }
}
