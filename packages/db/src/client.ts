import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/client/client.js';
import { ensureRootEnv } from './env.js';

/**
 * Build a Prisma client bound to the PostgreSQL driver adapter.
 * Prisma 7 uses driver adapters (no Rust query engine binary in preview mode
 * for this setup), so all queries go through node-postgres.
 */
export function createPrismaClient(connectionString?: string): PrismaClient {
  ensureRootEnv();
  connectionString = connectionString ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL is not set. Copy .env.example to .env at the repo root and try again.',
    );
  }

  const adapter = new PrismaPg({ connectionString });

  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === 'development'
        ? [{ emit: 'event', level: 'query' }, 'warn', 'error']
        : ['warn', 'error'],
  });
}

export type { PrismaClient } from '../generated/client/client.js';

declare global {
  // eslint-disable-next-line no-var
  var __prismaClient: PrismaClient | undefined;
}

/**
 * Reuse a single client across hot reloads in development to avoid
 * exhausting the connection pool.
 */
export function getPrismaClient(): PrismaClient {
  if (process.env.NODE_ENV !== 'production') {
    globalThis.__prismaClient ??= createPrismaClient();
    return globalThis.__prismaClient;
  }
  return createPrismaClient();
}
