import { BaseRepository } from '../../common/repositories/base.repo.js';

export interface ScheduledReportRow {
    id: string;
    name: string;
    report_type: string;
    entity_type: string | null;
    entity_id: string | null;
    frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
    next_run_at: string;
    last_run_at: string | null;
    recipients: string[];
    created_by: string;
    report_config: any;
    output_format: 'pdf' | 'csv' | 'xlsx';
    is_active: boolean;
    last_report_url: string | null;
    created_at: string;
    updated_at: string;
}

/**
 * Scheduled Report Repository - Recurring report management
 */
export class ScheduledReportRepository extends BaseRepository<ScheduledReportRow> {
    constructor() {
        super('scheduled_reports');
    }

    /**
     * Find reports due for execution
     */
    async findDue(limit = 50): Promise<ScheduledReportRow[]> {
        const { data, error } = await this.getQuery()
            .select('*')
            .eq('is_active', true)
            .lte('next_run_at', new Date().toISOString())
            .order('next_run_at', { ascending: true })
            .limit(limit);

        if (error) throw error;
        return data || [];
    }

    /**
     * Find reports by entity (e.g., hospital)
     */
    async findByEntity(entityType: string, entityId: string) {
        const { data, error } = await this.getQuery()
            .select('*, creator:users!scheduled_reports_created_by_fkey(id, name)')
            .eq('entity_type', entityType)
            .eq('entity_id', entityId)
            .eq('is_active', true)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
    }

    /**
     * Update after successful execution
     */
    async markExecuted(id: string, reportUrl: string, nextRunAt: string) {
        return this.update(id, {
            last_run_at: new Date().toISOString(),
            last_report_url: reportUrl,
            next_run_at: nextRunAt,
        } as any);
    }

    /**
     * Deactivate a report
     */
    async deactivate(id: string) {
        return this.update(id, { is_active: false } as any);
    }
}

export const scheduledReportRepository = new ScheduledReportRepository();
