import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AssignmentModule } from '../assignment/assignment.module';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { CallsController } from './calls.controller';
import { IntegrationsService } from './integrations.service';
import { WhatsappController } from './whatsapp.controller';

@Module({
  imports: [ConfigModule, AuthModule, UsersModule, AssignmentModule],
  controllers: [WhatsappController, CallsController],
  providers: [IntegrationsService],
  exports: [IntegrationsService],
})
export class IntegrationsModule {}
