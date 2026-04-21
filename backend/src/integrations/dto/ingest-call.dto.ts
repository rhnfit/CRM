import { CallType } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class IngestCallDto {
  @IsString()
  callId!: string;

  @IsString()
  userId!: string;

  @IsOptional()
  @IsString()
  leadId?: string;

  @IsEnum(CallType)
  callType!: CallType;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  duration!: number;

  @IsOptional()
  @IsString()
  recordingUrl?: string;
}
