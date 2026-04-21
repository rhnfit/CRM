import { IsOptional, IsString } from 'class-validator';

export class PresignUploadDto {
  @IsString()
  callId!: string;

  @IsOptional()
  @IsString()
  contentType?: string;
}

export class PresignDownloadDto {
  @IsString()
  key!: string;
}

export class PaymentProofPresignDto {
  @IsString()
  leadId!: string;

  @IsString()
  fileName!: string;

  @IsOptional()
  @IsString()
  contentType?: string;
}
