import { z } from 'zod'
import dotenv from 'dotenv'
import path from 'path'

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') })

/* ------------------------------------------------------------------
 Helpers
------------------------------------------------------------------- */

const numericString = (defaultVal: number) =>
  z
    .string()
    .optional()
    .default(String(defaultVal))
    .transform((v) => Number(v))

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
  APP_NAME: z.string().default('ROZX Healthcare Platform'),

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
  JWT_ISSUER: z.string().default('rozx.health'),

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

  GST_RATE_PERCENT: numericString(18),

  /* =========================
     Razorpay
  ========================== */
  RAZORPAY_KEY_ID: z.string().min(1),
  RAZORPAY_KEY_SECRET: z.string().min(1),

  /* =========================
     WhatsApp Business API
  ========================== */
  WHATSAPP_API_VERSION: z.string().default('v18.0'),
  WHATSAPP_PHONE_NUMBER_ID: z.string().min(1),
  WHATSAPP_ACCESS_TOKEN: z.string().min(10),
  WHATSAPP_VERIFY_TOKEN: z.string().min(6),
  // Optional overrides
  WHATSAPP_LANGUAGE_CODE: z.string().optional(),
  WHATSAPP_TEMPLATE_OTP_LOGIN: z.string().optional(),
  WHATSAPP_TEMPLATE_OTP_REGISTRATION: z.string().optional(),

  /* =========================
     MSG91 SMS Service
  ========================== */
  MSG91_AUTH_KEY: z.string().min(1),
  MSG91_SENDER_ID: z.string().min(1),
  MSG91_ROUTE: z.string().default('4'),
  MSG91_DLT_TEMPLATE_ID: z.string().optional(),

  /* =========================
     SendGrid Email Service
  ========================== */
  SENDGRID_API_KEY: z.string().min(1),
  SENDGRID_EMAIL_FROM: z.string().email(),

  /* =========================
     Optional / Future
  ========================== */
  GOOGLE_CLIENT_ID: z.string().optional(),
  DATABASE_URL: z.string().optional(),
  REDIS_URL: z.string().optional(),
  USE_REDIS: booleanString(false),

  AGORA_APP_ID: z.string().optional(),
  AGORA_APP_CERTIFICATE: z.string().optional(),
})

/* ------------------------------------------------------------------
 Parse & Validate
------------------------------------------------------------------- */

const parseEnv = () => {
  try {
    return envSchema.parse(process.env)
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('\nEnvironment validation failed:\n')
      error.issues.forEach((e) => {
        console.error(`- ${e.path.join('.')}: ${e.message}`)
      })
      console.error('\nFix the above variables in your .env file\n')
      process.exit(1)
    }
    throw error
  }
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
  whatsapp:
    !!env.WHATSAPP_ACCESS_TOKEN && !!env.WHATSAPP_PHONE_NUMBER_ID,
  video:
    !!env.AGORA_APP_ID && !!env.AGORA_APP_CERTIFICATE,
}
