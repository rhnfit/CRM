import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../users/user.types';
import { QueryDashboardDto } from './dto/query-dashboard.dto';
import { ReportsService } from './reports.service';

@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('overview')
  overview(@CurrentUser() user: AuthUser, @Query() query: QueryDashboardDto) {
    return this.reportsService.overview(user, query);
  }

  @Get('revenue-timeline')
  revenueTimeline(@CurrentUser() user: AuthUser, @Query() query: QueryDashboardDto) {
    return this.reportsService.revenueTimeline(user, query);
  }

  @Get('leads-timeline')
  leadsTimeline(@CurrentUser() user: AuthUser, @Query() query: QueryDashboardDto) {
    return this.reportsService.leadsTimeline(user, query);
  }

  @Get('dashboard')
  dashboard(@CurrentUser() user: AuthUser, @Query() query: QueryDashboardDto) {
    return this.reportsService.dashboard(user, query);
  }

  @Get('agent-stats')
  agentStats(@CurrentUser() user: AuthUser, @Query() query: QueryDashboardDto) {
    return this.reportsService.agentStats(user, query);
  }
}
