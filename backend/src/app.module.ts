import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ActivitiesModule } from './activities/activities.module';
import { AdminModule } from './admin/admin.module';
import { AutomationModule } from './automation/automation.module';
import { AuthModule } from './auth/auth.module';
import { CrmModule } from './crm/crm.module';
import { HealthModule } from './health/health.module';
import { RolesGuard } from './common/guards/roles.guard';
import { IncentivesModule } from './incentives/incentives.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { LeadsModule } from './leads/leads.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PipelineModule } from './pipeline/pipeline.module';
import { PrismaModule } from './prisma/prisma.module';
import { QueueModule } from './queue/queue.module';
import { RedisModule } from './redis/redis.module';
import { ReportsModule } from './reports/reports.module';
import { SalesModule } from './sales/sales.module';
import { StorageModule } from './storage/storage.module';
import { TargetsModule } from './targets/targets.module';
import { TeamsModule } from './teams/teams.module';
import { TicketsModule } from './tickets/tickets.module';
import { UsersModule } from './users/users.module';
import { WorkersModule } from './workers/workers.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 300 }]),
    PrismaModule,
    RedisModule,
    QueueModule,
    NotificationsModule,
    StorageModule,
    CrmModule,
    HealthModule,
    UsersModule,
    AuthModule,
    AutomationModule,
    AdminModule,
    LeadsModule,
    PipelineModule,
    TicketsModule,
    ActivitiesModule,
    SalesModule,
    ReportsModule,
    IncentivesModule,
    TargetsModule,
    TeamsModule,
    IntegrationsModule,
    WorkersModule,
  ],
  providers: [
    RolesGuard,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
