import fs from 'node:fs';
import path from 'node:path';
import { config as loadEnv } from 'dotenv';

let loaded = false;

/**
 * Load the monorepo root .env exactly once. Keeps the package usable from
 * scripts (seed, smoke tests) without duplicating env files per package.
 */
export function ensureRootEnv(): void {
  if (loaded || process.env.DATABASE_URL) {
    loaded = true;
    return;
  }

  let dir = __dirname;
  for (let i = 0; i < 5; i += 1) {
    const candidate = path.join(dir, '.env');
    if (fs.existsSync(candidate)) {
      loadEnv({ path: candidate });
      break;
    }
    dir = path.dirname(dir);
  }
  loaded = true;
}
