import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  NotificationChannel,
  NotificationType,
} from '@prisma/client';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { CrmGateway } from '../crm/crm.gateway';
import { PrismaService } from '../prisma/prisma.service';

export interface AlertPayload {
  subject: string;
  text: string;
  html?: string;
}

export interface NotifyUserPayload {
  userId: string;
  type: NotificationType;
  message: string;
  channels: NotificationChannel[];
}

@Injectable()
export class NotificationsService {
  private readonly log = new Logger(NotificationsService.name);
  private readonly transporter: Transporter | null;
  private readonly from: string;
  private readonly to: string;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly crm: CrmGateway,
  ) {
    const host = config.get<string>('SMTP_HOST');
    this.from = config.get<string>('ALERT_FROM') ?? 'crm@rhn.local';
    this.to = config.get<string>('ALERT_TO') ?? '';

    if (!host || !this.to) {
      this.log.warn('SMTP not configured — email alerts disabled');
      this.transporter = null;
      return;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port: Number(config.get<string>('SMTP_PORT') ?? 587),
      secure: false,
      auth: {
        user: config.get<string>('SMTP_USER'),
        pass: config.get<string>('SMTP_PASS'),
      },
    });
  }

  async sendAlert(payload: AlertPayload): Promise<void> {
    if (!this.transporter) {
      this.log.debug(`[NO-SMTP] ${payload.subject}: ${payload.text}`);
      return;
    }
    try {
      await this.transporter.sendMail({
        from: this.from,
        to: this.to,
        subject: payload.subject,
        text: payload.text,
        html: payload.html ?? payload.text,
      });
      this.log.log(`Alert sent: ${payload.subject}`);
    } catch (err) {
      this.log.error(`Email send failed: ${(err as Error).message}`);
    }
  }

  async notifyUser(payload: NotifyUserPayload): Promise<void> {
    const writes = payload.channels.map((channel) =>
      this.prisma.notification.create({
        data: {
          userId: payload.userId,
          type: payload.type,
          message: payload.message,
          channel,
        },
      }),
    );
    await Promise.all(writes);

    if (payload.channels.includes(NotificationChannel.EMAIL)) {
      await this.sendAlert({
        subject: payload.type,
        text: payload.message,
      });
    }

    if (payload.channels.includes(NotificationChannel.IN_APP)) {
      this.crm.notifyUser(payload.userId, 'notification', {
        userId: payload.userId,
        type: payload.type,
        message: payload.message,
        createdAt: new Date().toISOString(),
      });
    }
  }

  async listForUser(userId: string, limit = 50) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 200),
    });
  }

  async markRead(userId: string, notificationId: string) {
    await this.prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { isRead: true },
    });
    return { ok: true };
  }
}
