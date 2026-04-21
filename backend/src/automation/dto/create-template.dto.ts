import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateTemplateDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  language?: string;

  @IsString()
  @MaxLength(2000)
  body!: string;

  @IsOptional()
  variables?: Record<string, string>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

