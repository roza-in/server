import { logger } from '../../config/logger.js';
import { supabaseAdmin } from '../../database/supabase-admin.js';
import { NotFoundError, BadRequestError, ForbiddenError } from '../../common/errors/index.js';
import { formatToIST } from '../../common/utils/date.js';
import type { QueueAppointment, QueueResponse, WalkInBookingInput, PatientSearchResult } from './reception.types.js';

interface PrescriptionResponse {
    consultation: any;
    prescription: any;
    appointment: any;
    doctor: any;
    patient: any;
    hospital: any;
}

interface PrescriptionResponse {
    consultation: any;
    prescription: any;
    appointment: any;
    doctor: any;
    patient: any;
    hospital: any;
}

/**
 * Reception Service - Business logic for reception desk operations
 */
class ReceptionService {
    private log = logger.child('ReceptionService');
    private supabase = supabaseAdmin;

    /**
     * Get today's appointment queue for the hospital
     */
    async getQueue(hospitalId: string, date?: string, statusFilter?: string, doctorId?: string): Promise<QueueResponse> {
        const targetDate = date || new Date().toISOString().split('T')[0];

        let query = this.supabase
            .from('appointments')
            .select(`
        id,
        appointment_number,
        walk_in_token,
        scheduled_start,
        scheduled_end,
        status,
        consultation_type,
        checked_in_at,
        consultation_fee,
        payment_collected_at,
        patient:patient_id (
          id,
          name,
          phone,
          avatar_url
        ),
        doctor:doctor_id (
          id,
          users:user_id (
            name
          ),
          specializations:specialization_id (
            name
          )
        )
      `)
            .eq('hospital_id', hospitalId)
            .gte('scheduled_start', `${targetDate}T00:00:00`)
            .lt('scheduled_start', `${targetDate}T23:59:59`)
            .order('scheduled_start', { ascending: true });

        if (statusFilter && statusFilter !== 'all') {
            query = query.eq('status', statusFilter);
        }

        if (doctorId) {
            query = query.eq('doctor_id', doctorId);
        }

        // Only show in-clinic consultations in reception queue
        // Online/video consultations don't need physical check-in
        query = query.neq('consultation_type', 'online');

        const { data: appointments, error } = await query;

        if (error) {
            this.log.error('Failed to fetch queue', { error, hospitalId });
            throw new BadRequestError('Failed to fetch queue');
        }

        // Calculate statistics
        const stats = {
            total: appointments?.length || 0,
            confirmed: 0,
            checkedIn: 0,
            inProgress: 0,
            completed: 0,
            noShow: 0,
            cancelled: 0,
        };

        const mapped: QueueAppointment[] = (appointments || []).map((apt: any) => {
            // Count statistics
            switch (apt.status) {
                case 'confirmed': stats.confirmed++; break;
                case 'checked_in': stats.checkedIn++; break;
                case 'in_progress': stats.inProgress++; break;
                case 'completed': stats.completed++; break;
                case 'no_show': stats.noShow++; break;
                case 'cancelled': stats.cancelled++; break;
            }

            return {
                id: apt.id,
                appointmentNumber: apt.appointment_number,
                walkInToken: apt.walk_in_token,
                patient: {
                    id: apt.patient?.id || '',
                    name: apt.patient?.name || 'Unknown',
                    phone: apt.patient?.phone || null,
                    avatarUrl: apt.patient?.avatar_url || null,
                },
                doctor: {
                    id: apt.doctor?.id || '',
                    name: apt.doctor?.users?.name || 'Unknown',
                    specialization: apt.doctor?.specializations?.name || 'General',
                },
                scheduledStart: apt.scheduled_start,
                scheduledEnd: apt.scheduled_end,
                status: apt.status,
                consultationType: apt.consultation_type,
                checkedInAt: apt.checked_in_at,
                consultationFee: apt.consultation_fee,
                paymentCollectedAt: apt.payment_collected_at,
            };
        });

        return { appointments: mapped, stats };
    }

