import { z } from 'zod';

/**
 * Common Zod validators for the healthcare platform
 */

// =============================================================================
// Basic Type Validators
// =============================================================================

/**
 * UUID validator
 */
export const uuidSchema = z.string().uuid('Invalid UUID format');

/**
 * Indian phone number validator
 * Accepts: +91XXXXXXXXXX or XXXXXXXXXX (10 digits)
 */
export const phoneSchema = z
  .string()
  .transform((val) => val.replace(/\s+/g, '').replace(/^0+/, ''))
  .refine(
    (val) => {
      const cleaned = val.replace(/^\+91/, '');
      return /^[6-9]\d{9}$/.test(cleaned);
    },
    { message: 'Invalid Indian phone number' }
  )
  .transform((val) => {
    const cleaned = val.replace(/^\+91/, '');
    return `+91${cleaned}`;
  });

/**
 * Email validator
 */
export const emailSchema = z.string().email('Invalid email address').toLowerCase();

/**
 * Password validator (min 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special)
 */
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/\d/, 'Password must contain at least one number')
  .regex(/[!@#$%^&*(),.?":{}|<>]/, 'Password must contain at least one special character');

/**
 * Simple password (for development/testing)
 */
export const simplePasswordSchema = z.string().min(6, 'Password must be at least 6 characters');

/**
 * OTP validator (6 digits)
 */
export const otpSchema = z.string().regex(/^\d{6}$/, 'OTP must be 6 digits');

/**
 * Indian Pincode validator
 */
export const pincodeSchema = z.string().regex(/^[1-9][0-9]{5}$/, 'Invalid pincode');

/**
 * Date string validator (YYYY-MM-DD)
 */
export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
  .refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid date' });

/**
 * Time string validator (HH:MM)
 */
export const timeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Time must be in HH:MM format (24-hour)');

/**
 * Positive number validator
 */
export const positiveNumberSchema = z.number().positive('Must be a positive number');

/**
 * Non-negative number validator
 */
export const nonNegativeNumberSchema = z.number().min(0, 'Cannot be negative');

/**
 * Percentage validator (0-100)
 */
export const percentageSchema = z.number().min(0).max(100, 'Percentage must be between 0 and 100');

/**
 * Price/Amount validator (positive decimal with 2 places)
 */
export const priceSchema = z
  .number()
  .positive('Amount must be positive')
  .transform((val) => Math.round(val * 100) / 100);

// =============================================================================
// Complex Validators
// =============================================================================

/**
 * Coordinates validator
 */
export const coordinatesSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

/**
 * Address validator
 */
export const addressSchema = z.object({
  addressLine1: z.string().min(1).max(255),
  addressLine2: z.string().max(255).optional(),
  city: z.string().min(1).max(100),
  state: z.string().min(1).max(100),
  pincode: pincodeSchema,
  country: z.string().default('India'),
});

/**
 * Pagination query validator
 */
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

/**
 * Search query validator
 */
export const searchSchema = z.object({
  q: z.string().min(1).max(100).optional(),
  ...paginationSchema.shape,
});

// =============================================================================
// Medical/Healthcare Validators
// =============================================================================

/**
 * Medical Council Registration Number validator
 */
export const medicalRegistrationSchema = z
  .string()
  .min(5, 'Invalid registration number')
  .max(50)
  .regex(/^[A-Z0-9/-]+$/i, 'Invalid registration number format');

/**
 * Experience years validator
 */
export const experienceYearsSchema = z.number().int().min(0).max(70);

/**
 * Consultation fee validator (in INR)
 */
export const consultationFeeSchema = z.number().min(0).max(50000);

/**
 * Slot duration validator (in minutes)
 */
export const slotDurationSchema = z.number().int().min(5).max(120);

/**
 * Age validator
 */
export const ageSchema = z.number().int().min(0).max(150);

/**
 * Blood pressure validator
 */
export const bloodPressureSchema = z.object({
  systolic: z.number().int().min(50).max(300),
  diastolic: z.number().int().min(30).max(200),
});

/**
 * Temperature validator (Celsius)
 */
export const temperatureSchema = z.number().min(30).max(45);

/**
 * GSTIN validator (Indian GST Number)
 */
export const gstinSchema = z
  .string()
  .regex(
    /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
    'Invalid GSTIN format'
  );

// =============================================================================
// Enum Validators (based on database enums)
// =============================================================================

export const userRoleSchema = z.enum(['patient', 'doctor', 'hospital', 'admin']);
export const userStatusSchema = z.enum(['active', 'inactive', 'suspended', 'pending_verification']);
export const genderSchema = z.enum(['male', 'female', 'other']);
export const hospitalTierSchema = z.enum(['standard', 'premium', 'enterprise']);
export const verificationStatusSchema = z.enum(['pending', 'verified', 'rejected', 'under_review']);
export const doctorStatusSchema = z.enum(['active', 'on_leave', 'inactive']);
export const consultationTypeSchema = z.enum(['online', 'in_person', 'both']);
export const dayOfWeekSchema = z.enum(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']);
export const payoutModelSchema = z.enum(['fixed_per_consultation', 'percentage', 'monthly_retainer', 'custom']);
export const paymentFrequencySchema = z.enum(['daily', 'weekly', 'monthly']);

export const appointmentStatusSchema = z.enum([
  'pending_payment',
  'confirmed',
  'in_waiting_room',
  'in_progress',
  'completed',
  'cancelled_by_patient',
  'cancelled_by_doctor',
  'cancelled_by_hospital',
  'no_show',
  'rescheduled',
]);

export const paymentStatusSchema = z.enum([
  'pending',
  'processing',
  'success',
  'failed',
  'refunded',
  'partially_refunded',
]);

export const paymentMethodSchema = z.enum(['upi', 'card', 'net_banking', 'wallet', 'cash']);
export const paymentGatewaySchema = z.enum(['razorpay', 'cashfree']);
export const transactionTypeSchema = z.enum(['consultation', 'subscription', 'refund', 'settlement']);
export const notificationTypeSchema = z.enum(['whatsapp', 'sms', 'email', 'push']);
export const notificationStatusSchema = z.enum(['pending', 'sent', 'delivered', 'failed', 'read']);
export const documentTypeSchema = z.enum(['prescription', 'lab_report', 'imaging', 'medical_certificate', 'other']);
export const bookingSourceSchema = z.enum(['web', 'mobile', 'whatsapp', 'reception']);

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Create an optional version of a schema
 */
export const optional = <T extends z.ZodTypeAny>(schema: T) => schema.optional();

/**
 * Create a nullable version of a schema
 */
export const nullable = <T extends z.ZodTypeAny>(schema: T) => schema.nullable();

/**
 * Validate and throw on error
 */
export const validate = <T extends z.ZodTypeAny>(
  schema: T,
  data: unknown
): z.infer<T> => {
  return schema.parse(data);
};

/**
 * Validate and return result (no throw)
 */
export const validateSafe = <T extends z.ZodTypeAny>(
  schema: T,
  data: unknown
): { success: true; data: z.infer<T> } | { success: false; errors: z.ZodError } => {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error };
};

/**
 * Format Zod errors to a user-friendly array
 */
export const formatZodErrors = (
  error: z.ZodError
): Array<{ field: string; message: string }> => {
  const issues = (error as any).issues || (error as any).errors || [];
  return issues.map((err: any) => ({
    field: err.path?.join('.') || '',
    message: err.message,
  }));
};
