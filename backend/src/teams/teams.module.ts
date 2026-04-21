import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { TeamsController } from './teams.controller';
import { TeamsService } from './teams.service';

@Module({
  imports: [UsersModule, AuthModule],
  controllers: [TeamsController],
  providers: [TeamsService],
})
export class TeamsModule {}
