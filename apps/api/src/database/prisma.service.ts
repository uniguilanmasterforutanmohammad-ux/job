import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { createPrismaClient, type PrismaClient } from '@repo/db';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  readonly client: PrismaClient = createPrismaClient();

  async onModuleInit(): Promise<void> {
    await this.client.$connect();
    this.logger.log('Prisma connected to PostgreSQL');
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.$disconnect();
  }

  /** Escape hatch for raw queries inside a tenant-scoped transaction. */
  get db(): PrismaClient {
    return this.client;
  }
}
