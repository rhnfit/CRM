import { Department } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class AdminCreateTeamDto {
  @IsString()
  name!: string;

  @IsEnum(Department)
  department!: Department;

  @IsOptional()
  @IsString()
  managerId?: string;
}
