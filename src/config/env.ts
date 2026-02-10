import { z } from 'zod'
import dotenv from 'dotenv'
import path from 'path'
import fs from 'fs'

/**
 * Load environment variables from appropriate file:
 * - Production: .env.production
 * - Development: .env.local (with fallback to .env)
 */
function loadEnvFile(): void {
   const cwd = process.cwd()
   const nodeEnv = process.env.NODE_ENV || 'development'

   // Determine which env file to load
   let envFile: string

   if (nodeEnv === 'production') {
      envFile = '.env.production'
   } else {
      // Development: prefer .env.local, fallback to .env
      envFile = fs.existsSync(path.join(cwd, '.env.local'))
         ? '.env.local'
         : '.env'
   }

   const envPath = path.resolve(cwd, envFile)

   if (fs.existsSync(envPath)) {
      dotenv.config({ path: envPath })
      console.log(`[ENV] Loaded: ${envFile}`)
   } else {
      console.warn(`[ENV] Warning: ${envFile} not found`)
   }
}

loadEnvFile()

/* ------------------------------------------------------------------
 Helpers
------------------------------------------------------------------- */

const numericString = (defaultVal: number) =>
   z
      .string()
      .optional()
      .default(String(defaultVal))
      .transform((v) => Number(v))
      .refine((v) => !isNaN(v), { message: 'Must be a valid number' })

const booleanString = (defaultVal: boolean) =>
   z
      .string()
      .optional()
      .default(String(defaultVal))
      .transform((v) => v === 'true')

/* ------------------------------------------------------------------
 Environment Schema
------------------------------------------------------------------- */

const envSchema = z.object({
   /* =========================
      Application
   ========================== */
   NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
   PORT: numericString(5000),
   API_VERSION: z.string().default('v1'),
   APP_NAME: z.string().default('rozx'),
   CLIENT_URL: z.string().url().default('http://localhost:3000'),

   /* =========================
      Supabase
   ========================== */
   SUPABASE_URL: z.string().url(),
   SUPABASE_ANON_KEY: z.string().min(20),
   SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),

   /* =========================
      JWT
   ========================== */
   JWT_SECRET: z.string().min(32),
   JWT_ACCESS_TOKEN_EXPIRES_IN: z.string().default('1h'),
   JWT_REFRESH_TOKEN_EXPIRES_IN: z.string().default('7d'),
   JWT_ISSUER: z.string().default('rozx'),

   /* =========================
      Security
   ========================== */
   COOKIE_SECRET: z.string().min(32),
   COOKIE_DOMAIN: z.string().optional(),

   /* =========================
      OTP
   ========================== */
   OTP_EXPIRY_MINUTES: numericString(10),
   OTP_LENGTH: numericString(6),
   OTP_MAX_ATTEMPTS: numericString(3),

   /* =========================
      Rate Limiting
   ========================== */
   RATE_LIMIT_WINDOW_MS: numericString(60000),
   RATE_LIMIT_MAX_REQUESTS: numericString(100),

   /* =========================
      CORS
   ========================== */
   CORS_ORIGIN: z.string().default('http://localhost:3000'),
   CORS_CREDENTIALS: booleanString(true),

   /* =========================
      Logging
   ========================== */
   LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
   LOG_FORMAT: z.enum(['dev', 'combined', 'json']).default('dev'),

   /* =========================
      Platform Fees (%)
   ========================== */
   PLATFORM_FEE_ONLINE_PERCENT: numericString(7),
   PLATFORM_FEE_IN_PERSON_PERCENT: numericString(4),
   PLATFORM_FEE_WALKIN_PERCENT: numericString(2),
   PLATFORM_FEE_FOLLOWUP_PERCENT: numericString(3),
   PLATFORM_FEE_MEDICAL_PERCENT: numericString(5),
   GST_RATE_PERCENT: numericString(18),

   /* =========================
      Payment Gateway
   ========================== */
   // Active provider: 'razorpay' | 'cashfree' (can also be switched via DB)
   PAYMENT_PROVIDER: z.enum(['razorpay', 'cashfree']).default('cashfree').optional(),

   /* =========================
      Razorpay (Optional)
   ========================== */
   RAZORPAY_KEY_ID: z.string().optional(),
   RAZORPAY_KEY_SECRET: z.string().optional(),
   RAZORPAY_WEBHOOK_SECRET: z.string().optional(),

   /* =========================
      Cashfree
   ========================== */
   CASHFREE_APP_ID: z.string().optional(),
   CASHFREE_SECRET_KEY: z.string().optional(),
   CASHFREE_ENV: z.enum(['sandbox', 'production']).default('sandbox').optional(),
   CASHFREE_WEBHOOK_SECRET: z.string().optional(),


   /* =========================
      Services (Optional)
   ========================== */
   // WhatsApp Business API
   WHATSAPP_API_VERSION: z.string().default('v18.0').optional(),
   WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
   WHATSAPP_ACCESS_TOKEN: z.string().optional(),
   WHATSAPP_VERIFY_TOKEN: z.string().optional(),
   WHATSAPP_TEMPLATE_OTP_LOGIN: z.string().optional(),
   WHATSAPP_TEMPLATE_OTP_REGISTRATION: z.string().optional(),
   WHATSAPP_LANGUAGE_CODE: z.string().default('en_US'),

   // Gupshup (WhatsApp Provider)
   GUPSHUP_APP_NAME: z.string().optional(),
   GUPSHUP_APP_ID: z.string().optional(),
   GUPSHUP_API_KEY: z.string().optional(),
   GUPSHUP_SOURCE: z.string().optional(),

   // Twilio
   TWILIO_ACCOUNT_SID: z.string().optional(),
   TWILIO_AUTH_TOKEN: z.string().optional(),
   TWILIO_PHONE_NUMBER: z.string().optional(),

   // SendGrid (Email)
   SENDGRID_API_KEY: z.string().optional(),
   SENDGRID_EMAIL_FROM: z.string().email().optional(),

   // Interakt (WhatsApp)
   INTERAKT_API_KEY: z.string().optional(),

   // Exotel (SMS)
   EXOTEL_SID: z.string().optional(),
   EXOTEL_API_KEY: z.string().optional(),
   EXOTEL_API_TOKEN: z.string().optional(),
   EXOTEL_SUBDOMAIN: z.string().default('api.exotel.com').optional(),
   EXOTEL_SENDER_ID: z.string().default('ROZX').optional(),

   // Google
   GOOGLE_CLIENT_ID: z.string().optional(),

   // Database & Redis
   DATABASE_URL: z.string().optional(),
   REDIS_URL: z.string().optional(),
   USE_REDIS: booleanString(false),
   // Upstash Redis (for serverless/edge-compatible rate limiting)
   UPSTASH_REDIS_REST_URL: z.string().url().optional(),
   UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

   // Sentry (Error Tracking)
   SENTRY_DSN: z.string().url().optional(),



   // Webhook Security
   WEBHOOK_API_KEY: z.string().min(32).optional(), // At least 32 characters for security

   /* =========================
      Video Providers
   ========================== */
   // Active provider: 'agora' | 'zegocloud' (can also be switched via DB)
   VIDEO_PROVIDER: z.enum(['agora', 'zegocloud']).default('agora').optional(),

   // Agora (Video)
   AGORA_APP_ID: z.string().optional(),
   AGORA_APP_CERTIFICATE: z.string().optional(),

   // ZegoCloud (Video)
   ZEGOCLOUD_APP_ID: numericString(0).optional(),
   ZEGOCLOUD_APP_SIGN: z.string().optional(), // Legacy name
   ZEGOCLOUD_SERVER_SECRET: z.string().optional(), // Preferred name
})

