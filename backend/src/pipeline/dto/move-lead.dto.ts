import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class MoveLeadDto {
  @IsString()
  stageId!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  kanbanOrder?: number;
}
