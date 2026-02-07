import { z } from 'zod';

export const paginationSchema = z.object({
    page: z.string().optional().transform((v) => Math.max(1, parseInt(v || '1'))),
    limit: z.string().optional().transform((v) => Math.min(100, Math.max(1, parseInt(v || '20')))),
    sortBy: z.string().optional().default('created_at'),
    sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export type PaginationQuery = z.infer<typeof paginationSchema>;
