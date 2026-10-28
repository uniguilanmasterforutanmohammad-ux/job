/**
 * Seed the platform with reference data + a demo pilot tenant.
 *
 * Pilot vertical per PRD §1.4: مربی ورزشی (sports coaching) with multiple
 * branches, students, monthly tuition and attendance.
 */
import { hash } from 'argon2';
import { createPrismaClient } from '../src/client.js';
import type { ModuleKey, IndustryCategory } from '../generated/client/enums.js';

const prisma = createPrismaClient();

type PlanSeed = {
  code: string;
  name: string;
  description: string;
  price: number;
  modules: ModuleKey[];
  limits: Record<string, number>;
};

const PLAN_SEEDS: PlanSeed[] = [
  {
    code: 'starter',
    name: 'پایه',
    description: 'برای کسب‌وکارهای تک‌نفره',
    price: 0,
    modules: ['CRM', 'SCH', 'FIN', 'ATT', 'MSG', 'RPT'],
    limits: { branches: 1, members: 1, customers: 100 },
  },
  {
    code: 'pro',
    name: 'حرفه‌ای',
    description: 'برای کسب‌وکارهای در حال رشد',
    price: 990000,
    modules: ['CRM', 'SCH', 'FIN', 'ATT', 'MSG', 'SUB', 'INV', 'HR', 'MKT', 'RPT', 'APP'],
    limits: { branches: 3, members: 10, customers: 2000 },
  },
  {
    code: 'enterprise',
    name: 'سازمانی',
    description: 'برای مجموعه‌های چندشعبه‌ای',
    price: 2990000,
    modules: [
      'CRM',
      'SCH',
      'FIN',
      'ATT',
      'MSG',
      'SUB',
      'CAMP',
      'INV',
      'HR',
      'MKT',
      'SHOP',
      'DOC',
      'RPT',
      'APP',
    ],
    limits: { branches: 20, members: 200, customers: 100000 },
  },
];

async function seedPlans() {
  for (const plan of PLAN_SEEDS) {
    const existing = await prisma.plan.findFirst({ where: { tenantId: null, code: plan.code } });
    if (existing) {
      await prisma.plan.update({
        where: { id: existing.id },
        data: { name: plan.name, description: plan.description, price: plan.price },
      });
    } else {
      await prisma.plan.create({
        data: {
          tenantId: null,
          code: plan.code,
          name: plan.name,
          description: plan.description,
          price: plan.price,
          billingCycle: 'MONTHLY',
          modules: plan.modules,
          limits: plan.limits,
        },
      });
    }
  }
  console.log(`  ✓ plans: ${PLAN_SEEDS.length}`);
}

