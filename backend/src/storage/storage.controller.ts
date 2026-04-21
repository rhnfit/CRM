import { BadRequestException, Body, Controller, Post, UseGuards } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PaymentProofPresignDto, PresignDownloadDto, PresignUploadDto } from './dto/presign.dto';
import { StorageService } from './storage.service';

@UseGuards(JwtAuthGuard)
@Controller('storage')
export class StorageController {
  constructor(private readonly storage: StorageService) {}

  @Post('recordings/upload-url')
  async uploadUrl(@Body() dto: PresignUploadDto) {
    const key = `recordings/${dto.callId}.mp3`;
    const url = await this.storage.presignUpload(
      key,
      dto.contentType ?? 'audio/mpeg',
    );
    return { url, key };
  }

  @Post('recordings/download-url')
  async downloadUrl(@Body() dto: PresignDownloadDto) {
    const url = await this.storage.presignDownload(dto.key);
    return { url };
  }

  /** Presign upload for payment proof screenshots / PDFs (stored under payments/{leadId}/...) */
  @Post('payments/upload-url')
  async paymentProofUpload(@Body() dto: PaymentProofPresignDto) {
    if (!this.storage.enabled()) {
      throw new BadRequestException('File uploads require S3 (set S3_BUCKET and AWS credentials). Paste a https link instead.');
    }
    const safe = dto.fileName.replace(/[^a-zA-Z0-9._-]/g, '_') || 'proof';
    const ext = safe.includes('.') ? safe.split('.').pop() : 'bin';
    const key = `payments/${dto.leadId}/${randomUUID()}.${ext}`;
    const contentType = dto.contentType ?? 'application/octet-stream';
    const url = await this.storage.presignUpload(key, contentType);
    return { url, key, publicUrlNote: 'Store `key` or full s3 key string as paymentProofUrl after upload completes.' };
  }
}
