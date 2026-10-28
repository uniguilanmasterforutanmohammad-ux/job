import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../config/configuration.js';
import { QUEUE_NAMES } from './queue.constants.js';
import { QueueService } from './queue.service.js';

/**
 * Global queue wiring (Redis-backed BullMQ). Producers can inject QueueService
 * from anywhere; workers/processors register themselves in their own modules.
 */
@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig>) => ({
        connection: {
          url: config.get('redisUrl', { infer: true }) as string,
          maxRetriesPerRequest: null,
        },
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 5_000 },
          removeOnComplete: 1_000,
          removeOnFail: 5_000,
        },
      }),
    }),
    BullModule.registerQueue(
      { name: QUEUE_NAMES.MESSAGES },
      { name: QUEUE_NAMES.NOTIFICATIONS },
      { name: QUEUE_NAMES.AUTOMATION },
      { name: QUEUE_NAMES.REPORTS },
    ),
  ],
  providers: [QueueService],
  exports: [QueueService, BullModule],
})
export class QueueModule {}
