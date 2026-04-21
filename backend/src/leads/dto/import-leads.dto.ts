import { IsString } from 'class-validator';

export class ImportLeadsDto {
  /** Raw CSV string (header + rows) sent from frontend. */
  @IsString()
  csv!: string;
}
