import { Module } from '@nestjs/common';
import { AssignmentModule } from '../assignment/assignment.module';
import { AutomationModule } from '../automation/automation.module';
import { AuthModule } from '../auth/auth.module';
import { PipelineModule } from '../pipeline/pipeline.module';
import { SalesModule } from '../sales/sales.module';
import { UsersModule } from '../users/users.module';
import { LeadsImportService } from './leads-import.service';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';

@Module({
  imports: [UsersModule, AuthModule, AssignmentModule, AutomationModule, SalesModule, PipelineModule],
  providers: [LeadsService, LeadsImportService],
  controllers: [LeadsController],
})
export class LeadsModule {}