    /**
     * Check in a patient for their appointment
     */
    async checkInAppointment(appointmentId: string, hospitalId: string, receptionUserId: string): Promise<QueueAppointment> {
        // First verify the appointment belongs to this hospital
        const { data: existing, error: fetchError } = await this.supabase
            .from('appointments')
            .select('id, hospital_id, status')
            .eq('id', appointmentId)
            .single();

        if (fetchError || !existing) {
            throw new NotFoundError('Appointment not found');
        }

        if (existing.hospital_id !== hospitalId) {
            throw new ForbiddenError('Appointment does not belong to your hospital');
        }

        if (existing.status !== 'confirmed' && existing.status !== 'rescheduled') {
            throw new BadRequestError(`Cannot check in appointment with status: ${existing.status}`);
        }

        // Update the appointment status
        const { data: updated, error: updateError } = await this.supabase
            .from('appointments')
            .update({
                status: 'checked_in',
                checked_in_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .eq('id', appointmentId)
            .select(`
        id,
        appointment_number,
        walk_in_token,
        scheduled_start,
        scheduled_end,
        status,
        consultation_type,
        checked_in_at,
        consultation_fee,
        payment_collected_at,
        patient:patient_id (
          id,
          name,
          phone,
          avatar_url
        ),
        doctor:doctor_id (
          id,
          users:user_id (
            name
          ),
          specializations:specialization_id (
            name
          )
        )
      `)
            .single();

        if (updateError || !updated) {
            this.log.error('Failed to check in appointment', { error: updateError, appointmentId });
            throw new BadRequestError('Failed to check in appointment');
        }

        return this.mapToQueueAppointment(updated);
    }

    /**
     * Check in an appointment that has pending payment - collect payment at reception
     */
    async checkInWithPayment(
        appointmentId: string,
        hospitalId: string,
        receptionUserId: string,
        paymentDetails: { amount: number; method: 'cash' | 'card' }
    ): Promise<{ appointment: QueueAppointment; payment: any }> {
        // Verify the appointment
        const { data: existing, error: fetchError } = await this.supabase
            .from('appointments')
            .select('id, hospital_id, status, patient_id, consultation_fee, total_amount')
            .eq('id', appointmentId)
            .single();

        if (fetchError || !existing) {
            throw new NotFoundError('Appointment not found');
        }

        if (existing.hospital_id !== hospitalId) {
            throw new ForbiddenError('Appointment does not belong to your hospital');
        }

        // Only allow for pending_payment status
        if (existing.status !== 'pending_payment') {
            throw new BadRequestError(`This method is for pending payment appointments. Current status: ${existing.status}`);
        }

        // Create payment record
        const { data: payment, error: paymentError } = await this.supabase
            .from('payments')
            .insert({
                appointment_id: appointmentId,
                payer_user_id: existing.patient_id,
                amount: paymentDetails.amount,
                payment_method: paymentDetails.method,
                payment_type: 'consultation',
                status: 'captured',
                currency: 'INR',
                cash_collected_by: receptionUserId,
                cash_collected_at: new Date().toISOString(),
                completed_at: new Date().toISOString(),
            })
            .select()
            .single();

        if (paymentError) {
            this.log.error('Failed to create payment record', { error: paymentError });
            throw new BadRequestError('Failed to record payment');
        }

        // Update appointment to checked_in and record payment
        const { data: updated, error: updateError } = await this.supabase
            .from('appointments')
            .update({
                status: 'checked_in',
                checked_in_at: new Date().toISOString(),
                payment_method: paymentDetails.method,
                payment_collected_by: receptionUserId,
                payment_collected_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .eq('id', appointmentId)
            .select(`
        id,
        appointment_number,
        walk_in_token,
        scheduled_start,
        scheduled_end,
        status,
        consultation_type,
        checked_in_at,
        consultation_fee,
        payment_collected_at,
        patient:patient_id (
          id,
          name,
          phone,
          avatar_url
        ),
        doctor:doctor_id (
          id,
          users:user_id (
            name
          ),
          specializations:specialization_id (
            name
          )
        )
      `)
            .single();

        if (updateError || !updated) {
            this.log.error('Failed to check in appointment', { error: updateError });
            throw new BadRequestError('Failed to check in appointment');
        }

        return {
            appointment: this.mapToQueueAppointment(updated),
            payment
        };
    }

    /**
     * Mark an appointment as no-show
     */
    async markNoShow(appointmentId: string, hospitalId: string, reason?: string): Promise<QueueAppointment> {
        const { data: existing, error: fetchError } = await this.supabase
            .from('appointments')
            .select('id, hospital_id, status')
            .eq('id', appointmentId)
            .single();

        if (fetchError || !existing) {
            throw new NotFoundError('Appointment not found');
        }

        if (existing.hospital_id !== hospitalId) {
            throw new ForbiddenError('Appointment does not belong to your hospital');
        }

        if (existing.status === 'completed' || existing.status === 'cancelled') {
            throw new BadRequestError(`Cannot mark as no-show with status: ${existing.status}`);
        }

        const { data: updated, error: updateError } = await this.supabase
            .from('appointments')
            .update({
                status: 'no_show',
                cancellation_reason: reason || 'Patient did not show up',
                updated_at: new Date().toISOString(),
            })
            .eq('id', appointmentId)
            .select(`
        id,
        appointment_number,
        walk_in_token,
        scheduled_start,
        scheduled_end,
        status,
        consultation_type,
        checked_in_at,
        consultation_fee,
        payment_collected_at,
        patient:patient_id (
          id,
          name,
          phone,
          avatar_url
        ),
        doctor:doctor_id (
          id,
          users:user_id (
            name
          ),
          specializations:specialization_id (
            name
          )
        )
      `)
            .single();

        if (updateError || !updated) {
            this.log.error('Failed to mark no-show', { error: updateError, appointmentId });
            throw new BadRequestError('Failed to mark no-show');
        }

        return this.mapToQueueAppointment(updated);
    }

    /**
     * Create a walk-in booking with cash payment
     */
    async createWalkInBooking(hospitalId: string, receptionUserId: string, input: WalkInBookingInput): Promise<{
        appointment: QueueAppointment;
        payment: any;
    }> {
        // 1. Find or create the patient
        let patientId = input.patient.id;

        if (!patientId) {
            patientId = await this.findOrCreatePatient(input.patient);
        }

        // 2. Calculate end time (15 min default)
        const startTimeStr = input.scheduledStart.includes('+') || input.scheduledStart.includes('Z')
            ? input.scheduledStart
            : `${input.scheduledStart}+05:30`;
        const startTime = new Date(startTimeStr);
        const endTime = new Date(startTime.getTime() + 15 * 60 * 1000);

        // 3. Create the appointment
        const { data: appointment, error: aptError } = await this.supabase
            .from('appointments')
            .insert({
                patient_id: patientId,
                doctor_id: input.doctorId,
                hospital_id: hospitalId,
                slot_id: input.slotId || null,
                scheduled_date: input.scheduledDate,
                scheduled_start: startTimeStr,
                scheduled_end: endTime.toISOString(),
                consultation_type: 'in_person',
                booking_source: 'reception',
                status: 'checked_in',
                checked_in_at: new Date().toISOString(),
                consultation_fee: input.consultationFee,
                platform_fee: 0,
                total_amount: input.consultationFee,
                payment_method: 'cash',
                payment_collected_by: receptionUserId,
                payment_collected_at: new Date().toISOString(),
                patient_notes: input.notes,
            })
            .select(`
        id,
        appointment_number,
        walk_in_token,
        scheduled_start,
        scheduled_end,
        status,
        consultation_type,
        checked_in_at,
        consultation_fee,
        payment_collected_at,
        patient:patient_id (
          id,
          name,
          phone,
          avatar_url
        ),
        doctor:doctor_id (
          id,
          users:user_id (
            name
          ),
          specializations:specialization_id (
            name
          )
        )
      `)
            .single();

        if (aptError || !appointment) {
            this.log.error('Failed to create walk-in appointment', { error: aptError });
            throw new BadRequestError('Failed to create walk-in appointment');
        }

        // 4. Create cash payment record
        const { data: payment, error: paymentError } = await this.supabase
            .from('payments')
            .insert({
                appointment_id: appointment.id,
                payer_user_id: patientId,
                amount: input.consultationFee,
                payment_method: 'cash',
                payment_type: 'consultation',
                status: 'captured',
                currency: 'INR',
                cash_collected_by: receptionUserId,
                cash_collected_at: new Date().toISOString(),
                completed_at: new Date().toISOString(),
            })
            .select()
            .single();

        if (paymentError) {
            this.log.warn('Payment record creation failed, appointment still created', { error: paymentError });
        }

        return {
            appointment: this.mapToQueueAppointment(appointment),
            payment,
        };
    }

    /**
     * Search patients by phone or name
     */
    async searchPatients(hospitalId: string, query: string, limit: number = 20): Promise<PatientSearchResult[]> {
        // Search patients who have had appointments at this hospital
        const { data, error } = await this.supabase
            .from('users')
            .select(`
        id,
        name,
        phone,
        email,
        avatar_url,
        appointments:appointments!patient_id (
          id,
          scheduled_start,
          hospital_id
        )
      `)
            .eq('role', 'patient')
            .or(`phone.ilike.%${query}%,name.ilike.%${query}%`)
            .limit(limit);

        if (error) {
            this.log.error('Failed to search patients', { error, query });
            throw new BadRequestError('Failed to search patients');
        }

        // Filter and map results
        const results: PatientSearchResult[] = (data || []).map((user: any) => {
            const hospitalAppointments = (user.appointments || []).filter(
                (apt: any) => apt.hospital_id === hospitalId
            );
            const lastVisit = hospitalAppointments.length > 0
                ? hospitalAppointments.sort((a: any, b: any) =>
                    new Date(b.scheduled_start).getTime() - new Date(a.scheduled_start).getTime()
                )[0].scheduled_start
                : null;

            return {
                id: user.id,
                name: user.name || 'Unknown',
                phone: user.phone,
                email: user.email,
                avatarUrl: user.avatar_url,
                lastVisit,
                totalVisits: hospitalAppointments.length,
            };
        });

        return results;
    }

    /**
     * Register a new walk-in patient
     */
    async registerWalkInPatient(input: {
        name: string;
        phone: string;
        email?: string;
        dateOfBirth?: string;
        gender?: 'male' | 'female' | 'other';
    }): Promise<{ id: string; name: string; phone: string }> {
        // Check if patient already exists
        const { data: existing } = await this.supabase
            .from('users')
            .select('id, name, phone')
            .eq('phone', input.phone)
            .eq('role', 'patient')
            .single();

        if (existing) {
            return existing;
        }

        // Create new patient user
        const { data: newUser, error } = await this.supabase
            .from('users')
            .insert({
                name: input.name,
                phone: input.phone,
                email: input.email,
                date_of_birth: input.dateOfBirth,
                gender: input.gender,
                role: 'patient',
                is_active: true,
                verification_status: 'verified', // Walk-ins are auto-verified
            })
            .select('id, name, phone')
            .single();

        if (error || !newUser) {
            this.log.error('Failed to register patient', { error, input });
            throw new BadRequestError('Failed to register patient');
        }

        return newUser;
    }

    /**
     * Record a cash payment for an existing appointment
     */
    async recordCashPayment(
        appointmentId: string,
        hospitalId: string,
        receptionUserId: string,
        amount: number,
        receiptNumber?: string
    ): Promise<any> {
        // Verify appointment belongs to hospital
        const { data: appointment, error: aptError } = await this.supabase
            .from('appointments')
            .select('id, hospital_id, patient_id, payment_collected_at')
            .eq('id', appointmentId)
            .single();

        if (aptError || !appointment) {
            throw new NotFoundError('Appointment not found');
        }

        if (appointment.hospital_id !== hospitalId) {
            throw new ForbiddenError('Appointment does not belong to your hospital');
        }

        if (appointment.payment_collected_at) {
            throw new BadRequestError('Payment already completed for this appointment');
        }

        // Create payment record
        const { data: payment, error: paymentError } = await this.supabase
            .from('payments')
            .insert({
                appointment_id: appointmentId,
                payer_user_id: appointment.patient_id,
                amount,
                payment_method: 'cash',
                payment_type: 'consultation',
                status: 'captured',
                currency: 'INR',
                cash_collected_by: receptionUserId,
                cash_collected_at: new Date().toISOString(),
                completed_at: new Date().toISOString(),
                receipt_number: receiptNumber,
            })
            .select()
            .single();

        if (paymentError) {
            this.log.error('Failed to record cash payment', { error: paymentError });
            throw new BadRequestError('Failed to record cash payment');
        }

        // Update appointment payment tracking
        await this.supabase
            .from('appointments')
            .update({
                payment_method: 'cash',
                payment_collected_by: receptionUserId,
                payment_collected_at: new Date().toISOString()
            })
            .eq('id', appointmentId);

        return payment;
    }

    // ================== Helpers ==================

    private async findOrCreatePatient(patient: {
        name: string;
        phone: string;
        email?: string;
        dateOfBirth?: string;
        gender?: 'male' | 'female' | 'other';
    }): Promise<string> {
        // Check for existing patient by phone
        const { data: existing } = await this.supabase
            .from('users')
            .select('id')
            .eq('phone', patient.phone)
            .eq('role', 'patient')
            .single();

        if (existing) {
            return existing.id;
        }

        // Create new patient
        const { data: newUser, error } = await this.supabase
            .from('users')
            .insert({
                name: patient.name,
                phone: patient.phone,
                email: patient.email,
                date_of_birth: patient.dateOfBirth,
                gender: patient.gender,
                role: 'patient',
                is_active: true,
                verification_status: 'verified',
            })
            .select('id')
            .single();

        if (error || !newUser) {
            throw new BadRequestError('Failed to create patient record');
        }

        return newUser.id;
    }



    private mapToQueueAppointment(data: any): QueueAppointment {
        return {
            id: data.id,
            appointmentNumber: data.appointment_number,
            patient: {
                id: data.patient?.id || '',
                name: data.patient?.name || 'Unknown',
                phone: data.patient?.phone || null,
                avatarUrl: data.patient?.avatar_url || null,
            },
            doctor: {
                id: data.doctor?.id || '',
                name: data.doctor?.users?.name || 'Unknown',
                specialization: data.doctor?.specializations?.name || 'General',
            },
            scheduledStart: data.scheduled_start,
            scheduledEnd: data.scheduled_end,
            // Add formatted times for UI
            checkedInAtFormatted: data.checked_in_at ? formatToIST(data.checked_in_at) : null,
            scheduledStartFormatted: formatToIST(data.scheduled_start),
        };
    }

    /**
     * Get prescription details for printing
     */
    async getPrescriptionForAppointment(appointmentId: string, hospitalId: string): Promise<PrescriptionResponse> {
        // 1. Get Appointment with Doctor & Patient details
        const { data: appointment, error: aptError } = await this.supabase
            .from('appointments')
            .select(`
                *,
                doctor:doctor_id (
                    id,
                    registration_number,
                    specialization:specialization_id (name),
                    users:user_id (name)
                ),
                patient:patient_id (
                    id,
                    name,
                    phone,
                    gender,
                    dob
                ),
                hospital:hospital_id (
                    id,
                    name,
                    address,
                    city,
                    state,
                    pincode,
                    phone,
                    email,
                    logo_url
                )
            `)
            .eq('id', appointmentId)
            .eq('hospital_id', hospitalId)
            .single();

        if (aptError || !appointment) {
            throw new NotFoundError('Appointment not found');
        }

        // 2. Get Consultation
        const { data: consultation, error: consError } = await this.supabase
            .from('consultations')
            .select('*')
            .eq('appointment_id', appointmentId)
            .single();

        if (consError) {
            // It's possible consultation exists but failed to fetch, or doesn't exist yet
            // If completed status, it should exist.
            if (appointment.status === 'completed') {
                throw new NotFoundError('Consultation record not found for this appointment');
            }
            // For other statuses, return nulls
            return {
                appointment,
                doctor: appointment.doctor,
                patient: appointment.patient,
                hospital: appointment.hospital,
                consultation: null,
                prescription: null
            };
        }

        // 3. Get Prescription
        const { data: prescription, error: rxError } = await this.supabase
            .from('prescriptions')
            .select('*')
            .eq('consultation_id', consultation.id)
            .single();

        // Prescription might not be created yet even if consultation is done

        return {
            appointment,
            doctor: {
                name: appointment.doctor.users.name,
                registrationNumber: appointment.doctor.registration_number,
                specialization: appointment.doctor.specialization?.name
            },
            patient: appointment.patient,
            hospital: appointment.hospital,
            consultation,
            prescription: prescription || null
        };
    }
}

export const receptionService = new ReceptionService();
