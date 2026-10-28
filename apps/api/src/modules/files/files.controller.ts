import {
  Controller,
  Get,
  Param,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { createReadStream } from 'node:fs';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { StorageService } from '../documents/storage.service.js';

type MulterFile = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
};

@ApiTags('files')
@Controller('files')
export class FilesController {
  constructor(private readonly storage: StorageService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'آپلود فایل (DOC-03)' })
  upload(@CurrentUser('tenantId') tenantId: string, @UploadedFile() file: MulterFile) {
    return this.storage.upload(tenantId, {
      buffer: file.buffer,
      originalName: file.originalname,
      mimeType: file.mimetype,
    });
  }

  @Get('*key')
  @Public()
  @ApiOperation({ summary: 'دریافت فایل' })
  download(@Param('key') key: string | string[], @Res() res: Response) {
    const path = Array.isArray(key) ? key.join('/') : key;
    const full = this.storage.resolveLocalPath(path);
    const stream = createReadStream(full);
    stream.on('error', () => res.status(404).end());
    stream.pipe(res);
  }
}
