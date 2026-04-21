import { Type } from 'class-transformer';
import { IsNumber, IsString, Matches, Min } from 'class-validator';

export class UpsertTargetDto {
  @IsString()
  userId!: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}$/)
  month!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  targetAmount!: number;
}
