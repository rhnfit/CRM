import { TicketPriority, TicketStatus, TicketType } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';

export class CreateTicketDto {
  @IsString()
  customerName!: string;

  @IsString()
  phone!: string;

  @IsEnum(TicketType)
  type!: TicketType;

  @IsOptional()
  @IsEnum(TicketPriority)
  priority?: TicketPriority;

  @IsOptional()
  @IsEnum(TicketStatus)
  status?: TicketStatus;

  @IsString()
  assignedTo!: string;

  @IsOptional()
  @IsString()
  leadId?: string;

  @IsOptional()
  @IsDateString()
  slaDeadline?: string;

  @IsOptional()
  @IsString()
  resolutionNotes?: string;
}
