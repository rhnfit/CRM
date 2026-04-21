import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../users/user.types';
import { ActivitiesService } from './activities.service';
import { CreateActivityNoteDto } from './dto/create-activity-note.dto';

@UseGuards(JwtAuthGuard)
@Controller('activities')
export class ActivitiesController {
  constructor(private readonly activitiesService: ActivitiesService) {}

  @Get('reference/:referenceId')
  listByReference(
    @CurrentUser() user: AuthUser,
    @Param('referenceId') referenceId: string,
  ) {
    return this.activitiesService.listByReference(user, referenceId);
  }

  @Post('reference/:referenceId/notes')
  addNote(
    @CurrentUser() user: AuthUser,
    @Param('referenceId') referenceId: string,
    @Body() dto: CreateActivityNoteDto,
  ) {
    return this.activitiesService.addNote(user, referenceId, dto);
  }
}
