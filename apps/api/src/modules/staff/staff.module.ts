import { Module } from '@nestjs/common';
import { StaffController } from './staff.controller.js';
import { StaffService } from './staff.service.js';
import { StaffExtraController } from './staff-extra.controller.js';
import { StaffExtraService } from './staff-extra.service.js';

@Module({
  controllers: [StaffExtraController, StaffController],
  providers: [StaffService, StaffExtraService],
  exports: [StaffService, StaffExtraService],
})
export class StaffModule {}
