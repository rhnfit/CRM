import { AutomationTriggerType } from '@prisma/client';
import { IsArray, IsBoolean, IsEnum, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class FlowStepDto {
  @IsString()
  type!: string;

  @IsOptional()
  config?: Record<string, unknown>;
}

export class CreateFlowDto {
  @IsString()
  name!: string;

  @IsEnum(AutomationTriggerType)
  triggerType!: AutomationTriggerType;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FlowStepDto)
  steps!: FlowStepDto[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

