import { Module } from '@nestjs/common';
import { AttendanceController } from './attendance.controller.js';
import { AttendanceService } from './attendance.service.js';
import { AttendanceExtraController } from './attendance-extra.controller.js';
import { AttendanceExtraService } from './attendance-extra.service.js';
import {
  AttendanceQrAdminController,
  AttendanceQrPublicController,
} from './attendance-qr.controller.js';
import { AttendanceQrService } from './attendance-qr.service.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [AuthModule],
  controllers: [AttendanceController, AttendanceExtraController, AttendanceQrAdminController, AttendanceQrPublicController],
  providers: [AttendanceService, AttendanceExtraService, AttendanceQrService],
  exports: [AttendanceService, AttendanceExtraService, AttendanceQrService],
})
export class AttendanceModule {}