async function seedDemoTenant() {
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'coach-demo' },
    update: {},
    create: {
      slug: 'coach-demo',
      name: 'باشگاه نمونه مربی‌گری',
      industry: 'SPORTS_COACHING' as IndustryCategory,
      phone: '09120000000',
      currency: 'IRR',
      calendar: 'JALALI',
      locale: 'fa-IR',
      taxRate: 9,
    },
  });
  console.log(`  ✓ tenant: ${tenant.name} (${tenant.id})`);

  const enabledModules: ModuleKey[] = [
    'CRM',
    'SCH',
    'FIN',
    'ATT',
    'MSG',
    'SUB',
    'CAMP',
    'INV',
    'HR',
    'MKT',
    'SHOP',
    'DOC',
    'RPT',
    'APP',
  ];
  for (const key of enabledModules) {
    await prisma.tenantModule.upsert({
      where: { tenantId_key: { tenantId: tenant.id, key } },
      update: { isEnabled: true },
      create: { tenantId: tenant.id, key, isEnabled: true },
    });
  }
  console.log(`  ✓ modules enabled: ${enabledModules.length}`);

  const roleDefs = [
    { key: 'owner', name: 'مالک', isSystem: true, permissions: ['*'] },
    { key: 'manager', name: 'مدیر', isSystem: true, permissions: ['*'] },
    {
      key: 'staff',
      name: 'مربی',
      isSystem: true,
      permissions: ['crm:read', 'sch:read', 'sch:write', 'att:write'],
    },
    {
      key: 'accountant',
      name: 'حسابدار',
      isSystem: true,
      permissions: ['fin:read', 'fin:write', 'rpt:read'],
    },
    {
      key: 'reception',
      name: 'پذیرش',
      isSystem: true,
      permissions: ['crm:read', 'crm:write', 'sch:read', 'sch:write'],
    },
  ];
  for (const role of roleDefs) {
    await prisma.role.upsert({
      where: { tenantId_key: { tenantId: tenant.id, key: role.key } },
      update: { name: role.name, permissions: role.permissions },
      create: { tenantId: tenant.id, ...role },
    });
  }
  console.log(`  ✓ roles: ${roleDefs.length}`);

  const branch = await prisma.branch.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'MAIN' } },
    update: {},
    create: {
      tenantId: tenant.id,
      code: 'MAIN',
      name: 'شعبه مرکزی',
      city: 'تهران',
      address: 'تهران، خیابان نمونه',
      workHours: {
        sat: { open: '08:00', close: '22:00' },
        sun: { open: '08:00', close: '22:00' },
        mon: { open: '08:00', close: '22:00' },
        tue: { open: '08:00', close: '22:00' },
        wed: { open: '08:00', close: '22:00' },
        thu: { open: '08:00', close: '18:00' },
        fri: null,
      },
    },
  });
  console.log(`  ✓ branch: ${branch.name}`);

  const ownerRole = await prisma.role.findUnique({
    where: { tenantId_key: { tenantId: tenant.id, key: 'owner' } },
  });
  const ownerPhone = '09121111111';
  const existingOwner = await prisma.member.findFirst({
    where: { tenantId: tenant.id, phone: ownerPhone },
  });
  const owner =
    existingOwner ??
    (await prisma.member.create({
      data: {
        tenantId: tenant.id,
        branchId: branch.id,
        roleId: ownerRole?.id,
        systemRole: 'OWNER',
        fullName: 'مدیر نمونه',
        phone: ownerPhone,
        passwordHash: await hash('Password@123'),
        phoneVerified: true,
      },
    }));
  console.log(`  ✓ owner: ${owner.fullName} (${owner.phone})`);

  await prisma.subscription.upsert({
    where: { tenantId: tenant.id },
    update: {},
    create: {
      tenantId: tenant.id,
      status: 'TRIAL',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      seats: 5,
    },
  });
  console.log('  ✓ subscription: TRIAL (14 days)');

  const serviceDefs = [
    { name: 'تمرین بدنسازی یک‌ساعته', durationMinutes: 60, price: 300000 },
    { name: 'تمرین اختصاصی', durationMinutes: 90, price: 500000 },
    { name: 'کلاس گروهی', durationMinutes: 60, price: 150000 },
  ];
  let serviceCount = 0;
  for (const def of serviceDefs) {
    const found = await prisma.service.findFirst({
      where: { tenantId: tenant.id, name: def.name },
    });
    if (!found) {
      await prisma.service.create({ data: { tenantId: tenant.id, ...def } });
    }
    serviceCount += 1;
  }
  console.log(`  ✓ services: ${serviceCount}`);

  const customerDefs = [
    { fullName: 'علی رضایی', phone: '09122222222', tags: ['VIP'] },
    { fullName: 'مریم احمدی', phone: '09123333333', tags: [] },
    { fullName: 'حسین کریمی', phone: '09124444444', tags: ['بدهکار'] },
  ];
  for (const def of customerDefs) {
    await prisma.customer.upsert({
      where: { tenantId_phone: { tenantId: tenant.id, phone: def.phone } },
      update: {},
      create: { tenantId: tenant.id, ...def, leadStage: 'WON' },
    });
  }
  console.log(`  ✓ customers: ${customerDefs.length}`);

  // ----- Phase 2 module demo data -----

  // MSG templates
  const templateKeys = [
    'appointment_reminder',
    'payment_due',
    'birthday',
    'discount',
  ] as const;
  for (const key of templateKeys) {
    await prisma.messageTemplate.upsert({
      where: { tenantId_key: { tenantId: tenant.id, key } },
      update: {},
      create: {
        tenantId: tenant.id,
        key,
        channel: 'SMS',
        title: key,
        body: '{{customerName}} عزیز، پیام نمونه.',
      },
    });
  }

  // SUB plans
  const planSeeds = [
    { name: 'ماهانه نقره‌ای', kind: 'MONTHLY' as const, price: 3000000, daysCount: 30, sessionsCount: 8 },
    { name: 'فصلی طلایی', kind: 'QUARTERLY' as const, price: 8000000, daysCount: 90, sessionsCount: 24 },
  ];
  for (const plan of planSeeds) {
    const found = await prisma.membershipPlan.findFirst({
      where: { tenantId: tenant.id, name: plan.name },
    });
    if (!found) await prisma.membershipPlan.create({ data: { tenantId: tenant.id, ...plan } });
  }

  // INV products
  const productSeeds = [
    { name: 'کفش ورزشی', sku: 'SH-01', costPrice: 800000, salePrice: 1200000, stock: 12, minStock: 3 },
    { name: 'دستکش تمرین', sku: 'GL-01', costPrice: 150000, salePrice: 250000, stock: 30, minStock: 5 },
    { name: 'بطری آب', sku: 'BT-01', costPrice: 40000, salePrice: 80000, stock: 2, minStock: 5 },
  ];
  for (const product of productSeeds) {
    const found = await prisma.product.findFirst({
      where: { tenantId: tenant.id, name: product.name },
    });
    if (!found) await prisma.product.create({ data: { tenantId: tenant.id, ...product } });
  }

  // HR staff
  const staffSeeds = [
    { fullName: 'مربی رضا محمدی', phone: '09125555555', position: 'مربی بدنسازی', baseSalary: 20000000, commissionRate: 10 },
    { fullName: 'مربی سارا نادری', phone: '09126666666', position: 'مربی یوگا', baseSalary: 18000000, commissionRate: 12 },
  ];
  for (const staff of staffSeeds) {
    const found = await prisma.staffProfile.findFirst({
      where: { tenantId: tenant.id, fullName: staff.fullName },
    });
    if (!found) await prisma.staffProfile.create({ data: { tenantId: tenant.id, ...staff } });
  }

  // MKT gift cards + survey
  const giftFound = await prisma.giftCard.findFirst({ where: { tenantId: tenant.id, code: 'WELCOME-100' } });
  if (!giftFound) {
    await prisma.giftCard.create({
      data: { tenantId: tenant.id, code: 'WELCOME-100', balance: 500000 },
    });
  }
  const surveyFound = await prisma.survey.findFirst({ where: { tenantId: tenant.id, title: 'نظرسنجی رضایت' } });
  if (!surveyFound) {
    await prisma.survey.create({
      data: {
        tenantId: tenant.id,
        title: 'نظرسنجی رضایت',
        questions: [{ id: 'q1', text: 'چقدر از خدمات راضی بودید؟', type: 'rating' }],
      },
    });
  }

  // DOC contract template
  const tplFound = await prisma.contractTemplate.findFirst({
    where: { tenantId: tenant.id, title: 'قرارداد مربیگری' },
  });
  if (!tplFound) {
    await prisma.contractTemplate.create({
      data: {
        tenantId: tenant.id,
        title: 'قرارداد مربیگری',
        body: 'اینجانب {{customerName}} قرارداد به مبلغ {{amount}} تومان را می‌پذیرم.',
      },
    });
  }

  // CAMP campaign
  const campFound = await prisma.campaign.findFirst({
    where: { tenantId: tenant.id, title: 'خرید لباس تیم' },
  });
  if (!campFound) {
    await prisma.campaign.create({
      data: {
        tenantId: tenant.id,
        title: 'خرید لباس تیم',
        description: 'کمک برای تهیه لباس فرم تیم',
        targetAmount: 10000000,
        minAmount: 100000,
        status: 'ACTIVE',
      },
    });
  }

  console.log('  ✓ phase-2 demo data seeded');

  return tenant;
}

