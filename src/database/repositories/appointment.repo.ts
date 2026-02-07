import { BaseRepository } from '../../common/repositories/base.repo.js';
import type { Appointment } from '../../types/database.types.js';

export class AppointmentRepository extends BaseRepository<Appointment> {
    constructor() {
        super('appointments');
    }

    override async findById(id: string): Promise<any | null> {
        const { data, error } = await this.getQuery()
            .select(`
                *,
                hospitals(*),
                doctors(*, users!doctors_user_id_fkey(*), specializations(name)),
                patient:users!appointments_patient_id_fkey(*),
                family_member:family_members(*),
                payment:payments(*),
                consultation:consultations(*)
            `)
            .eq('id', id)
            .single();

        if (error) {
            if (error.code === 'PGRST116') return null;
            this.log.error(`Error finding appointment by ID: ${id}`, error);
            return null;
        }
        return data;
    }

    /**
     * Overridden findMany to handle custom date filters
     */
    override async findMany(filters: Record<string, any> = {}, page = 1, limit = 20): Promise<{ data: Appointment[]; total: number }> {
        const offset = (page - 1) * limit;
        let query = this.getQuery().select(`
            *,
            hospitals(name, address, city, state),
            doctors(
                users!doctors_user_id_fkey(name, avatar_url),
                specializations(name)
            )
        `, { count: 'exact' });

        // Clone filters to avoid side effects
        const filterParams = { ...filters };

        // Handle date ranges (not direct columns)
        if (filterParams.date_from) {
            query = query.gte('scheduled_date', filterParams.date_from);
            delete filterParams.date_from;
        }

        if (filterParams.date_to) {
            query = query.lte('scheduled_date', filterParams.date_to);
            delete filterParams.date_to;
        }

        if (filterParams.startDate) {
            query = query.gte('scheduled_date', filterParams.startDate);
            delete filterParams.startDate;
        }

        if (filterParams.endDate) {
            query = query.lte('scheduled_date', filterParams.endDate);
            delete filterParams.endDate;
        }

        // Keys that should NOT be treated as column equality filters
        const excludedKeys = [
            'page', 'limit', 'sort_by', 'sort_order', 'sortBy', 'sortOrder',
            'search', 'searchQuery', 'q', 'consultation_type', 'min_experience',
            'max_fee', 'min_fee', 'min_rating', 'max_rating'
        ];

        // Map camelCase filter keys to snake_case column names
        const columnMap: Record<string, string> = {
            'doctorId': 'doctor_id',
            'patientId': 'patient_id',
            'hospitalId': 'hospital_id',
            'familyMemberId': 'family_member_id',
            'slotId': 'slot_id',
            'consultationType': 'consultation_type',
            'scheduledDate': 'scheduled_date',
            'paymentStatus': 'payment_status',
            'bookingId': 'appointment_number',
            'appointmentNumber': 'appointment_number',
        };

        // Apply remaining filters
        for (const [key, value] of Object.entries(filterParams)) {
            if (value !== undefined && value !== null && !excludedKeys.includes(key)) {
                // Convert camelCase to snake_case if mapping exists
                const columnName = columnMap[key] || key;
                if (Array.isArray(value)) {
                    query = query.in(columnName, value);
                } else {
                    query = query.eq(columnName, value);
                }
            }
        }

        // Handle sorting
        const sortBy = filters.sort_by || filters.sortBy || 'scheduled_date';
        const sortOrder = filters.sort_order || filters.sortOrder || 'desc';

        if (sortBy) {
            const sortColumnMap: Record<string, string> = {
                'date': 'scheduled_date',
                'appointment_date': 'scheduled_date',
                'appointmentDate': 'scheduled_date',
                'created_at': 'created_at',
                'status': 'status'
            };
            const column = sortColumnMap[sortBy] || sortBy;
            query = query.order(column, { ascending: sortOrder === 'asc' });
        }

        const { data, error, count } = await query.range(offset, offset + limit - 1);

        if (error) {
            this.log.error('Error in findMany appointments:', error);
            throw error;
        }

        return { data: data as Appointment[], total: count || 0 };
    }

