import { z } from 'zod';

/**
 * Environment schema. Fail fast on boot if required config is missing so we
 * never run with insecure defaults in production.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().default('redis://localhost:6379'),

  JWT_ACCESS_SECRET: z.string().min(16, 'JWT_ACCESS_SECRET must be at least 16 chars'),
  JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET must be at least 16 chars'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('30d'),

  // Platform (super-admin) console uses a separate signing key so a tenant
  // token can never be replayed against /admin routes and vice-versa.
  JWT_PLATFORM_SECRET: z.string().optional(),
  JWT_PLATFORM_TTL: z.string().default('8h'),
  JWT_PLATFORM_REFRESH_TTL: z.string().default('7d'),
  /** When true, platform operators must enrol TOTP 2FA before using the console. */
  PLATFORM_2FA_REQUIRED: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === 'true')),

  OTP_TTL_SECONDS: z.coerce.number().default(120),
  OTP_LENGTH: z.coerce.number().default(6),
  OTP_MAX_ATTEMPTS: z.coerce.number().default(5),
  OTP_DEV_BYPASS_CODE: z.string().optional(),

  APP_URL: z.string().default('http://localhost:3000'),
  API_URL: z.string().default('http://localhost:4000'),

  PAYMENT_PROVIDER: z.enum(['mock', 'zarinpal', 'idpay']).default('mock'),
  PAYMENT_MOCK_CALLBACK_BASE: z.string().default('http://localhost:4000/api/v1/payments/callback'),

  SMS_PROVIDER: z.enum(['console', 'kavenegar', 'mellipayamak']).default('console'),
  KAVENEGAR_API_KEY: z.string().optional(),

  EMAIL_PROVIDER: z.enum(['console', 'smtp']).default('console'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.string().default('Business Platform <no-reply@localhost>'),

  // Bale (بیام‌رسان) Bot API — wire-compatible with Telegram's bot API.
  BALE_API_URL: z.string().url().default('https://tapi.bale.ai'),

  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  STORAGE_LOCAL_DIR: z.string().default('./storage'),
  STORAGE_PUBLIC_BASE: z.string().default('http://localhost:4000/api/v1/files'),

  SCHEDULER_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
});

export type AppEnv = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): AppEnv {
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
}

export function configuration() {
  const env = validateEnv(process.env);
  return {
    nodeEnv: env.NODE_ENV,
    isProd: env.NODE_ENV === 'production',
    port: env.PORT,
    databaseUrl: env.DATABASE_URL,
    redisUrl: env.REDIS_URL,
    jwt: {
      accessSecret: env.JWT_ACCESS_SECRET,
      refreshSecret: env.JWT_REFRESH_SECRET,
      accessTtl: env.JWT_ACCESS_TTL,
      refreshTtl: env.JWT_REFRESH_TTL,
    },
    platformJwt: {
      secret: env.JWT_PLATFORM_SECRET ?? `${env.JWT_ACCESS_SECRET}::platform`,
      accessTtl: env.JWT_PLATFORM_TTL,
      refreshTtl: env.JWT_PLATFORM_REFRESH_TTL,
      // Mandatory 2FA for the admin console by default in production.
      require2fa: env.PLATFORM_2FA_REQUIRED ?? env.NODE_ENV === 'production',
    },
    otp: {
      ttlSeconds: env.OTP_TTL_SECONDS,
      length: env.OTP_LENGTH,
      maxAttempts: env.OTP_MAX_ATTEMPTS,
      devBypassCode: env.OTP_DEV_BYPASS_CODE,
    },
    appUrl: env.APP_URL,
    apiUrl: env.API_URL,
    payment: {
      provider: env.PAYMENT_PROVIDER,
      mockCallbackBase: env.PAYMENT_MOCK_CALLBACK_BASE,
    },
    sms: {
      provider: env.SMS_PROVIDER,
      kavenegarApiKey: env.KAVENEGAR_API_KEY,
    },
    email: {
      provider: env.EMAIL_PROVIDER,
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      user: env.SMTP_USER,
      password: env.SMTP_PASSWORD,
      from: env.SMTP_FROM,
    },
    baleApiUrl: env.BALE_API_URL,
    storage: {
      driver: env.STORAGE_DRIVER,
      localDir: env.STORAGE_LOCAL_DIR,
      publicBase: env.STORAGE_PUBLIC_BASE,
    },
    schedulerEnabled: env.SCHEDULER_ENABLED,
  };
}

export type AppConfig = ReturnType<typeof configuration>;
