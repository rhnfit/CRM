import { Department } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';

export enum DashboardType {
  SALES = 'SALES',
  SUPPORT = 'SUPPORT',
  TEAM = 'TEAM',
}

export enum DateRangePreset {
  TODAY = 'TODAY',
  YESTERDAY = 'YESTERDAY',
  THIS_WEEK = 'THIS_WEEK',
  LAST_7_DAYS = 'LAST_7_DAYS',
  THIS_MONTH = 'THIS_MONTH',
  LAST_30_DAYS = 'LAST_30_DAYS',
  LAST_60_DAYS = 'LAST_60_DAYS',
  LAST_90_DAYS = 'LAST_90_DAYS',
  CUSTOM = 'CUSTOM',
}

export class QueryDashboardDto {
  @IsOptional()
  @IsEnum(DashboardType)
  dashboardType?: DashboardType;

  @IsOptional()
  @IsEnum(DateRangePreset)
  dateRange?: DateRangePreset;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsEnum(Department)
  department?: Department;

  @IsOptional()
  @IsString()
  teamId?: string;
}

