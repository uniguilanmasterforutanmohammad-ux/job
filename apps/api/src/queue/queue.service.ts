import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import type { Queue, JobsOptions } from 'bullmq';
import { QUEUE_NAMES, type QueueName } from './queue.constants.js';

/**
 * Thin typed facade over BullMQ queues. Keeps controllers/services free of
 * queue-name strings and provides a single place to add observability.
 */
@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);
  private readonly queues: Record<QueueName, Queue>;

  constructor(
    @InjectQueue(QUEUE_NAMES.MESSAGES) messages: Queue,
    @InjectQueue(QUEUE_NAMES.NOTIFICATIONS) notifications: Queue,
    @InjectQueue(QUEUE_NAMES.AUTOMATION) automation: Queue,
    @InjectQueue(QUEUE_NAMES.REPORTS) reports: Queue,
  ) {
    this.queues = {
      [QUEUE_NAMES.MESSAGES]: messages,
      [QUEUE_NAMES.NOTIFICATIONS]: notifications,
      [QUEUE_NAMES.AUTOMATION]: automation,
      [QUEUE_NAMES.REPORTS]: reports,
    };
  }

  get(name: QueueName): Queue {
    return this.queues[name];
  }

  async add(
    name: QueueName,
    job: string,
    payload: Record<string, unknown>,
    options?: JobsOptions,
  ): Promise<string | undefined> {
    const added = await this.queues[name].add(job, payload, options);
    this.logger.debug(`Queued ${name}/${job} id=${added.id}`);
    return added.id;
  }

  /** Schedules a job to run at a future date (used for reminders/renewals). */
  async schedule(
    name: QueueName,
    job: string,
    payload: Record<string, unknown>,
    runAt: Date,
  ): Promise<string | undefined> {
    const delay = Math.max(0, runAt.getTime() - Date.now());
    return this.add(name, job, payload, { delay });
  }

  /**
   * Registers a cron-like repeatable scheduler (BullMQ 6 job schedulers).
   * Idempotent: calling again with the same id updates the schedule.
   */
  async repeat(
    name: QueueName,
    job: string,
    payload: Record<string, unknown>,
    pattern: string,
  ): Promise<string> {
    const schedulerId = `${job}:${pattern}`;
    await this.queues[name].upsertJobScheduler(
      schedulerId,
      { pattern },
      { name: job, data: payload },
    );
    this.logger.debug(`Scheduled ${name}/${job} cron="${pattern}"`);
    return schedulerId;
  }

  async counts(name: QueueName) {
    const queue = this.queues[name];
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
    ]);
    return { waiting, active, completed, failed, delayed };
  }
}
