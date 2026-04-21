import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../users/user.types';
import { CreateLeadDto } from './dto/create-lead.dto';
import { ImportLeadsDto } from './dto/import-leads.dto';
import { QueryLeadsDto } from './dto/query-leads.dto';
import { PostCallFollowupDto } from './dto/post-call-followup.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { LeadsImportService } from './leads-import.service';
import { LeadsService } from './leads.service';

@UseGuards(JwtAuthGuard)
@Controller('leads')
export class LeadsController {
  constructor(
    private readonly leadsService: LeadsService,
    private readonly importService: LeadsImportService,
  ) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateLeadDto) {
    return this.leadsService.create(user, dto);
  }

  @Get()
  findAll(@CurrentUser() user: AuthUser, @Query() query: QueryLeadsDto) {
    return this.leadsService.findAll(user, query);
  }

  @Get('export/csv')
  async exportCsv(
    @CurrentUser() user: AuthUser,
    @Query() query: QueryLeadsDto,
    @Res() res: Response,
  ) {
    const rows = await this.leadsService.exportCsv(user, query);
    const header = 'id,name,phone,source,campaign,productInterest,status,leadScore,assignedTo,nextFollowupAt,createdAt';
    const lines = rows.map((r) =>
      [
        r.id,
        `"${r.name.replace(/"/g, '""')}"`,
        r.phone,
        r.source,
        r.campaign ?? '',
        r.productInterest ?? '',
        r.status,
        r.leadScore,
        r.assignedTo,
        r.nextFollowupAt?.toISOString() ?? '',
        r.createdAt.toISOString(),
      ].join(','),
    );
    const csv = [header, ...lines].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=leads.csv');
    res.send(csv);
  }

  @Post('import/csv')
  importCsv(@CurrentUser() user: AuthUser, @Body() dto: ImportLeadsDto) {
    return this.importService.importCsv(user, dto.csv);
  }

  @Post('bulk-reassign')
  bulkReassign(
    @CurrentUser() user: AuthUser,
    @Body() body: { leadIds: string[]; assignedTo: string },
  ) {
    return this.leadsService.bulkReassign(user, body.leadIds, body.assignedTo);
  }

  @Post(':id/post-call')
  postCallFollowup(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: PostCallFollowupDto,
  ) {
    return this.leadsService.postCallFollowup(user, id, dto);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.leadsService.findOne(user, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateLeadDto,
  ) {
    return this.leadsService.update(user, id, dto);
  }

  @Delete(':id')
  softDelete(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.leadsService.softDelete(user, id);
  }

  @Get(':id/timeline')
  getTimeline(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.leadsService.getTimeline(user, id);
  }
}
