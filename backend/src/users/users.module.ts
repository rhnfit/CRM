import { Module } from '@nestjs/common';
import { RedisModule } from '../redis/redis.module';
import { UsersService } from './users.service';

@Module({
  imports: [RedisModule],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
