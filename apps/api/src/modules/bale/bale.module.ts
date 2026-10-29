import { Global, Module } from '@nestjs/common';
import { BaleController } from './bale.controller.js';
import { BaleService } from './bale.service.js';

/**
 * The Bale bridge is global so `NotificationService` (used by shop, documents,
 * automation …) can mirror events without every module importing it.
 */
@Global()
@Module({
  controllers: [BaleController],
  providers: [BaleService],
  exports: [BaleService],
})
export class BaleModule {}
