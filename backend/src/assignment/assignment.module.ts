import { Module } from '@nestjs/common';
import { LeadRoundRobinService } from './lead-round-robin.service';

@Module({
  providers: [LeadRoundRobinService],
  exports: [LeadRoundRobinService],
})
export class AssignmentModule {}
