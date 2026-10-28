import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../config/configuration.js';
import { AUTOMATION_JOBS, QUEUE_NAMES } from './queue.constants.js';
import { QueueService } from './queue.service.js';

/**
 * Registers the platform's recurring background jobs on boot. Guarded by
 * SCHEDULER_ENABLED so dev/test runs can opt out.
 */
@Injectable()
export class SchedulerService implements OnModuleInit {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private readonly queue: QueueService,
    private readonly config: ConfigService<AppConfig>,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!this.config.get('schedulerEnabled', { infer: true })) {
      this.logger.log('Scheduler disabled (SCHEDULER_ENABLED=false)');
      return;
    }

    const schedules: Array<{ job: string; pattern: string }> = [
      { job: AUTOMATION_JOBS.APPOINTMENT_REMINDER, pattern: '*/15 * * * *' },
      { job: AUTOMATION_JOBS.SUBSCRIPTION_RENEWAL, pattern: '0 3 * * *' },
      { job: AUTOMATION_JOBS.INSTALLMENT_OVERDUE, pattern: '30 3 * * *' },
      { job: AUTOMATION_JOBS.DEDUCT_STOCK_FOR_SERVICE, pattern: '5 * * * *' },
      { job: AUTOMATION_JOBS.DOCUMENT_EXPIRY, pattern: '0 4 * * *' },
    ];

    for (const schedule of schedules) {
      await this.queue.repeat(
        QUEUE_NAMES.AUTOMATION,
        schedule.job,
        {},
        schedule.pattern,
      );
    }
    this.logger.log(`Registered ${schedules.length} recurring automation jobs`);
  }
}
