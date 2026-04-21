import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../users/user.types';
import { UpsertTargetDto } from './dto/upsert-target.dto';
import { TargetsService } from './targets.service';

@UseGuards(JwtAuthGuard)
@Controller('targets')
export class TargetsController {
  constructor(private readonly targetsService: TargetsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.targetsService.list(user);
  }

  @Post()
  upsert(@CurrentUser() user: AuthUser, @Body() dto: UpsertTargetDto) {
    return this.targetsService.upsert(user, dto);
  }
}
