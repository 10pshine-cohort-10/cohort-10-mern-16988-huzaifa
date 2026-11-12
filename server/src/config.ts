import { z } from 'zod';
const environment = z.object({
  DATABASE_URL: z
    .string()
    .url()
    .refine(
      (value) => ['postgres:', 'postgresql:'].includes(new URL(value).protocol),
      'Use a PostgreSQL URL.',
    ),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  APP_ORIGIN: z.string().url().default('http://localhost:5173'),
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  SESSION_HOURS: z.coerce.number().int().min(1).max(168).default(24),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
});
export function getConfig(env: NodeJS.ProcessEnv = process.env) {
  const parsed = environment.parse(env);
  const url = new URL(parsed.APP_ORIGIN);
  if (url.origin !== parsed.APP_ORIGIN || url.username || url.password)
    throw new Error('APP_ORIGIN must be an origin without a path.');
  if (parsed.NODE_ENV === 'production' && url.protocol !== 'https:')
    throw new Error('Production APP_ORIGIN must use HTTPS.');
  return {
    databaseUrl: parsed.DATABASE_URL,
    port: parsed.PORT,
    origin: parsed.APP_ORIGIN,
    production: parsed.NODE_ENV === 'production',
    sessionHours: parsed.SESSION_HOURS,
    logLevel: parsed.LOG_LEVEL,
  };
}
export type Config = ReturnType<typeof getConfig>;
