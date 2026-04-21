import { LeadStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString, Min, MinLength, ValidateIf } from 'class-validator';

export class CreateSaleDto {
  @IsString()
  leadId!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount!: number;

  @IsString()
  product!: string;

  @IsString()
  paymentStatus!: string;

  @IsString()
  orderSource!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  cac?: number;

  /** Required when payment is recorded as paid / successful */
  @ValidateIf((o: CreateSaleDto) => {
    const p = String(o.paymentStatus ?? '').toUpperCase();
    return ['PAID', 'SUCCESS', 'COMPLETED'].includes(p);
  })
  @IsString()
  @MinLength(3, { message: 'Payment proof is required for paid sales' })
  paymentProofUrl?: string;

  @IsOptional()
  @IsString()
  trnId?: string;

  /** After paid sale, set lead to WON (default) or CONVERTED */
  @IsOptional()
  @IsEnum(LeadStatus)
  closedLeadStatus?: LeadStatus;
}
