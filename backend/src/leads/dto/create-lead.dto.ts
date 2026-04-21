import { LeadSource, LeadStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString } from 'class-validator';

export class CreateLeadDto {
  @IsString()
  name!: string;

  @IsString()
  phone!: string;

  @IsEnum(LeadSource)
  source!: LeadSource;

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

  /** Set explicitly, or omit and use `autoAssignTeamId` for round-robin on a sales team. */
  @IsOptional()
  @IsString()
  assignedTo?: string;

  @IsOptional()
  @IsString()
  autoAssignTeamId?: string;

  @IsOptional()
  @IsDateString()
  nextFollowupAt?: string;
}
