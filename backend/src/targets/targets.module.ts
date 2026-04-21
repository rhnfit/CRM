import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { TargetsController } from './targets.controller';
import { TargetsService } from './targets.service';

@Module({
  imports: [UsersModule, AuthModule],
  controllers: [TargetsController],
  providers: [TargetsService],
})
export class TargetsModule {}
