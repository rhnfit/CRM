import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { randomBytes, createHash } from 'crypto';
import { Department, Role } from '@prisma/client';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { UsersService } from '../users/users.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../users/user.types';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        passwordHash,
        role: dto.role,
        department: dto.department,
        teamId: dto.teamId,
        managerId: dto.managerId,
      },
    });

    return this.createSession(user);
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.createSession(user);
  }

  async refresh(refreshToken: string) {
    const tokenHash = this.hashRefreshToken(refreshToken);
    const token = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    if (!token || token.revokedAt || token.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    await this.prisma.refreshToken.update({
      where: { id: token.id },
      data: { revokedAt: new Date() },
    });

    return this.createSession(token.user);
  }

  async logout(refreshToken?: string) {
    if (!refreshToken) {
      return { ok: true };
    }
    const tokenHash = this.hashRefreshToken(refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { ok: true };
  }

  private async createSession(user: {
    id: string;
    role: Role;
    department: Department;
    teamId: string | null;
    managerId: string | null;
  }) {
    const payload: AuthUser = {
      id: user.id,
      role: user.role,
      department: user.department,
      teamId: user.teamId,
      managerId: user.managerId,
    };
    const accessToken = this.jwtService.sign(payload, {
      expiresIn: this.config.get<string>('ACCESS_TOKEN_EXPIRES_IN', '15m'),
    });
    const refreshToken = randomBytes(48).toString('hex');
    const tokenHash = this.hashRefreshToken(refreshToken);
    const expiresInDays = Number(this.config.get<string>('REFRESH_TOKEN_EXPIRES_DAYS', '30'));
    const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    return {
      accessToken,
      refreshToken,
      user: payload,
    };
  }

  private hashRefreshToken(raw: string): string {
    const secret = this.config.get<string>('REFRESH_TOKEN_SECRET') ?? this.config.get<string>('JWT_SECRET');
    return createHash('sha256').update(`${secret}:${raw}`).digest('hex');
  }
}
