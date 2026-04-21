import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthUser } from '../users/user.types';
import { AdminService } from './admin.service';
import { AdminCreateTeamDto } from './dto/admin-create-team.dto';
import { AdminCreateUserDto } from './dto/admin-create-user.dto';
import { AdminUpdateTeamDto } from './dto/admin-update-team.dto';
import { AdminUpdateUserDto } from './dto/admin-update-user.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.DIRECTOR, Role.MANAGER, Role.SALES_HEAD, Role.SUPPORT_HEAD)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('stats')
  stats(@CurrentUser() user: AuthUser) {
    return this.adminService.stats(user);
  }

  @Get('users')
  listUsers(@CurrentUser() user: AuthUser) {
    return this.adminService.listUsers(user);
  }

  @Post('users')
  createUser(@CurrentUser() user: AuthUser, @Body() dto: AdminCreateUserDto) {
    return this.adminService.createUser(user, dto);
  }

  @Patch('users/:id')
  updateUser(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: AdminUpdateUserDto,
  ) {
    return this.adminService.updateUser(user, id, dto);
  }

  @Get('audit')
  listAudit(@CurrentUser() user: AuthUser) {
    return this.adminService.listAudit(user);
  }

  @Get('teams')
  listTeams(@CurrentUser() user: AuthUser) {
    return this.adminService.listTeams(user);
  }

  @Post('teams')
  createTeam(@CurrentUser() user: AuthUser, @Body() dto: AdminCreateTeamDto) {
    return this.adminService.createTeam(user, dto);
  }

  @Patch('teams/:id')
  updateTeam(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: AdminUpdateTeamDto,
  ) {
    return this.adminService.updateTeam(user, id, dto);
  }
}
