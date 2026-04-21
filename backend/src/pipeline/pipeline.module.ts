import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { LeadMoveController, PipelineController } from './pipeline.controller';
import { PipelineService } from './pipeline.service';

@Module({
  imports: [UsersModule],
  controllers: [PipelineController, LeadMoveController],
  providers: [PipelineService],
  exports: [PipelineService],
})
export class PipelineModule {}
