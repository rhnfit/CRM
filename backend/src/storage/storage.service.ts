import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class StorageService {
  private readonly log = new Logger(StorageService.name);
  private readonly client: S3Client | null;
  private readonly bucket: string;

  constructor(private readonly config: ConfigService) {
    const bucket = config.get<string>('S3_BUCKET');
    const region = config.get<string>('AWS_REGION') ?? 'ap-south-1';
    this.bucket = bucket ?? '';

    if (!bucket) {
      this.log.warn('S3_BUCKET not set — call recording uploads disabled');
      this.client = null;
      return;
    }

    this.client = new S3Client({
      region,
      credentials: {
        accessKeyId: config.getOrThrow<string>('AWS_ACCESS_KEY_ID'),
        secretAccessKey: config.getOrThrow<string>('AWS_SECRET_ACCESS_KEY'),
      },
    });
  }

  enabled(): boolean {
    return this.client !== null;
  }

  async presignUpload(key: string, contentType = 'audio/mpeg', expiresIn = 300): Promise<string> {
    if (!this.client) {
      throw new Error('S3 not configured');
    }
    const cmd = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });
    return getSignedUrl(this.client, cmd, { expiresIn });
  }

  async presignDownload(key: string, expiresIn = 3600): Promise<string> {
    if (!this.client) {
      throw new Error('S3 not configured');
    }
    const cmd = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.client, cmd, { expiresIn });
  }
}
