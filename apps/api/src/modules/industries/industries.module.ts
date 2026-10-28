import { Module } from '@nestjs/common';
import { IndustriesController } from './industries.controller.js';
import { IndustryRegistryService } from './industry-registry.service.js';

/**
 * Industry vertical registry (PRD §17). Deliberately dependency-free so both
 * the tenant-facing auth flow and the platform admin console can use it without
 * creating a module cycle.
 */
@Module({
  controllers: [IndustriesController],
  providers: [IndustryRegistryService],
  exports: [IndustryRegistryService],
})
export class IndustriesModule {}
