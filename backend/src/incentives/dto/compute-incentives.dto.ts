import { IsString, Matches } from 'class-validator';

export class ComputeIncentivesDto {
  /** Format YYYY-MM */
  @IsString()
  @Matches(/^\d{4}-\d{2}$/)
  month!: string;
}
