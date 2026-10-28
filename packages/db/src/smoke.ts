/**
 * Minimal smoke test proving the Prisma 7 client + pg adapter can reach the
 * database. Run with: pnpm --filter @repo/db exec tsx src/smoke.ts
 */
import { getPrismaClient } from './client.js';

async function main() {
  const prisma = getPrismaClient();
  const tenants = await prisma.tenant.count();
  const modules = await prisma.tenantModule.count();
  console.log(`✅ DB reachable. tenants=${tenants} tenant_modules=${modules}`);
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error('❌ smoke test failed:', error);
  process.exit(1);
});