/**
 * Platform (super) admins. These live in their own identity namespace and are
 * never members of any tenant. Dev password is intentionally simple; change it
 * immediately in any non-development environment.
 */
async function seedPlatformAdmins() {
  const admins = [
    {
      phone: '09120000001',
      fullName: 'مدیر ارشد پلتفرم',
      email: 'superadmin@platform.local',
      role: 'SUPER_ADMIN' as const,
    },
    {
      phone: '09120000002',
      fullName: 'پشتیبانی پلتفرم',
      email: 'support@platform.local',
      role: 'SUPPORT' as const,
    },
  ];

  for (const admin of admins) {
    const passwordHash = await hash('Admin@12345');
    const existing = await prisma.platformMember.findUnique({ where: { phone: admin.phone } });
    if (existing) {
      await prisma.platformMember.update({
        where: { id: existing.id },
        data: { fullName: admin.fullName, email: admin.email, role: admin.role },
      });
    } else {
      await prisma.platformMember.create({
        data: {
          phone: admin.phone,
          fullName: admin.fullName,
          email: admin.email,
          role: admin.role,
          passwordHash,
          twoFactorEnabled: false,
        },
      });
    }
  }
  console.log(`  ✓ platform admins: ${admins.length}`);
  console.log('    ↳ dev operator login: 09120000001 / Admin@12345 (SUPER_ADMIN)');
  console.log('    ↳ 2FA can be enrolled from بنل مدیریت → حساب من.');
}

async function main() {
  console.log('🌱 Seeding platform reference data...');
  await seedPlans();
  await seedDemoTenant();
  await seedPlatformAdmins();
  console.log('✅ Seed complete.');
}

main()
  .catch((error) => {
    console.error('❌ seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
