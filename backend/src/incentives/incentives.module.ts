import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { IncentivesController } from './incentives.controller';
import { IncentivesService } from './incentives.service';

@Module({
  imports: [UsersModule, AuthModule],
  controllers: [IncentivesController],
  providers: [IncentivesService],
})
export class IncentivesModule {}
