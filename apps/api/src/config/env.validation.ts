import { z } from 'zod';

export const appEnv = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  API_PORT: z.coerce.number().default(3000),
  API_HOST: z.string().default('0.0.0.0'),
  DATABASE_URL: z.string().url(),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().default(''),
  SMTP_HOST: z.string().default('localhost'),
  SMTP_PORT: z.coerce.number().default(1025),
  SMTP_USER: z.string().default(''),
  SMTP_PASSWORD: z.string().default(''),
  SMTP_SECURE: z.coerce.boolean().default(false),
  SMTP_FROM: z.string().default('noreply@ilarrive.local'),
  JWT_SECRET: z.string().min(1),
  SESSION_SECRET: z.string().min(1),
  SENTRY_DSN: z.string().default(''),
  FRONTEND_WEB_URL: z.string().default('http://localhost:4200'),
  FRONTEND_TRACK_URL: z.string().default('http://localhost:4201'),
  SMS_PROVIDER: z.enum(['console', 'brevo']).default('console'),
  BREVO_API_KEY: z.string().default(''),
  BREVO_SENDER: z.string().default(''),
  ROUTING_PROVIDER: z.enum(['fake', 'tomtom']).default('fake'),
  TOMTOM_API_KEY: z.string().default(''),
  GEOCODING_PROVIDER: z.enum(['ban']).default('ban'),
  MAP_TILES_URL: z.string().default(''),
  MAP_TILES_KEY: z.string().default(''),
});

export type AppEnvironment = z.infer<typeof appEnv>;
