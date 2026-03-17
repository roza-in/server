import { supabaseAdmin } from '../database/supabase-admin.js';
import { logger } from '../config/logger.js';
import { env } from '../config/env.js';

interface SettlementBatch {
    hospitalId: string;
    grossAmount: number;
    commissionTotal: number;
    netPayable: number;
    periodStart: string;
    periodEnd: string;
    lineItems: Array<{
        transaction_type: string;
        transaction_id: string;
        transaction_date: string;
        gross_amount: number;
        commission_amount: number;
        net_amount: number;
        description: string;
    }>;
}

/**
 * Generate settlements for completed appointments — BATCH optimized
 * Groups by hospital, inserts all settlements in one batch, then all line items in one batch.
 * P2: Uses cursor-based pagination to process ALL pending appointments, not just the first 500.
 */
export const generateSettlements = async () => {
    const log = logger.child('Job:Settlements');
    const BATCH_SIZE = 500;
    let totalProcessed = 0;
    let cursor: string | null = null; // last processed appointment ID for cursor pagination

    try {
        log.info('Starting settlement generation...');

        // P2: Loop through all pending appointments in cursor-based batches
        while (true) {
            // 1. Fetch next batch of completed appointments
            let query = supabaseAdmin
                .from('appointments')
                .select('id, doctor_id, hospital_id, consultation_type, consultation_fee, platform_fee, total_amount, scheduled_date')
                .eq('status', 'completed')
                .order('id', { ascending: true })
                .limit(BATCH_SIZE);

            if (cursor) {
                query = query.gt('id', cursor);
            }

            const { data: completed, error } = await query;

            if (error) throw error;
            if (!completed || completed.length === 0) break;

            // Update cursor for next iteration
            cursor = completed[completed.length - 1].id;

            // 2. Batch-filter already settled appointments (single query)
            const apptIds = completed.map(a => a.id);
            const { data: existingLines } = await supabaseAdmin
                .from('settlement_line_items')
                .select('transaction_id')
                .eq('transaction_type', 'appointment')
                .in('transaction_id', apptIds);

            const settledIds = new Set(existingLines?.map(l => l.transaction_id));
            const pendingAppointments = completed.filter(a => !settledIds.has(a.id));

            if (pendingAppointments.length === 0) {
                // All in this batch already settled — continue to next batch
                if (completed.length < BATCH_SIZE) break;
                continue;
            }

            // 3. Group by hospital
            const byHospital: Record<string, typeof pendingAppointments> = {};
            for (const appt of pendingAppointments) {
                const key = appt.hospital_id;
                if (!key) continue;
                if (!byHospital[key]) byHospital[key] = [];
                byHospital[key].push(appt);
            }

            // Platform fee rates from env config
            const feeRates: Record<string, number> = {
                video: env.PLATFORM_FEE_ONLINE_PERCENT || 7,
                online: env.PLATFORM_FEE_ONLINE_PERCENT || 7,
                in_person: env.PLATFORM_FEE_IN_PERSON_PERCENT || 4,
                walk_in: env.PLATFORM_FEE_WALKIN_PERCENT || 2,
                follow_up: env.PLATFORM_FEE_FOLLOWUP_PERCENT || 3,
            };
            const defaultFeeRate = env.PLATFORM_FEE_ONLINE_PERCENT || 7;

            // 4. Build all settlement batches in-memory (no DB calls yet)
            const batches: SettlementBatch[] = [];

            for (const [hospitalId, appts] of Object.entries(byHospital)) {
                let grossAmount = 0;
                let commissionTotal = 0;
                const lineItems: SettlementBatch['lineItems'] = [];

                for (const appt of appts) {
                    const paymentAmount = Number(appt.total_amount) || 0;
                    if (paymentAmount <= 0) continue;

                    const feePercent = feeRates[appt.consultation_type] ?? defaultFeeRate;
                    const commission = Math.round((paymentAmount * feePercent) / 100 * 100) / 100;
                    const netAmount = Math.round((paymentAmount - commission) * 100) / 100;

                    grossAmount += paymentAmount;
                    commissionTotal += commission;

                    lineItems.push({
                        transaction_type: 'appointment',
                        transaction_id: appt.id,
                        transaction_date: appt.scheduled_date,
                        gross_amount: paymentAmount,
                        commission_amount: commission,
                        net_amount: netAmount,
                        description: `Appointment ${appt.consultation_type} consultation`,
                    });
                }

                if (lineItems.length === 0) continue;

                const dates = appts.map(a => a.scheduled_date).sort();
                batches.push({
                    hospitalId,
                    grossAmount,
                    commissionTotal,
                    netPayable: Math.round((grossAmount - commissionTotal) * 100) / 100,
                    periodStart: dates[0],
                    periodEnd: dates[dates.length - 1],
                    lineItems,
                });
            }

            if (batches.length === 0) {
                if (completed.length < BATCH_SIZE) break;
                continue;
            }

            // 5. BATCH INSERT all settlements in one DB call
            const settlementRows = batches.map(b => ({
                entity_type: 'hospital' as const,
                entity_id: b.hospitalId,
                period_start: b.periodStart,
                period_end: b.periodEnd,
                gross_amount: b.grossAmount,
                commission_amount: b.commissionTotal,
                net_payable: b.netPayable,
                status: 'pending' as const,
            }));

            const { data: settlements, error: sErr } = await supabaseAdmin
                .from('settlements')
                .insert(settlementRows)
                .select('id, entity_id');

            if (sErr || !settlements) {
                log.error('Failed to batch-insert settlements', sErr);
                break; // Stop processing on DB error
            }

            // 6. Map settlement IDs back to batches, build all line items
            const settlementIdMap = new Map<string, string>();
            for (const s of settlements) {
                settlementIdMap.set(s.entity_id, s.id);
            }

            const allLineItems: Array<SettlementBatch['lineItems'][number] & { settlement_id: string }> = [];
            for (const batch of batches) {
                const settlementId = settlementIdMap.get(batch.hospitalId);
                if (!settlementId) {
                    log.warn(`No settlement ID found for hospital ${batch.hospitalId}, skipping line items`);
                    continue;
                }
                for (const line of batch.lineItems) {
                    allLineItems.push({ ...line, settlement_id: settlementId });
                }
            }

            // 7. BATCH INSERT all line items in one DB call
            if (allLineItems.length > 0) {
                const { error: lErr } = await supabaseAdmin
                    .from('settlement_line_items')
                    .insert(allLineItems);

                if (lErr) {
                    log.error('Failed to batch-insert settlement line items, rolling back settlements', lErr);
                    const settIds = settlements.map(s => s.id);
                    await supabaseAdmin.from('settlements').delete().in('id', settIds);
                    break; // Stop processing on DB error
                } else {
                    totalProcessed += allLineItems.length;
                    log.info(`Batch-generated ${settlements.length} settlements with ${allLineItems.length} line items`);
                }
            }

            // If we got fewer than BATCH_SIZE, there are no more to process
            if (completed.length < BATCH_SIZE) break;
        }

        log.info(`Settlement job completed. Total line items processed: ${totalProcessed}`);
    } catch (error) {
        log.error('Failed to run settlement job:', error);
    }
};
