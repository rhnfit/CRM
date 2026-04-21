import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DbHealthService {
  constructor(private readonly prisma: PrismaService) {}

  async getStatus() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { healthy: true, status: 'UP' };
    } catch {
      return { healthy: false, status: 'DOWN' };
    }
  }
}
