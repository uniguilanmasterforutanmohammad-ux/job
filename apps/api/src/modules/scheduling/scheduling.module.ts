import { Module } from '@nestjs/common';
import { SchedulingController } from './scheduling.controller.js';
import { SchedulingService } from './scheduling.service.js';
import { SchedulingExtController } from './scheduling-ext.controller.js';
import { SchedulingExtService } from './scheduling-ext.service.js';
import { SchedulingExtraController } from './scheduling-extra.controller.js';
import { SchedulingExtraService } from './scheduling-extra.service.js';

@Module({
  controllers: [SchedulingController, SchedulingExtController, SchedulingExtraController],
  providers: [SchedulingService, SchedulingExtService, SchedulingExtraService],
  exports: [SchedulingService, SchedulingExtService, SchedulingExtraService],
})
export class SchedulingModule {}
