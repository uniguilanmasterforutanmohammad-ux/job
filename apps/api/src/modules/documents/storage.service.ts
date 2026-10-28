import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DomainException } from '../../common/exceptions/domain.exception.js';
import type { AppConfig } from '../../config/configuration.js';

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/csv',
]);

const MAX_BYTES = 10 * 1024 * 1024; // 10MB

export type StoredFile = {
  key: string;
  url: string;
  size: number;
  mimeType: string;
};

/**
 * Storage abstraction (DOC-03). Local disk today; swapping to S3 is a config
 * change that only touches this service.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);

  constructor(private readonly config: ConfigService<AppConfig>) {}

  private get storageConfig() {
    return this.config.get('storage', { infer: true })!;
  }

  async upload(
    tenantId: string,
    file: { buffer: Buffer; originalName: string; mimeType?: string },
  ): Promise<StoredFile> {
    if (file.buffer.length > MAX_BYTES) {
      throw DomainException.badRequest('حجم فایل بیش از حد مجاز است (حداکثر ۱۰ مگابایت)');
    }
    if (file.mimeType && !ALLOWED_MIME.has(file.mimeType)) {
      throw DomainException.badRequest('نوع فایل پشتیبانی نمی‌شود');
    }

    const cfg = this.storageConfig;
    if (cfg.driver === 's3') {
      // S3 driver plugs in here once cloud storage is provisioned.
      throw DomainException.badRequest('ذخیره‌سازی ابری هنوز پیکربندی نشده است');
    }

    const ext = extname(file.originalName).slice(0, 10);
    const key = `${tenantId}/${new Date().toISOString().slice(0, 10)}/${randomUUID()}${ext}`;
    const fullPath = resolve(cfg.localDir, key);
    await mkdir(resolve(fullPath, '..'), { recursive: true });
    await writeFile(fullPath, file.buffer);
    this.logger.debug(`Stored file key=${key} size=${file.buffer.length}`);

    return {
      key,
      url: `${cfg.publicBase}/${key}`,
      size: file.buffer.length,
      mimeType: file.mimeType ?? 'application/octet-stream',
    };
  }

  async remove(key: string): Promise<void> {
    if (this.storageConfig.driver === 's3') return;
    try {
      await unlink(resolve(this.storageConfig.localDir, key));
    } catch {
      // Already gone — nothing to do.
    }
  }

  resolveLocalPath(key: string): string {
    const base = resolve(this.storageConfig.localDir);
    const full = resolve(join(base, key));
    // Prevent path traversal outside the storage root.
    if (!full.startsWith(base)) throw DomainException.forbidden('مسیر فایل نامعتبر است');
    return full;
  }
}