/* ------------------------------------------------------------------
 Parse & Validate
------------------------------------------------------------------- */

const parseEnv = () => {
   const result = envSchema.safeParse(process.env);

   if (!result.success) {
      console.error('\nENVIRONMENT VALIDATION FAILED:\n');
      result.error.issues.forEach((e) => {
         console.error(`- ${e.path.join('.')}: ${e.message}`);
      });

      if (process.env.NODE_ENV === 'production') {
         console.error('\nWARNING: Starting in production with invalid env. Using partial data and defaults.\n');
         // Use the data that did pass validation, and for failed fields,
         // Zod doesn't provide them in .data if they failed.
         // We'll return the raw process.env as a last resort, but cast to Env
         // IMPORTANT: In production, we try to keep the app alive.
         return {
            ...process.env,
            // Core overrides to ensure app starts
            NODE_ENV: 'production',
            PORT: Number(process.env.PORT) || 5000,
         } as unknown as Env;
      }

      process.exit(1);
   }

   return result.data;
}

export const env = parseEnv()

/* ------------------------------------------------------------------
 Types
------------------------------------------------------------------- */

export type Env = z.infer<typeof envSchema>

/* ------------------------------------------------------------------
 Environment Helpers
------------------------------------------------------------------- */

export const isDevelopment = env.NODE_ENV === 'development'
export const isProduction = env.NODE_ENV === 'production'
export const isTest = env.NODE_ENV === 'test'

/* ------------------------------------------------------------------
 Feature Flags
------------------------------------------------------------------- */

export const features = {
   redis: env.USE_REDIS && !!env.REDIS_URL,
   upstashRedis: !!env.UPSTASH_REDIS_REST_URL && !!env.UPSTASH_REDIS_REST_TOKEN,
   sentry: !!env.SENTRY_DSN,
   whatsapp:
      !!env.INTERAKT_API_KEY ||
      (!!env.WHATSAPP_ACCESS_TOKEN && !!env.WHATSAPP_PHONE_NUMBER_ID) ||
      (!!env.GUPSHUP_API_KEY && !!env.GUPSHUP_SOURCE),
   email: !!env.SENDGRID_API_KEY && !!env.SENDGRID_EMAIL_FROM,
   sms: !!env.EXOTEL_SID && !!env.EXOTEL_API_KEY && !!env.EXOTEL_API_TOKEN,
   video:
      !!env.AGORA_APP_ID && !!env.AGORA_APP_CERTIFICATE,
}

