// @ts-nocheck
import { z } from 'zod';
import { phoneSchema, emailSchema, uuidSchema } from '../../common/validators.js';

// ============================================================================
// User Validators
// ============================================================================

export const userRoleSchema = z.enum(['patient', 'doctor', 'hospital', 'admin']);
export const genderSchema = z.enum(['male', 'female', 'other']);
export const bloodGroupSchema = z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'unknown']);

export const addressSchema = z.object({
    address: z.string().max(255).optional(),
    landmark: z.string().max(255).optional(),
    city: z.string().max(100).optional(),
    state: z.string().max(100).optional(),
    pincode: z.string().max(10).optional(),
    country: z.string().max(50).optional().default('India'),
}).optional();

export const emergencyContactSchema = z.object({
    name: z.string().max(255).optional(),
    phone: phoneSchema.optional(),
    relationship: z.string().max(50).optional(),
}).optional();

// List users
export const listUsersSchema = z.object({
    query: z.object({
        search: z.string().max(255).optional(),
        role: userRoleSchema.optional(),
        isActive: z.enum(['true', 'false']).transform(v => v === 'true').optional(),
        isBlocked: z.enum(['true', 'false']).transform(v => v === 'true').optional(),
        page: z.string().regex(/^\d+$/).transform(Number).default('1'),
        limit: z.string().regex(/^\d+$/).transform(Number).default('20'),
        sortBy: z.enum(['name', 'email', 'created_at', 'last_login_at']).default('created_at'),
        sortOrder: z.enum(['asc', 'desc']).default('desc'),
    }),
});

// Get user by ID
export const getUserSchema = z.object({
    params: z.object({
        userId: uuidSchema,
    }),
});

// Update user
export const updateUserSchema = z.object({
    params: z.object({
        userId: uuidSchema,
    }),
    body: z.object({
        name: z.string().min(2).max(255).optional(),
        email: emailSchema.optional(),
        phone: phoneSchema.optional(),
        avatar_url: z.string().url().optional().nullable(),
        gender: genderSchema.optional(),
        date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        blood_group: bloodGroupSchema.optional(),
        address: addressSchema,
        emergency_contact: emergencyContactSchema,
        preferred_language: z.string().max(20).optional(),
        timezone: z.string().max(50).optional(),
    }),
});

// Block user
export const blockUserSchema = z.object({
    params: z.object({
        userId: uuidSchema,
    }),
    body: z.object({
        reason: z.string().min(5).max(500),
    }),
});

// Unblock user
export const unblockUserSchema = z.object({
    params: z.object({
        userId: uuidSchema,
    }),
});

// Export types
export type ListUsersInput = z.infer<typeof listUsersSchema>['query'];
export type GetUserInput = z.infer<typeof getUserSchema>['params'];
export type UpdateUserInput = z.infer<typeof updateUserSchema>['body'];
export type BlockUserInput = z.infer<typeof blockUserSchema>['body'];

