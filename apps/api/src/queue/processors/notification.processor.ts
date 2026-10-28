import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { NotificationService, type NotificationChannel } from '../../modules/notifications/notification.service.js';
import { NOTIFICATION_JOBS, QUEUE_NAMES } from '../queue.constants.js';

type DispatchPayload = {
  tenantId: string;
  memberId?: string | null;
  customerId?: string | null;
  event: string;
  title: string;
  body: string;
  channels?: NotificationChannel[];
};

/** Worker that fans out multi-channel notifications (CORE-08). */
@Processor(QUEUE_NAMES.NOTIFICATIONS)
export class NotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(private readonly notifications: NotificationService) {
    super();
  }

  async process(job: Job<DispatchPayload>): Promise<void> {
    if (job.name !== NOTIFICATION_JOBS.DISPATCH) return;
    const result = await this.notifications.notify(job.data);
    this.logger.debug(
      `Notification event=${job.data.event} delivered=${result.delivered.join(',') || '-'} failed=${
        result.failed.join(',') || '-'
      }`,
    );
  }
}
