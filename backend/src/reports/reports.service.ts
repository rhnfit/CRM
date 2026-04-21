import { Injectable } from '@nestjs/common';
import { Department, LeadStatus, Prisma, TicketStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { AuthUser } from '../users/user.types';
import {
  DashboardType,
  DateRangePreset,
  QueryDashboardDto,
} from './dto/query-dashboard.dto';

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
  ) {}

  private getDateWindow(query: QueryDashboardDto) {
    const preset = query.dateRange ?? DateRangePreset.LAST_30_DAYS;
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    if (preset === DateRangePreset.CUSTOM && query.from && query.to) {
      const from = new Date(query.from);
      const to = new Date(query.to);
      from.setHours(0, 0, 0, 0);
      to.setHours(23, 59, 59, 999);
      if (!Number.isNaN(from.getTime()) && !Number.isNaN(to.getTime()) && from <= to) {
        return { from, to, preset };
      }
    }

    if (preset === DateRangePreset.TODAY) return { from: todayStart, to: todayEnd, preset };
    if (preset === DateRangePreset.YESTERDAY) {
      const from = new Date(todayStart);
      from.setDate(from.getDate() - 1);
      const to = new Date(todayEnd);
      to.setDate(to.getDate() - 1);
      return { from, to, preset };
    }
    if (preset === DateRangePreset.THIS_WEEK) {
      const from = new Date(todayStart);
      const day = from.getDay();
      const delta = day === 0 ? 6 : day - 1;
      from.setDate(from.getDate() - delta);
      return { from, to: todayEnd, preset };
    }
    if (preset === DateRangePreset.THIS_MONTH) {
      const from = new Date(todayStart);
      from.setDate(1);
      return { from, to: todayEnd, preset };
    }

    const days =
      preset === DateRangePreset.LAST_7_DAYS
        ? 7
        : preset === DateRangePreset.LAST_60_DAYS
          ? 60
          : preset === DateRangePreset.LAST_90_DAYS
            ? 90
            : 30;
    const from = new Date(todayStart);
    from.setDate(from.getDate() - (days - 1));
    return { from, to: todayEnd, preset };
  }

  private async getFilteredUserIds(user: AuthUser, query: QueryDashboardDto) {
    const accessibleIds = await this.usersService.getAccessibleUserIds(user);
    const where: Prisma.UserWhereInput = {
      id: { in: accessibleIds },
      isActive: true,
    };
    const forcedDepartment =
      query.department ??
      (query.dashboardType === DashboardType.SALES
        ? Department.SALES
        : query.dashboardType === DashboardType.SUPPORT
          ? Department.SUPPORT
          : undefined);
    if (forcedDepartment) where.department = forcedDepartment;
    if (query.teamId && query.teamId !== 'ALL') where.teamId = query.teamId;

    const users = await this.prisma.user.findMany({
      where,
      select: { id: true, teamId: true, name: true },
    });
    return users;
  }

  private emptyOverview() {
    return {
      leadsByStatus: {} as Record<string, number>,
      ticketsByStatus: {} as Record<string, number>,
      totalLeads: 0,
      convertedLeads: 0,
      conversionRate: 0,
      revenue: 0,
      openTickets: 0,
      slaBreaches: 0,
      totalTicketsInPeriod: 0,
      escalatedTickets: 0,
      closedTicketsInPeriod: 0,
    };
  }

  private async overviewForIds(ids: string[], from: Date, to: Date) {
    const leadWhere: Prisma.LeadWhereInput = {
      assignedTo: { in: ids },
      isDeleted: false,
      createdAt: { gte: from, lte: to },
    };
    const ticketWhere: Prisma.TicketWhereInput = {
      assignedTo: { in: ids },
      createdAt: { gte: from, lte: to },
    };

    const [leadGroups, ticketGroups, revenue, leadTotals, converted] = await Promise.all([
      this.prisma.lead.groupBy({
        by: ['status'],
        where: leadWhere,
        _count: { _all: true },
      }),
      this.prisma.ticket.groupBy({
        by: ['status'],
        where: ticketWhere,
        _count: { _all: true },
      }),
      this.prisma.sale.aggregate({
        where: {
          createdAt: { gte: from, lte: to },
          OR: [{ userId: { in: ids } }, { lead: { assignedTo: { in: ids } } }],
        },
        _sum: { amount: true },
      }),
      this.prisma.lead.count({ where: leadWhere }),
      this.prisma.lead.count({
        where: {
          ...leadWhere,
          status: { in: [LeadStatus.CONVERTED, LeadStatus.WON] },
        },
      }),
    ]);

    const revenueNum = revenue._sum.amount ? Number(revenue._sum.amount) : 0;
    const conversionRate = leadTotals > 0 ? converted / leadTotals : 0;

    const [openTickets, slaBreaches, escalatedTickets, closedTicketsInPeriod] = await Promise.all([
      this.prisma.ticket.count({
        where: {
          ...ticketWhere,
          status: { in: [TicketStatus.OPEN, TicketStatus.IN_PROGRESS, TicketStatus.ESCALATED] },
        },
      }),
      this.prisma.ticket.count({
        where: {
          ...ticketWhere,
          slaDeadline: { lt: new Date() },
          status: { not: TicketStatus.CLOSED },
        },
      }),
      this.prisma.ticket.count({
        where: { ...ticketWhere, status: TicketStatus.ESCALATED },
      }),
      this.prisma.ticket.count({
        where: { ...ticketWhere, status: TicketStatus.CLOSED },
      }),
    ]);

    const totalTicketsInPeriod = ticketGroups.reduce((sum, g) => sum + g._count._all, 0);

    return {
      leadsByStatus: Object.fromEntries(leadGroups.map((g) => [g.status, g._count._all])) as Record<string, number>,
      ticketsByStatus: Object.fromEntries(ticketGroups.map((g) => [g.status, g._count._all])) as Record<string, number>,
      totalLeads: leadTotals,
      convertedLeads: converted,
      conversionRate,
      revenue: revenueNum,
      openTickets,
      slaBreaches,
      totalTicketsInPeriod,
      escalatedTickets,
      closedTicketsInPeriod,
    };
  }

  async overview(user: AuthUser, query: QueryDashboardDto = {}) {
    const userRows = await this.getFilteredUserIds(user, query);
    const ids = userRows.map((u) => u.id);
    const { from, to } = this.getDateWindow(query);
    if (ids.length === 0) return this.emptyOverview();
    return this.overviewForIds(ids, from, to);
  }

  private async revenueTimelineForIds(ids: string[], from: Date, to: Date) {
    const sales = await this.prisma.sale.findMany({
      where: {
        OR: [{ userId: { in: ids } }, { lead: { assignedTo: { in: ids } } }],
        createdAt: { gte: from, lte: to },
      },
      select: { amount: true, createdAt: true },
    });

    const map: Record<string, number> = {};
    for (const s of sales) {
      const key = s.createdAt.toISOString().slice(0, 10);
      map[key] = (map[key] ?? 0) + Number(s.amount);
    }

    const points: { month: string; revenue: number }[] = [];
    const cursor = new Date(from);
    while (cursor <= to) {
      const key = cursor.toISOString().slice(0, 10);
      points.push({ month: key, revenue: map[key] ?? 0 });
      cursor.setDate(cursor.getDate() + 1);
    }
    return points;
  }

  async revenueTimeline(user: AuthUser, query: QueryDashboardDto = {}) {
    const userRows = await this.getFilteredUserIds(user, query);
    const ids = userRows.map((u) => u.id);
    const { from, to } = this.getDateWindow(query);
    if (ids.length === 0) return [];
    return this.revenueTimelineForIds(ids, from, to);
  }

  private async ticketsTimelineForIds(ids: string[], from: Date, to: Date) {
    const tickets = await this.prisma.ticket.findMany({
      where: { assignedTo: { in: ids }, createdAt: { gte: from, lte: to } },
      select: { createdAt: true },
    });

    const map: Record<string, number> = {};
    for (const t of tickets) {
      const key = t.createdAt.toISOString().slice(0, 10);
      map[key] = (map[key] ?? 0) + 1;
    }

    const days: { date: string; count: number }[] = [];
    const cursor = new Date(from);
    while (cursor <= to) {
      const key = cursor.toISOString().slice(0, 10);
      days.push({ date: key, count: map[key] ?? 0 });
      cursor.setDate(cursor.getDate() + 1);
    }
    return days;
  }

  async ticketsTimeline(user: AuthUser, query: QueryDashboardDto = {}) {
    const userRows = await this.getFilteredUserIds(user, query);
    const ids = userRows.map((u) => u.id);
    const { from, to } = this.getDateWindow(query);
    if (ids.length === 0) return [];
    return this.ticketsTimelineForIds(ids, from, to);
  }

  private async leadsTimelineForIds(ids: string[], from: Date, to: Date) {
    const leads = await this.prisma.lead.findMany({
      where: { assignedTo: { in: ids }, createdAt: { gte: from, lte: to }, isDeleted: false },
      select: { createdAt: true, status: true },
    });

    const map: Record<string, number> = {};
    for (const l of leads) {
      const key = l.createdAt.toISOString().slice(0, 10);
      map[key] = (map[key] ?? 0) + 1;
    }

    const days: { date: string; count: number }[] = [];
    const cursor = new Date(from);
    while (cursor <= to) {
      const key = cursor.toISOString().slice(0, 10);
      days.push({ date: key, count: map[key] ?? 0 });
      cursor.setDate(cursor.getDate() + 1);
    }
    return days;
  }

  private async agentStatsForIds(ids: string[], from: Date, to: Date) {
    const agents = await this.prisma.user.findMany({
      where: { id: { in: ids }, isActive: true },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        teamId: true,
        department: true,
        team: { select: { name: true } },
      },
    });

    const [leadCounts, convCounts, saleGroups, ticketCounts] = await Promise.all([
      this.prisma.lead.groupBy({
        by: ['assignedTo'],
        where: { assignedTo: { in: ids }, isDeleted: false, createdAt: { gte: from, lte: to } },
        _count: { _all: true },
      }),
      this.prisma.lead.groupBy({
        by: ['assignedTo'],
        where: {
          assignedTo: { in: ids },
          status: { in: [LeadStatus.CONVERTED, LeadStatus.WON] },
          isDeleted: false,
          createdAt: { gte: from, lte: to },
        },
        _count: { _all: true },
      }),
      this.prisma.sale.groupBy({
        by: ['userId'],
        where: { userId: { in: ids }, createdAt: { gte: from, lte: to } },
        _sum: { amount: true },
      }),
      this.prisma.ticket.groupBy({
        by: ['assignedTo'],
        where: {
          assignedTo: { in: ids },
          status: { not: TicketStatus.CLOSED },
          createdAt: { gte: from, lte: to },
        },
        _count: { _all: true },
      }),
    ]);

    const lcMap = Object.fromEntries(leadCounts.map((r) => [r.assignedTo, r._count._all]));
    const cvMap = Object.fromEntries(convCounts.map((r) => [r.assignedTo, r._count._all]));
    const rvMap = Object.fromEntries(saleGroups.map((r) => [r.userId, Number(r._sum.amount ?? 0)]));
    const tkMap = Object.fromEntries(ticketCounts.map((r) => [r.assignedTo, r._count._all]));

    return agents.map((a) => ({
      id: a.id,
      name: a.name,
      email: a.email,
      role: a.role,
      teamId: a.teamId,
      teamName: a.team?.name ?? null,
      department: a.department,
      leads: lcMap[a.id] ?? 0,
      converted: cvMap[a.id] ?? 0,
      revenue: rvMap[a.id] ?? 0,
      openTickets: tkMap[a.id] ?? 0,
      convRate: lcMap[a.id] ? Math.round(((cvMap[a.id] ?? 0) / lcMap[a.id]) * 100) : 0,
    }));
  }

  async dashboard(user: AuthUser, query: QueryDashboardDto = {}) {
    const { from, to, preset } = this.getDateWindow(query);
    const userRows = await this.getFilteredUserIds(user, query);
    const ids = userRows.map((u) => u.id);

    const [overview, revenueTimeline, leadsTimeline, ticketsTimeline, agentStats] = await Promise.all([
      ids.length === 0 ? Promise.resolve(this.emptyOverview()) : this.overviewForIds(ids, from, to),
      ids.length === 0 ? Promise.resolve([]) : this.revenueTimelineForIds(ids, from, to),
      ids.length === 0 ? Promise.resolve([]) : this.leadsTimelineForIds(ids, from, to),
      ids.length === 0 ? Promise.resolve([]) : this.ticketsTimelineForIds(ids, from, to),
      ids.length === 0 ? Promise.resolve([]) : this.agentStatsForIds(ids, from, to),
    ]);
    const teams = new Map<
      string,
      {
        teamId: string | null;
        teamName: string;
        members: number;
        leads: number;
        converted: number;
        revenue: number;
        openTickets: number;
      }
    >();
    for (const a of agentStats) {
      const key = a.teamId ?? 'NO_TEAM';
      const row = teams.get(key) ?? {
        teamId: a.teamId,
        teamName: a.teamName ?? 'Unassigned',
        members: 0,
        leads: 0,
        converted: 0,
        revenue: 0,
        openTickets: 0,
      };
      row.members += 1;
      row.leads += a.leads;
      row.converted += a.converted;
      row.revenue += a.revenue;
      row.openTickets += a.openTickets;
      teams.set(key, row);
    }

    return {
      dashboardType: query.dashboardType ?? DashboardType.SALES,
      filters: {
        dateRange: preset,
        from: from.toISOString().slice(0, 10),
        to: to.toISOString().slice(0, 10),
        department:
          query.department ??
          (query.dashboardType === DashboardType.SUPPORT
            ? Department.SUPPORT
            : query.dashboardType === DashboardType.SALES
              ? Department.SALES
              : null),
        teamId: query.teamId ?? 'ALL',
      },
      overview,
      revenueTimeline,
      leadsTimeline,
      ticketsTimeline,
      agentStats,
      teamStats: [...teams.values()].sort((a, b) => b.revenue - a.revenue),
      scopedUsers: userRows.length,
    };
  }

  async agentStats(user: AuthUser, query: QueryDashboardDto = {}) {
    const userRows = await this.getFilteredUserIds(user, query);
    const ids = userRows.map((u) => u.id);
    const { from, to } = this.getDateWindow(query);
    if (ids.length === 0) return [];
    return this.agentStatsForIds(ids, from, to);
  }

  async leadsTimeline(user: AuthUser, query: QueryDashboardDto = {}) {
    const userRows = await this.getFilteredUserIds(user, query);
    const ids = userRows.map((u) => u.id);
    const { from, to } = this.getDateWindow(query);
    if (ids.length === 0) return [];
    return this.leadsTimelineForIds(ids, from, to);
  }
}
