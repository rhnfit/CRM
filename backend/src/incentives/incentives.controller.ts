import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../users/user.types';
import { ComputeIncentivesDto } from './dto/compute-incentives.dto';
import { IncentivesService } from './incentives.service';

@UseGuards(JwtAuthGuard)
@Controller('incentives')
export class IncentivesController {
  constructor(private readonly incentivesService: IncentivesService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.incentivesService.list(user);
  }

  @Post('compute')
  compute(@CurrentUser() user: AuthUser, @Body() dto: ComputeIncentivesDto) {
    return this.incentivesService.computeMonth(user, dto.month);
  }
}
