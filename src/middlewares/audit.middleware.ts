import { Request, Response, NextFunction } from 'express';
import { logAudit } from '../config/audit.js';
import type { AuditAction } from '../types/database.types.js';

/**
 * Audit middleware — logs user actions after successful responses.
 * Uses the centralized `logAudit` from config/audit.ts which writes
 * to the `audit_logs` table with the correct column schema.
 *
 * @param action - One of the AuditAction enum values
 */
export const auditMiddleware = (action: AuditAction) => {
    return async (req: Request, _res: Response, next: NextFunction) => {
        // Store audit action on request so it can be logged after response
        req.auditAction = action;

        const user = (req as any).user;
        const userId = user?.userId;

        if (userId) {
            // Fire-and-forget audit log after response is sent
            const originalEnd = _res.end;

            (_res as any).end = function (chunk: any, encoding: BufferEncoding, cb?: () => void) {
                const statusCode = _res.statusCode;

                if (statusCode < 400) {
                    logAudit({
                        userId,
                        userRole: user.role,
                        action,
                        entityType: req.baseUrl.split('/').pop() || 'unknown',
                        entityId: req.params.id || (req.body?.id as string),
                        description: `${action} via ${req.method} ${req.originalUrl}`,
                        ipAddress: req.ip,
                        userAgent: req.headers['user-agent'],
                        correlationId: req.requestId,
                    }).catch(() => { /* logged internally */ });
                }

                return originalEnd.call(this, chunk, encoding, cb);
            };
        }

        next();
    };
};
