import { z } from 'zod';
import { phoneSchema, emailSchema, uuidSchema, pincodeSchema } from '../../common/validators.js';

// ============================================================================
// User Validators — aligned with DB schema
// ============================================================================

export const userRoleSchema = z.enum(['patient', 'reception', 'doctor', 'hospital', 'pharmacy', 'admin']);
export const genderSchema = z.enum(['male', 'female', 'other']);
export const bloodGroupSchema = z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'unknown']);

export const addressSchema = z.object({
    line1: z.string().max(255).optional(),
    line2: z.string().max(255).optional(),
    city: z.string().max(100).optional(),
    state: z.string().max(100).optional(),
    pincode: pincodeSchema.optional(),
    landmark: z.string().max(255).optional(),
    country: z.string().max(50).optional().default('India'),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
}).optional().nullable();

export const emergencyContactSchema = z.object({
    name: z.string().max(255),
    phone: phoneSchema,
    relationship: z.string().max(50),
}).optional().nullable();

// ============================================================================
// Query / Param Schemas
// ============================================================================

export const listUsersSchema = z.object({
    query: z.object({
        search: z.string().max(255).optional(),
        role: userRoleSchema.optional(),
        is_active: z.enum(['true', 'false']).transform(v => v === 'true').optional(),
        is_blocked: z.enum(['true', 'false']).transform(v => v === 'true').optional(),
        page: z.string().regex(/^\d+$/).default('1').transform(Number),
        limit: z.string().regex(/^\d+$/).default('20').transform(Number),
        sortBy: z.enum(['name', 'email', 'created_at', 'last_login_at']).default('created_at'),
        sortOrder: z.enum(['asc', 'desc']).default('desc'),
    }),
});

export const getUserSchema = z.object({
    params: z.object({
        userId: uuidSchema,
    }),
});

// ============================================================================
// Mutation Schemas
// ============================================================================

export const updateUserSchema = z.object({
    body: z.object({
        name: z.string().min(2).max(255).trim().optional(),
        email: emailSchema.optional().nullable(),
        phone: phoneSchema.optional(),
        avatar_url: z.string().url().optional().nullable(),
        cover_url: z.string().url().optional().nullable(),
        gender: genderSchema.optional().nullable(),
        date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD').optional().nullable(),
        blood_group: bloodGroupSchema.optional().nullable(),
        address: addressSchema,
        emergency_contact: emergencyContactSchema,
        allergies: z.array(z.string().max(100)).optional().nullable(),
        medical_conditions: z.array(z.string().max(100)).optional().nullable(),
    }),
});

export const updateMeSchema = z.object({
    body: z.object({
        name: z.string().min(2).max(255).trim().optional(),
        email: emailSchema.optional().nullable(),
        avatar_url: z.string().url().optional().nullable(),
        cover_url: z.string().url().optional().nullable(),
        gender: genderSchema.optional().nullable(),
        date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD').optional().nullable(),
        blood_group: bloodGroupSchema.optional().nullable(),
        address: addressSchema,
        emergency_contact: emergencyContactSchema,
        allergies: z.array(z.string().max(100)).optional().nullable(),
        medical_conditions: z.array(z.string().max(100)).optional().nullable(),
    }),
});

export const blockUserSchema = z.object({
    params: z.object({
        userId: uuidSchema,
    }),
    body: z.object({
        reason: z.string().min(5).max(500),
    }),
});

export const unblockUserSchema = z.object({
    params: z.object({
        userId: uuidSchema,
    }),
});

// ============================================================================
// Inferred Types
// ============================================================================

export type ListUsersInput = z.infer<typeof listUsersSchema>['query'];
export type GetUserInput = z.infer<typeof getUserSchema>['params'];
export type UpdateUserInput = z.infer<typeof updateUserSchema>['body'];
export type UpdateMeInput = z.infer<typeof updateMeSchema>['body'];
export type BlockUserInput = z.infer<typeof blockUserSchema>['body'];

