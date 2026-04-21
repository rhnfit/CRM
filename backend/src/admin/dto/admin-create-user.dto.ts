import { Department, Role } from '@prisma/client';
import { IsBoolean, IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export class AdminCreateUserDto {
  @IsString()
  name!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsEnum(Role)
  role!: Role;

  @IsEnum(Department)
  department!: Department;

  @IsOptional()
  @IsString()
  teamId?: string;

  @IsOptional()
  @IsString()
  managerId?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
