import { Global, Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CrmGateway } from './crm.gateway';

@Global()
@Module({
  imports: [AuthModule],
  providers: [CrmGateway],
  exports: [CrmGateway],
})
export class CrmModule {}
