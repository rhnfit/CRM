import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Post,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import type { Request } from 'express';
import { IntegrationsService } from './integrations.service';

@SkipThrottle()
@Controller('integrations/whatsapp')
export class WhatsappController {
  constructor(
    private readonly integrations: IntegrationsService,
    private readonly config: ConfigService,
  ) {}

  /** Meta Cloud API webhook verification (no JWT). */
  @Get('webhook')
  verify(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
  ) {
    const expected = this.config.get<string>('WHATSAPP_VERIFY_TOKEN');
    if (mode === 'subscribe' && expected && token === expected) {
      return challenge;
    }
    throw new ForbiddenException('Invalid verify token');
  }

  /** Inbound messages. In production set WHATSAPP_APP_SECRET. */
  @Post('webhook')
  @HttpCode(200)
  async webhook(@Req() req: Request, @Body() body: Record<string, unknown>) {
    const appSecret = this.config.get<string>('WHATSAPP_APP_SECRET');
    if (appSecret) {
      const signature = String(req.headers['x-hub-signature-256'] ?? '');
      const raw = (req as unknown as { rawBody?: Buffer }).rawBody;
      if (!raw) {
        throw new BadRequestException('Missing raw body for signature verification');
      }
      const digest =
        'sha256=' + crypto.createHmac('sha256', appSecret).update(raw).digest('hex');
      if (
        signature.length !== digest.length ||
        !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest))
      ) {
        throw new UnauthorizedException('Invalid WhatsApp signature');
      }
    }

    return this.integrations.ingestWhatsappPayload(body);
  }
}
