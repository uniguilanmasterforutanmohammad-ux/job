import { Module } from '@nestjs/common';
import { InventoryController } from './inventory.controller.js';
import { InventoryService } from './inventory.service.js';
import { InventoryExtraController } from './inventory-extra.controller.js';
import { InventoryExtraService } from './inventory-extra.service.js';

@Module({
  controllers: [InventoryExtraController, InventoryController],
  providers: [InventoryService, InventoryExtraService],
  exports: [InventoryService, InventoryExtraService],
})
export class InventoryModule {}
