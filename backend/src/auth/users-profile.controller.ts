import { Body, Controller, Get, Post, UnauthorizedException, UseGuards } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../users/user.types';
import { UsersService } from '../users/users.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('users')
export class UsersProfileController {
  constructor(private readonly usersService: UsersService) {}

  @UseGuards(JwtAuthGuard)
  @Get('assignable')
  assignable(@CurrentUser() user: AuthUser) {
    return this.usersService.listAssignableUsers(user);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@CurrentUser() user: AuthUser) {
    const full = await this.usersService.findById(user.id);
    if (!full) return user;
    // Strip password hash from API response
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- destructuring omit
    const { passwordHash, ...safe } = full;
    return safe;
  }

  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  async changePassword(@CurrentUser() user: AuthUser, @Body() dto: ChangePasswordDto) {
    const full = await this.usersService.findById(user.id);
    if (!full) throw new UnauthorizedException();
    const valid = await bcrypt.compare(dto.oldPassword, full.passwordHash);
    if (!valid) throw new UnauthorizedException('Current password is incorrect');
    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.usersService.updatePassword(user.id, passwordHash);
    return { ok: true };
  }
}
