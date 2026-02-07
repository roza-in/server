import { z } from 'zod';

/**
 * Reception Module Validators
 */

// Queue query params
export const queueQuerySchema = z.object({
    query: z.object({
        date: z.string().optional(), // YYYY-MM-DD format, defaults to today
        status: z.enum(['all', 'confirmed', 'checked_in', 'in_progress', 'completed', 'no_show', 'cancelled']).optional(),
        doctorId: z.string().uuid().optional(),
    }).optional(),
});

// Walk-in booking input
export const walkInBookingSchema = z.object({
    body: z.object({
        doctorId: z.string().uuid(),
        slotId: z.string().uuid().optional(),
        scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        scheduledStart: z.string(), // ISO timestamp
        patient: z.object({
            id: z.string().uuid().optional(),
            name: z.string().min(2).max(200),
            phone: z.string().min(10).max(15),
            email: z.string().email().optional(),
            dateOfBirth: z.string().optional(),
            gender: z.enum(['male', 'female', 'other']).optional(),
        }),
        consultationFee: z.number().min(0),
        paymentMethod: z.literal('cash'),
        notes: z.string().optional(),
    }),
});

// Check-in params
export const checkInSchema = z.object({
    params: z.object({
        appointmentId: z.string().uuid(),
    }),
});

// Check-in with payment schema
export const checkInWithPaymentSchema = z.object({
    params: z.object({
        appointmentId: z.string().uuid(),
    }),
    body: z.object({
        amount: z.number().min(0),
        method: z.enum(['cash', 'card']),
    }),
});

// No-show params
export const noShowSchema = z.object({
    params: z.object({
        appointmentId: z.string().uuid(),
    }),
    body: z.object({
        reason: z.string().optional(),
    }).optional(),
});

// Patient search
export const patientSearchSchema = z.object({
    query: z.object({
        q: z.string().min(2), // Search query
        limit: z.coerce.number().min(1).max(50).optional().default(20),
    }),
});

// Cash payment recording
export const cashPaymentSchema = z.object({
    body: z.object({
        appointmentId: z.string().uuid(),
        amount: z.number().min(0),
        receiptNumber: z.string().optional(),
    }),
});

// Register walk-in patient
export const registerPatientSchema = z.object({
    body: z.object({
        name: z.string().min(2).max(200),
        phone: z.string().min(10).max(15),
        email: z.string().email().optional(),
        dateOfBirth: z.string().optional(),
        gender: z.enum(['male', 'female', 'other']).optional(),
    }),
});

export type QueueQueryInput = z.infer<typeof queueQuerySchema>;
export type WalkInBookingInput = z.infer<typeof walkInBookingSchema>;
export type CheckInInput = z.infer<typeof checkInSchema>;
export type CheckInWithPaymentInput = z.infer<typeof checkInWithPaymentSchema>;
export type NoShowInput = z.infer<typeof noShowSchema>;
export type PatientSearchInput = z.infer<typeof patientSearchSchema>;
export type CashPaymentInput = z.infer<typeof cashPaymentSchema>;
export type RegisterPatientInput = z.infer<typeof registerPatientSchema>;
