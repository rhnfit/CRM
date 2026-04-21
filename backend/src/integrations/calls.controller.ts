import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../users/user.types';
import { CrmGateway } from '../crm/crm.gateway';
import { IngestCallDto } from './dto/ingest-call.dto';
import { IntegrationsService } from './integrations.service';

@UseGuards(JwtAuthGuard)
@Controller('integrations/calls')
export class CallsController {
  constructor(
    private readonly integrations: IntegrationsService,
    private readonly crm: CrmGateway,
  ) {}

  @Post('trigger')
  triggerCall(@CurrentUser() user: AuthUser, @Body() dto: { phone: string; leadId: string }) {
    this.crm.broadcast('dial_outbound', { userId: user.id, leadId: dto.leadId, phone: dto.phone });
    return { ok: true, message: 'Call triggered on connected mobile devices' };
  }

  @Post()
  ingest(@CurrentUser() user: AuthUser, @Body() dto: IngestCallDto) {
    return this.integrations.ingestCall(user, dto);
  }
}
