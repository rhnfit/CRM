import { CallType, LeadStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class PostCallFollowupDto {
  @IsString()
  callId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  duration!: number;

  @IsEnum(CallType)
  callType!: CallType;

  @IsEnum(LeadStatus)
  status!: LeadStatus;

  @IsOptional()
  @IsString()
  note?: string;

  @ValidateIf((o: PostCallFollowupDto) => o.status === LeadStatus.WON || o.status === LeadStatus.CONVERTED)
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  saleAmount?: number;

  @ValidateIf((o: PostCallFollowupDto) => o.status === LeadStatus.WON || o.status === LeadStatus.CONVERTED)
  @IsString()
  @MinLength(1, { message: 'Payment proof is required (upload file or paste a link)' })
  paymentProofUrl?: string;

  @IsOptional()
  @IsString()
  trnId?: string;

  @ValidateIf((o: PostCallFollowupDto) => o.status === LeadStatus.WON || o.status === LeadStatus.CONVERTED)
  @IsOptional()
  @IsString()
  saleProduct?: string;
}
