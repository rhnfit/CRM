import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../users/user.types';
import { MoveLeadDto } from './dto/move-lead.dto';
import { PipelineService } from './pipeline.service';

@UseGuards(JwtAuthGuard)
@Controller('pipelines')
export class PipelineController {
  constructor(private readonly pipelineService: PipelineService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.pipelineService.listPipelines(user);
  }

  @Get(':id/board')
  board(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.pipelineService.getBoard(user, id);
  }
}

@UseGuards(JwtAuthGuard)
@Controller('leads')
export class LeadMoveController {
  constructor(private readonly pipelineService: PipelineService) {}

  @Patch(':id/move')
  move(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: MoveLeadDto,
  ) {
    return this.pipelineService.moveLead(user, id, dto);
  }
}
