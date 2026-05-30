import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class StorageService {
  private s3Client: S3Client | null = null;
  private bucket: string;
  private useS3: boolean;
  private localPath: string;

  constructor(private config: ConfigService) {
    const accessKey = this.config.get<string>('AWS_ACCESS_KEY_ID');
    const secretKey = this.config.get<string>('AWS_SECRET_ACCESS_KEY');
    this.bucket = this.config.get<string>('AWS_S3_BUCKET') || 'hirely-cvs';
    this.useS3 = !!(accessKey && secretKey);
    this.localPath = path.join(process.cwd(), 'uploads');

    if (this.useS3) {
      this.s3Client = new S3Client({
        region: this.config.get<string>('AWS_REGION') || 'us-east-1',
        credentials: { accessKeyId: accessKey!, secretAccessKey: secretKey! },
      });
    }
  }

  async upload(
    buffer: Buffer,
    originalName: string,
    mimeType: string,
  ): Promise<{ key: string; storageType: string }> {
    const ext = path.extname(originalName);
    const key = `cvs/${uuidv4()}${ext}`;

    if (this.useS3 && this.s3Client) {
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: buffer,
          ContentType: mimeType,
        }),
      );
      return { key, storageType: 's3' };
    }

    await fs.mkdir(this.localPath, { recursive: true });
    const filePath = path.join(this.localPath, path.basename(key));
    await fs.writeFile(filePath, buffer);
    return { key: path.basename(key), storageType: 'local' };
  }

  async download(key: string, storageType: string): Promise<Buffer> {
    if (storageType === 's3' && this.s3Client) {
      const response = await this.s3Client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      const stream = response.Body;
      if (!stream) throw new Error('Empty S3 response');
      const chunks: Buffer[] = [];
      for await (const chunk of stream as AsyncIterable<Buffer>) {
        chunks.push(Buffer.from(chunk));
      }
      return Buffer.concat(chunks);
    }

    const filePath = path.join(this.localPath, path.basename(key));
    return fs.readFile(filePath);
  }

  async delete(key: string, storageType: string): Promise<void> {
    if (storageType === 's3' && this.s3Client) {
      await this.s3Client.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return;
    }

    const filePath = path.join(this.localPath, path.basename(key));
    try {
      await fs.unlink(filePath);
    } catch {
      // file may not exist
    }
  }
}
