import { z } from 'zod';

/**
 * Auth Validators - Production-ready validation schemas
 */

// ============================================================================
// Base Schemas
// ============================================================================

const phoneSchema = z.string()
  .regex(/^\+?[1-9]\d{9,14}$/, 'Invalid phone number format')
  .transform(val => val.startsWith('+') ? val : `+91${val}`);

const emailSchema = z.string().email('Invalid email address');

const otpSchema = z.string()
  .regex(/^\d{6}$/, 'OTP must be 6 digits');

const genderSchema = z.enum(['male', 'female', 'other']);

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format');

const otpPurposeSchema = z.enum(['registration', 'login', 'phone_verification', 'password_reset', 'email_verification', 'transaction']);

// Password schema (shared)
const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must not exceed 128 characters');

// ============================================================================
// OTP Schemas
// ============================================================================

export const sendOTPSchema = z.object({
  body: z.object({
    phone: phoneSchema.optional(),
    email: z.string().email('Invalid email address').optional(),
    purpose: otpPurposeSchema.default('login'),
  }).refine(
    (data) => data.phone || data.email,
    { message: 'Either phone or email is required' }
  ),
});

export const verifyOTPSchema = z.object({
  body: z.object({
    phone: phoneSchema.optional(),
    email: z.string().email('Invalid email address').optional(),
    otp: otpSchema,
    purpose: otpPurposeSchema.default('login'),
    // Optional: allow setting a password during OTP login
    password: passwordSchema,
  }).refine(
    (data) => data.phone || data.email,
    { message: 'Either phone or email is required' }
  ),
});

// ============================================================================
// Registration Schemas
// ============================================================================

export const registerPatientSchema = z.object({
  body: z.object({
    phone: phoneSchema,
    otp: otpSchema,
    fullName: z.string()
      .min(2, 'Name must be at least 2 characters')
      .max(255, 'Name must not exceed 255 characters')
      .trim(),
    email: emailSchema,
    password: passwordSchema,
    gender: genderSchema.optional(),
    dateOfBirth: dateSchema.optional(),
  }),
});

export const registerHospitalSchema = z.object({
  body: z.object({
    // Admin user details
    phone: phoneSchema,
    otp: otpSchema,
    fullName: z.string()
      .min(2, 'Name must be at least 2 characters')
      .max(255, 'Name must not exceed 255 characters')
      .trim(),
    email: emailSchema,
    password: passwordSchema.optional(),
    
    // Hospital details
    hospital: z.object({
      name: z.string()
        .min(2, 'Hospital name must be at least 2 characters')
        .max(255, 'Hospital name must not exceed 255 characters')
        .trim(),
      type: z.enum([
        // Client-supported types
        'multi_specialty',
        'single_specialty',
        'nursing_home',
        'clinic',
        'diagnostic_center',
        'medical_college',
        'primary_health',
        // Additional types accepted by server
        'super_specialty',
        'general',
        'dental_clinic',
        'eye_hospital',
        'maternity',
        'pediatric',
        'ayurvedic',
        'homeopathy'
      ]).optional(),
      registrationNumber: z.string()
        .min(5, 'Registration number must be at least 5 characters')
        .max(100, 'Registration number must not exceed 100 characters')
        .optional(),
      phone: phoneSchema,
      email: emailSchema.optional(),
      addressLine1: z.string()
        .min(5, 'Address must be at least 5 characters')
        .max(255, 'Address must not exceed 255 characters'),
      addressLine2: z.string()
        .max(255, 'Address line 2 must not exceed 255 characters')
        .optional(),
      city: z.string()
        .min(2, 'City must be at least 2 characters')
        .max(100, 'City must not exceed 100 characters'),
      state: z.string()
        .min(2, 'State must be at least 2 characters')
        .max(100, 'State must not exceed 100 characters'),
      pincode: z.string()
        .regex(/^[1-9][0-9]{5}$/, 'Invalid pincode format'),
      latitude: z.number()
        .min(-90, 'Latitude must be between -90 and 90')
        .max(90, 'Latitude must be between -90 and 90')
        .optional(),
      longitude: z.number()
        .min(-180, 'Longitude must be between -180 and 180')
        .max(180, 'Longitude must be between -180 and 180')
        .optional(),
      about: z.string()
        .max(2000, 'About section must not exceed 2000 characters')
        .optional(),
      specialties: z.array(z.string()).optional(),
      facilities: z.array(z.string()).optional(),
    }),
  }),
});

// ============================================================================
// Email/Password Login Schema
// ============================================================================

