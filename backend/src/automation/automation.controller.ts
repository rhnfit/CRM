import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateFlowDto } from './dto/create-flow.dto';
import { CreateTemplateDto } from './dto/create-template.dto';
import { AutomationService } from './automation.service';

@Controller('automation')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.DIRECTOR, Role.MANAGER, Role.SALES_HEAD, Role.SUPPORT_HEAD)
export class AutomationController {
  constructor(private readonly automation: AutomationService) {}

  @Get('flows')
  listFlows() {
    return this.automation.listFlows();
  }

  @Post('flows')
  createFlow(@Body() dto: CreateFlowDto) {
    return this.automation.createFlow(dto);
  }

  @Get('templates')
  listTemplates() {
    return this.automation.listTemplates();
  }

  @Post('templates')
  createTemplate(@Body() dto: CreateTemplateDto) {
    return this.automation.createTemplate(dto);
  }
}

