import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../database/supabase-admin.js';
import { logger } from '../config/logger.js';

import { scrubSensitiveData } from '../common/utils/scrub-data.js';

export const auditMiddleware = (action: string) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        // We log after the response is sent or on error
        const userId = (req as any).user?.id;

        // Capture the original end method
        const originalEnd = res.end;

        (res as any).end = function (chunk: any, encoding: BufferEncoding, cb?: () => void) {
            const statusCode = res.statusCode;

            if (userId && statusCode < 400) {
                // Run audit logging after sending response (Fire and forget or handle properly)
                supabaseAdmin.from('audit_logs').insert({
                    user_id: userId,
                    action,
                    entity_type: req.baseUrl.split('/').pop(),
                    entity_id: req.params.id || (req.body?.id as string),
                    old_data: null,
                    new_data: scrubSensitiveData(req.body),
                    ip_address: req.ip,
                    user_agent: req.headers['user-agent'],
                    status: 'success'
                }).then(({ error }) => {
                    if (error) logger.error('Failed to write audit log', error);
                });
            }

            return originalEnd.call(this, chunk, encoding, cb);
        };

        next();
    };
};
