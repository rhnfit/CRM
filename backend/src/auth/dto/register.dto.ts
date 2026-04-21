import { Department, Role } from '@prisma/client';
import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterDto {
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
}
