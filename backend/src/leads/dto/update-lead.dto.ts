import { LeadSource, LeadStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class UpdateLeadDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEnum(LeadSource)
  source?: LeadSource;

  @IsOptional()
  @IsString()
  campaign?: string;

  @IsOptional()
  @IsString()
  productInterest?: string;

  @IsOptional()
  @IsInt()
  leadScore?: number;

  @IsOptional()
  @IsEnum(LeadStatus)
  status?: LeadStatus;

  @IsOptional()
  @IsString()
  assignedTo?: string;

  @IsOptional()
  @IsDateString()
  nextFollowupAt?: string;

  @ValidateIf((o: UpdateLeadDto) => o.status === LeadStatus.WON || o.status === LeadStatus.CONVERTED)
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  saleAmount?: number;

  @ValidateIf((o: UpdateLeadDto) => o.status === LeadStatus.WON || o.status === LeadStatus.CONVERTED)
  @IsString()
  @MinLength(1)
  paymentProofUrl?: string;

  @IsOptional()
  @IsString()
  trnId?: string;

  @IsOptional()
  @IsString()
  saleProduct?: string;
}
