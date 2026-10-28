import fs from 'node:fs';
import path from 'node:path';
import { config as loadEnv } from 'dotenv';

/** Load the monorepo root .env before NestJS reads process.env. */
export function loadRootEnv(): void {
  let dir = __dirname;
  for (let i = 0; i < 6; i += 1) {
    const candidate = path.join(dir, '.env');
    if (fs.existsSync(candidate)) {
      loadEnv({ path: candidate });
      return;
    }
    dir = path.dirname(dir);
  }
}
