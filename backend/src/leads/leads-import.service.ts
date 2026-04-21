import { Injectable, Logger } from '@nestjs/common';
import { LeadSource, LeadStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { AuthUser } from '../users/user.types';

function normalise(v: string): string {
  return v.trim().replace(/^["']|["']$/g, '');
}

function parseSource(v: string): LeadSource {
  const map: Record<string, LeadSource> = {
    website: LeadSource.WEBSITE,
    whatsapp: LeadSource.WHATSAPP,
    offline: LeadSource.OFFLINE,
    call: LeadSource.CALL,
  };
  return map[v.toLowerCase()] ?? LeadSource.OFFLINE;
}

function parseStatus(v: string): LeadStatus {
  const map: Record<string, LeadStatus> = {
    new: LeadStatus.NEW,
    contacted: LeadStatus.CONTACTED,
    follow_up: LeadStatus.FOLLOW_UP,
    converted: LeadStatus.CONVERTED,
    lost: LeadStatus.LOST,
  };
  return map[v.toLowerCase()] ?? LeadStatus.NEW;
}

@Injectable()
export class LeadsImportService {
  private readonly log = new Logger(LeadsImportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
  ) {}

  async importCsv(user: AuthUser, csv: string) {
    const accessibleIds = await this.usersService.getAccessibleUserIds(user);
    const lines = csv.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) return { imported: 0, skipped: 0, errors: ['Empty CSV'] };

    const rawHeaders = lines[0].split(',').map((h) => normalise(h).toLowerCase());
    const nameIdx = rawHeaders.indexOf('name');
    const phoneIdx = rawHeaders.indexOf('phone');
    const sourceIdx = rawHeaders.indexOf('source');
    const statusIdx = rawHeaders.indexOf('status');
    const campaignIdx = rawHeaders.indexOf('campaign');
    const productIdx = rawHeaders.indexOf('productinterest');
    const assignedToIdx = rawHeaders.indexOf('assignedto');

    if (nameIdx === -1 || phoneIdx === -1) {
      return { imported: 0, skipped: 0, errors: ['CSV must have "name" and "phone" columns'] };
    }

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map(normalise);
      const name = cols[nameIdx] ?? '';
      const phone = cols[phoneIdx] ?? '';
      if (!name || !phone) { skipped++; continue; }

      const rawAssignedTo = assignedToIdx >= 0 ? cols[assignedToIdx] : '';
      const assignedTo = rawAssignedTo && accessibleIds.includes(rawAssignedTo)
        ? rawAssignedTo
        : user.id;

      const source = sourceIdx >= 0 && cols[sourceIdx] ? parseSource(cols[sourceIdx]) : LeadSource.OFFLINE;
      const status = statusIdx >= 0 && cols[statusIdx] ? parseStatus(cols[statusIdx]) : LeadStatus.NEW;
      const campaign = campaignIdx >= 0 ? cols[campaignIdx] : undefined;
      const productInterest = productIdx >= 0 ? cols[productIdx] : undefined;

      try {
        await this.prisma.lead.upsert({
          where: { phone },
          create: { name, phone, source, status, assignedTo, campaign, productInterest },
          update: { name, source, status, assignedTo, campaign, productInterest },
        });
        imported++;
      } catch (e) {
        skipped++;
        errors.push(`Row ${i}: ${(e as Error).message}`);
        this.log.warn(`Import row ${i} failed: ${(e as Error).message}`);
      }
    }

    return { imported, skipped, errors: errors.slice(0, 20) };
  }
}
