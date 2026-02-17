import { supabaseAdmin } from '../database/supabase-admin.js';
import { logger } from './logger.js';
import { Request } from 'express';

const log = logger.child('AuditService');

/**
 * Audit Action Types - Must match audit_action enum in migration 001
 */
export type AuditAction =
    | 'create'
    | 'read'
    | 'update'
    | 'delete'
    | 'login'
    | 'logout'
    | 'payment'
    | 'refund'
    | 'status_change'
    | 'verification'
    | 'payout'
    | 'settlement'
    | 'dispute';

/**
 * Entity Types for audit context
 */
export type AuditEntityType =
    | 'user'
    | 'patient'
    | 'doctor'
    | 'hospital'
    | 'appointment'
    | 'payment'
    | 'refund'
    | 'prescription'
    | 'health_record'
    | 'session'
    | 'config';

/**
 * Audit Log Entry Input
 */
export interface AuditLogInput {
    userId?: string;
    userRole?: string;
    action: AuditAction | string;
    description?: string;
    entityType?: AuditEntityType | string;
    entityId?: string;
    changes?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    accessedPhi?: boolean;
    phiFields?: string[];
    ipAddress?: string;
    userAgent?: string;
    correlationId?: string;
}

/**
 * Sensitive field patterns to redact in audit logs
 */
const SENSITIVE_PATTERNS = [
    'password',
    'token',
    'secret',
    'otp',
    'pin',
    'ssn',
    'credit_card',
    'card_number',
    'cvv',
    'authorization',
];

/**
 * Redact sensitive fields from an object
 */
const redactSensitiveData = (data: Record<string, unknown> | undefined): Record<string, unknown> | undefined => {
    if (!data) return undefined;

    const redacted: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
        const lowerKey = key.toLowerCase();
        const isSensitive = SENSITIVE_PATTERNS.some(pattern => lowerKey.includes(pattern));

        if (isSensitive) {
            redacted[key] = '[REDACTED]';
        } else if (typeof value === 'object' && value !== null) {
            redacted[key] = redactSensitiveData(value as Record<string, unknown>);
        } else {
            redacted[key] = value;
        }
    }
    return redacted;
};

/**
 * Audit Service - Log sensitive operations for compliance and security
 */
export const auditService = {
    /**
     * Log an audit event
     */
    async log(input: AuditLogInput, req?: Request): Promise<void> {
        try {
            // Extract request context if available
            const ipAddress = input.ipAddress || req?.ip || req?.socket?.remoteAddress;
            const userAgent = input.userAgent || req?.headers['user-agent'];
            const correlationId = input.correlationId || req?.requestId;

            // Redact sensitive data
            const safeChanges = redactSensitiveData(input.changes);
            const safeMetadata = redactSensitiveData(input.metadata);

            // Insert audit log — columns match migration 008
            const { error } = await supabaseAdmin.from('audit_logs').insert({
                user_id: input.userId || null,
                user_role: input.userRole || null,
                action: input.action,
                description: input.description || null,
                entity_type: input.entityType || null,
                entity_id: input.entityId || null,
                changes: safeChanges || null,
                metadata: safeMetadata || null,
                ip_address: ipAddress || null,
                user_agent: userAgent || null,
                correlation_id: correlationId || null,
                accessed_phi: input.accessedPhi || false,
                phi_fields: input.phiFields || null,
            });

            if (error) {
                log.error('Failed to write audit log', { error, action: input.action });
            } else {
                log.debug(`Audit: ${input.action}`, { entityType: input.entityType, entityId: input.entityId });
            }
        } catch (error) {
            // Never throw from audit logging - should not break the main operation
            log.error('Audit logging failed', error);
        }
    },

    /**
     * Log from request context (shorthand)
     */
    async logFromRequest(
        req: Request,
        action: AuditAction | string,
        options: Omit<AuditLogInput, 'action' | 'userId' | 'userRole' | 'ipAddress' | 'userAgent' | 'correlationId'> = {}
    ): Promise<void> {
        // Get user from request if authenticated
        const user = (req as any).user;

        return this.log({
            ...options,
            action,
            userId: user?.userId,
            userRole: user?.role,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            correlationId: req.requestId,
        });
    },

    /**
     * Query audit logs (for admin)
     */
    async query(filters: {
        userId?: string;
        action?: string;
        entityType?: string;
        entityId?: string;
        dateFrom?: string;
        dateTo?: string;
        limit?: number;
        offset?: number;
    }) {
        let query = supabaseAdmin
            .from('audit_logs')
            .select('*', { count: 'exact' })
            .order('created_at', { ascending: false });

        if (filters.userId) query = query.eq('user_id', filters.userId);
        if (filters.action) query = query.eq('action', filters.action);
        if (filters.entityType) query = query.eq('entity_type', filters.entityType);
        if (filters.entityId) query = query.eq('entity_id', filters.entityId);
        if (filters.dateFrom) query = query.gte('created_at', filters.dateFrom);
        if (filters.dateTo) query = query.lte('created_at', filters.dateTo);

        query = query.limit(filters.limit || 50).range(
            filters.offset || 0,
            (filters.offset || 0) + (filters.limit || 50) - 1
        );

        const { data, error, count } = await query;

        if (error) {
            log.error('Failed to query audit logs', error);
            throw error;
        }

        return { data, total: count };
    },
};

// Export convenience functions
export const logAudit = auditService.log.bind(auditService);
export const logAuditFromRequest = auditService.logFromRequest.bind(auditService);
