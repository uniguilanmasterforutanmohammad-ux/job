import { Module } from '@nestjs/common';
import { StorageService } from '../documents/storage.service.js';
import { FilesController } from './files.controller.js';

@Module({
  controllers: [FilesController],
  providers: [StorageService],
  exports: [StorageService],
})
export class FilesModule {}