export const loginWithPasswordSchema = z.object({
  body: z.object({
    email: emailSchema,
    password: passwordSchema,
  }),
});

// ============================================================================
// Google OAuth Schema
// ============================================================================

export const googleOAuthSchema = z.object({
  body: z.object({
    idToken: z.string().min(1, 'ID token is required'),
    deviceInfo: z.any().optional(),
  }),
});

// ============================================================================
// Token Management Schemas
// ============================================================================

export const refreshTokenSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(1, 'Refresh token is required'),
  }),
});

// ============================================================================
// Profile Management Schemas
// ============================================================================

export const updateProfileSchema = z.object({
  body: z.object({
    fullName: z.string()
      .min(2, 'Name must be at least 2 characters')
      .max(255, 'Name must not exceed 255 characters')
      .trim()
      .optional(),
    email: emailSchema.optional().nullable(),
    gender: genderSchema.optional(),
    dateOfBirth: dateSchema.optional().nullable(),
    avatarUrl: z.string().url('Invalid avatar URL').optional().nullable(),
    bloodGroup: z.enum(['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-']).optional().nullable(),
    heightCm: z.number()
      .min(50, 'Height must be at least 50 cm')
      .max(300, 'Height must not exceed 300 cm')
      .optional().nullable(),
    weightKg: z.number()
      .min(10, 'Weight must be at least 10 kg')
      .max(500, 'Weight must not exceed 500 kg')
      .optional().nullable(),
    address: z.object({
      line1: z.string().max(255).optional(),
      line2: z.string().max(255).optional(),
      city: z.string().max(100).optional(),
      state: z.string().max(100).optional(),
      pincode: z.string().regex(/^[1-9][0-9]{5}$/).optional(),
      latitude: z.number().optional(),
      longitude: z.number().optional(),
    }).optional().nullable(),
    emergencyContact: z.object({
      name: z.string().max(255),
      phone: phoneSchema,
      relationship: z.string().max(50),
    }).optional().nullable(),
    allergies: z.array(z.string()).optional().nullable(),
    chronicConditions: z.array(z.string()).optional().nullable(),
    currentMedications: z.array(z.string()).optional().nullable(),
    preferredLanguage: z.string().max(10).default('en'),
    timezone: z.string().max(50).default('Asia/Kolkata'),
  }),
});

export const changePhoneSchema = z.object({
  body: z.object({
    newPhone: phoneSchema,
    otp: otpSchema,
  }),
});

export const changeEmailSchema = z.object({
  body: z.object({
    newEmail: emailSchema,
    otp: otpSchema.optional(), // Optional email OTP verification
  }),
});

// ============================================================================
// Password Management Schemas
// ============================================================================

export const setPasswordSchema = z.object({
  body: z.object({
    password: z.string()
      .min(8, 'Password must be at least 8 characters')
      .max(128, 'Password must not exceed 128 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number')
      .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
    confirmPassword: z.string(),
  }).refine(data => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  }),
});

export const resetPasswordSchema = z.object({
  body: z.object({
    phone: phoneSchema,
    otp: otpSchema,
    newPassword: z.string()
      .min(8, 'Password must be at least 8 characters')
      .max(128, 'Password must not exceed 128 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number')
      .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
    confirmPassword: z.string(),
  }).refine(data => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  }),
});

// ============================================================================
// Session Management Schemas
// ============================================================================

export const revokeSessionSchema = z.object({
  params: z.object({
    sessionId: z.string().uuid('Invalid session ID'),
  }),
});

// ============================================================================
// Type Exports
// ============================================================================

export type SendOTPInput = z.infer<typeof sendOTPSchema>['body'];
export type VerifyOTPInput = z.infer<typeof verifyOTPSchema>['body'];
export type RegisterPatientInput = z.infer<typeof registerPatientSchema>['body'];
export type RegisterHospitalInput = z.infer<typeof registerHospitalSchema>['body'];
export type LoginWithPasswordInput = z.infer<typeof loginWithPasswordSchema>['body'];
export type GoogleOAuthInput = z.infer<typeof googleOAuthSchema>['body'];
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>['body'];
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>['body'];
export type ChangePhoneInput = z.infer<typeof changePhoneSchema>['body'];
export type ChangeEmailInput = z.infer<typeof changeEmailSchema>['body'];
export type SetPasswordInput = z.infer<typeof setPasswordSchema>['body'];
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>['body'];
export type RevokeSessionInput = z.infer<typeof revokeSessionSchema>['params'];