    async findByPatientId(patientId: string, from: number, to: number) {
        const { data, error, count } = await this.getQuery()
            .select('*, hospitals(name), doctors(users(name))', { count: 'exact' })
            .eq('patient_id', patientId)
            .order('scheduled_date', { ascending: false })
            .range(from, to);

        if (error) throw error;
        return { data, count };
    }

    async findByIdWithRelations(id: string): Promise<any | null> {
        return this.findById(id);
    }

    /**
     * Check if a slot is booked (non-blocking check)
     */
    async isSlotBooked(doctorId: string, date: string, startTime: string): Promise<boolean> {
        const { data, error } = await this.getQuery()
            .select('id')
            .eq('doctor_id', doctorId)
            .eq('doctor_id', doctorId)
            .eq('scheduled_date', date)
            .eq('scheduled_start', `${date}T${startTime}:00+05:30`)
            .in('status', ['pending_payment', 'confirmed', 'checked_in', 'in_progress', 'rescheduled'])
            .maybeSingle();

        if (error) {
            this.log.error(`Error checking slot availability: ${doctorId}, ${date}, ${startTime}`, error);
            return true; // Assume booked on error for safety
        }
        return !!data;
    }

    /**
     * Lock an appointment slot using database RPC for atomic locking
     * Returns true if lock was successful, false if slot is already locked/booked
     */
    async lockSlot(
        slotId: string,
        userId: string,
        lockDurationMinutes: number = 5
    ): Promise<boolean> {
        const { data, error } = await this.supabase.rpc('lock_appointment_slot', {
            p_slot_id: slotId,
            p_user_id: userId,
            p_lock_duration: lockDurationMinutes,
        });

        if (error) {
            this.log.error('Error locking slot', { error, slotId, userId });
            return false;
        }

        return data === true;
    }

    /**
     * Release a slot lock
     */
    async releaseSlotLock(slotId: string, userId: string): Promise<boolean> {
        const { error } = await this.supabase
            .from('appointment_slots')
            .update({
                locked_by: null,
                locked_until: null,
            })
            .eq('id', slotId)
            .eq('locked_by', userId);

        if (error) {
            this.log.error('Error releasing slot lock', { error, slotId, userId });
            return false;
        }

        return true;
    }

    /**
     * Check if a slot can be booked (considering locks)
     * Returns slot if available and not locked by another user
     */
    async checkSlotAvailability(
        doctorId: string,
        hospitalId: string, // Kept for compatibility but unused in slots table query
        date: string,
        startTime: string,
        consultationType: string,
        currentUserId?: string
    ): Promise<{ available: boolean; slotId?: string; reason?: string }> {
        // Check for existing confirmed appointments
        const { data: existingAppointment, error: appointmentError } = await this.getQuery()
            .select('id, status')
            .eq('doctor_id', doctorId)
            .eq('scheduled_date', date)
            .eq('scheduled_start', `${date}T${startTime}:00+05:30`)
            .in('status', ['confirmed', 'checked_in', 'in_progress', 'rescheduled'])
            .maybeSingle();

        if (appointmentError) {
            this.log.error('Error checking existing appointments', appointmentError);
            return { available: false, reason: 'Error checking availability' };
        }

        if (existingAppointment) {
            return { available: false, reason: 'Slot already booked' };
        }

        // Check for pending payment appointments (with timeout check)
        const { data: pendingAppointment, error: pendingError } = await this.getQuery()
            .select('id, status, created_at')
            .eq('doctor_id', doctorId)
            .eq('scheduled_date', date)
            .eq('scheduled_start', `${date}T${startTime}:00+05:30`)
            .eq('status', 'pending_payment')
            .maybeSingle();

        if (pendingError) {
            this.log.error('Error checking pending appointments', pendingError);
        }

        if (pendingAppointment) {
            // Check if pending appointment has timed out (30 minutes)
            const createdAt = new Date(pendingAppointment.created_at);
            const now = new Date();
            const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);

            if (createdAt > thirtyMinutesAgo) {
                return { available: false, reason: 'Slot is currently being booked' };
            }
            // If timed out, allow booking (the timeout job will clean it up)
        }

