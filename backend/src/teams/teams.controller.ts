import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Department } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../users/user.types';
import { TeamsService } from './teams.service';

@UseGuards(JwtAuthGuard)
@Controller('teams')
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query('department') department?: Department) {
    return this.teamsService.listForCrm(user, department);
  }
}
