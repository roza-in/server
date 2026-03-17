import { z } from 'zod';

export const listSecurityLogsSchema = z.object({
    query: z.object({
        page: z.string().optional(),
        limit: z.string().optional(),
        search: z.string().optional(),
        userId: z.string().optional(),
        ipAddress: z.string().optional(),
        success: z.string().optional(),
        identifier: z.string().optional(),
        purpose: z.string().optional(),
        isUsed: z.string().optional(),
        isActive: z.string().optional(),
        status: z.string().optional(),
        provider: z.string().optional(),
    }),
});

export const revokeSessionSchema = z.object({
    params: z.object({
        id: z.string().uuid(),
    }),
});

export const revokeUserSessionsSchema = z.object({
    params: z.object({
        userId: z.string().uuid(),
    }),
});

export const retryWebhookSchema = z.object({
    params: z.object({
        id: z.string().uuid(),
    }),
});

export const createApiKeySchema = z.object({
    body: z.object({
        name: z.string().min(1),
        scopes: z.array(z.string()).default([]),
        rateLimit: z.number().int().positive().optional(),
        expiresAt: z.string().datetime().optional(),
    }),
});

export const revokeApiKeySchema = z.object({
    params: z.object({
        id: z.string().uuid(),
    }),
});