        // Check appointment_slots table for locks
        const { data: slot, error: slotError } = await this.supabase
            .from('appointment_slots')
            .select('id, locked_by, locked_until, current_bookings, max_bookings')
            .eq('doctor_id', doctorId)
            .eq('slot_date', date)
            .eq('start_time', `${date}T${startTime}:00+00:00`)
            .eq('consultation_type', consultationType)
            .maybeSingle();

        if (slotError && slotError.code !== 'PGRST116') {
            this.log.error('Error checking slot locks', slotError);
            return { available: false, reason: 'Error checking slot' };
        }

        if (slot) {
            // Check if slot is at capacity
            if (slot.current_bookings >= slot.max_bookings) {
                return { available: false, slotId: slot.id, reason: 'Slot at capacity' };
            }

            // Check if locked by another user
            if (slot.locked_by && slot.locked_by !== currentUserId) {
                const lockedUntil = new Date(slot.locked_until);
                if (lockedUntil > new Date()) {
                    return { available: false, slotId: slot.id, reason: 'Slot temporarily reserved' };
                }
            }

            return { available: true, slotId: slot.id };
        }

        // No slot record exists - it's available
        return { available: true };
    }

    /**
     * Atomically check and create appointment with slot lock
     * This combines the check and create in a single operation to prevent race conditions
     */
    async createWithLock(data: Partial<Appointment>): Promise<any> {
        const appointmentData = data as any;
        // First check availability with locking
        const availability = await this.checkSlotAvailability(
            appointmentData.doctor_id!,
            appointmentData.hospital_id!,
            appointmentData.scheduled_date as string,
            appointmentData.scheduled_start?.includes('T') ? appointmentData.scheduled_start.split('T')[1].substring(0, 5) : appointmentData.scheduled_start as string,
            appointmentData.consultation_type!,
            appointmentData.patient_id
        );

        if (!availability.available) {
            throw new Error(availability.reason || 'Slot not available');
        }

        // Create the appointment
        return this.create(data);
    }

    /**
     * Find appointments by doctor for a specific date
     */
    async findByDoctorAndDate(doctorId: string, date: string): Promise<any[]> {
        const { data, error } = await this.getQuery()
            .select('id, scheduled_start, scheduled_end, status, patient_id')
            .eq('doctor_id', doctorId)
            .eq('scheduled_date', date)
            .in('status', ['pending_payment', 'confirmed', 'checked_in', 'in_progress', 'rescheduled']);

        if (error) {
            this.log.error('Error finding appointments by doctor and date', error);
            return [];
        }

        return data || [];
    }

    /**
     * Expire pending appointments older than specified minutes
     * Returns IDs of expired appointments
     */
    async expirePendingAppointments(olderThanMinutes: number = 30): Promise<string[]> {
        const cutoffTime = new Date(Date.now() - olderThanMinutes * 60 * 1000).toISOString();

        const { data, error } = await this.getQuery()
            .update({ status: 'cancelled' })
            .eq('status', 'pending_payment')
            .lt('created_at', cutoffTime)
            .select('id');

        if (error) {
            this.log.error('Error expiring pending appointments', error);
            return [];
        }

        return data?.map((a: any) => a.id) || [];
    }

    /**
     * Check if patient already has a pending or confirmed appointment with the same doctor on the same day
     */
    async hasExistingAppointment(
        patientId: string,
        doctorId: string,
        date: string
    ): Promise<boolean> {
        const { data, error } = await this.getQuery()
            .select('id')
            .eq('patient_id', patientId)
            .eq('doctor_id', doctorId)
            .eq('scheduled_date', date)
            .in('status', ['pending_payment', 'confirmed', 'checked_in', 'in_progress'])
            .maybeSingle();

        if (error) {
            this.log.error('Error checking existing appointment', error);
            return false;
        }

        return !!data;
    }
}

export const appointmentRepository = new AppointmentRepository();
