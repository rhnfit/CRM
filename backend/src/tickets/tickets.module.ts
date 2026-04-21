import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';

@Module({
  imports: [UsersModule, AuthModule],
  providers: [TicketsService],
  controllers: [TicketsController],
})
export class TicketsModule {}
