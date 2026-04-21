import { Body, Controller, Post, Req, Res, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Post('register')
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const session = await this.authService.register(dto);
    this.setAuthCookies(res, session.accessToken, session.refreshToken);
    return { accessToken: session.accessToken, user: session.user };
  }

  @Post('login')
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const session = await this.authService.login(dto);
    this.setAuthCookies(res, session.accessToken, session.refreshToken);
    return { accessToken: session.accessToken, user: session.user };
  }

  @Post('refresh')
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = this.extractRefreshToken(req);
    const session = await this.authService.refresh(token);
    this.setAuthCookies(res, session.accessToken, session.refreshToken);
    return { ok: true, user: session.user };
  }

  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = this.tryExtractRefreshToken(req);
    await this.authService.logout(token);
    this.clearAuthCookies(res);
    return { ok: true };
  }

  private cookieSameSite(): 'lax' | 'strict' | 'none' {
    const raw = this.config.get<string>('COOKIE_SAME_SITE')?.toLowerCase().trim();
    if (raw === 'none' || raw === 'strict' || raw === 'lax') return raw;
    return 'lax';
  }

  private setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
    const secure = this.config.get<string>('NODE_ENV') === 'production';
    const sameSite = this.cookieSameSite();
    res.cookie('crm_at', accessToken, {
      httpOnly: true,
      secure,
      sameSite,
      maxAge: 15 * 60 * 1000,
      path: '/',
    });
    res.cookie('crm_rt', refreshToken, {
      httpOnly: true,
      secure,
      sameSite,
      maxAge: 30 * 24 * 60 * 60 * 1000,
      path: '/',
    });
  }

  private clearAuthCookies(res: Response) {
    const secure = this.config.get<string>('NODE_ENV') === 'production';
    const sameSite = this.cookieSameSite();
    res.clearCookie('crm_at', { path: '/', sameSite, secure, httpOnly: true });
    res.clearCookie('crm_rt', {
      path: '/',
      sameSite,
      secure,
      httpOnly: true,
    });
  }

  private extractRefreshToken(req: Request): string {
    const token = this.tryExtractRefreshToken(req);
    if (!token) {
      throw new UnauthorizedException('Missing refresh token');
    }
    return token;
  }

  private tryExtractRefreshToken(req: Request): string | undefined {
    const cookieHeader = req.headers.cookie ?? '';
    const cookies = cookieHeader.split(';').map((x) => x.trim());
    const fromCookie = cookies
      .find((item) => item.startsWith('crm_rt='))
      ?.split('=')
      .slice(1)
      .join('=');
    if (fromCookie) return decodeURIComponent(fromCookie);
    const bodyToken = (req.body as { refreshToken?: string } | undefined)?.refreshToken;
    return bodyToken;
  }
}
