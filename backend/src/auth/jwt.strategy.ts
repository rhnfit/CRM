import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthUser } from '../users/user.types';

function extractTokenFromCookie(req: { headers?: { cookie?: string } }): string | null {
  const cookie = req?.headers?.cookie;
  if (!cookie) return null;
  const tokenPair = cookie
    .split(';')
    .map((item) => item.trim())
    .find((item) => item.startsWith('crm_at='));
  if (!tokenPair) return null;
  return decodeURIComponent(tokenPair.slice('crm_at='.length));
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        extractTokenFromCookie,
      ]),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  validate(payload: AuthUser): AuthUser {
    return payload;
  }
}
