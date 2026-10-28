import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller.js';
import { ReportsService } from './reports.service.js';
import { ReportsExtController } from './reports-ext.controller.js';
import { ReportsExtService } from './reports-ext.service.js';

@Module({
  controllers: [ReportsController, ReportsExtController],
  providers: [ReportsService, ReportsExtService],
  exports: [ReportsService, ReportsExtService],
})
export class ReportsModule {}
