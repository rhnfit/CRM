import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateActivityNoteDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  body!: string;
}
