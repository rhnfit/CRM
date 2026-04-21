import { Global, Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { StorageController } from './storage.controller';
import { StorageService } from './storage.service';

@Global()
@Module({
  imports: [AuthModule],
  controllers: [StorageController],
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}
