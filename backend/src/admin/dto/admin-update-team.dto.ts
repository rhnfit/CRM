import { Department } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class AdminUpdateTeamDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(Department)
  department?: Department;

  @IsOptional()
  @IsString()
  managerId?: string;
}
