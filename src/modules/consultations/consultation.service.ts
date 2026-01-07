// @ts-nocheck
import crypto from 'crypto';
import { getSupabaseAdmin } from '../../config/db.js';
import { logger } from '../../common/logger.js';
import { appointmentRepository } from '../appointments/appointment.repository.js';
import { doctorRepository } from '../doctors/doctor.repository.js';
import {
  NotFoundError,
  ForbiddenError,
  BadRequestError,
  InvalidAppointmentStatusError,
} from '../../common/errors.js';
import type {
  Consultation,
  ConsultationWithDetails,
  ConsultationFilters,
  Prescription,
  VideoCallToken,
} from './consultation.types.js';
import type { StartConsultationInput, ListConsultationsInput, CreatePrescriptionInput } from './consultation.validator.js';

/**
 * Consultation Service - Business logic for consultations
 */
class ConsultationService {
  private logger = logger.child('ConsultationService');
  private supabase = getSupabaseAdmin();

  /**
   * Start a consultation
   */
  async start(userId: string, role: string, data: StartConsultationInput): Promise<Consultation> {
    const appointment = await appointmentRepository.findByIdWithRelations(data.appointmentId);

    if (!appointment) {
      throw new NotFoundError('Appointment');
    }

    // Verify doctor permission
    if (role === 'doctor' && appointment.doctor?.user_id !== userId) {
      throw new ForbiddenError('You can only start your own consultations');
    }

    // Check appointment status
    if (!['confirmed', 'checked_in'].includes(appointment.status)) {
      throw new InvalidAppointmentStatusError(appointment.status, 'confirmed or checked_in');
    }

    // Check if consultation already exists
    const { data: existing } = await this.supabase
      .from('consultations')
      .select('id, status')
      .eq('appointment_id', appointment.id)
      .single();

    if (existing) {
      if (existing.status === 'in_progress') {
        // Return existing consultation
        const { data: consultation } = await this.supabase
          .from('consultations')
          .select('*')
          .eq('id', existing.id)
          .single();
        return this.transformConsultation(consultation);
      } else if (existing.status === 'completed') {
        throw new BadRequestError('Consultation already completed');
      }
    }

    // Generate room ID for video call (online consultations)
    const roomId = appointment.consultation_type === 'online'
      ? `room_${crypto.randomBytes(16).toString('hex')}`
      : null;

    // Create consultation
    const { data: consultation, error } = await this.supabase
      .from('consultations')
      .insert({
        appointment_id: appointment.id,
        doctor_id: appointment.doctor_id,
        patient_id: appointment.patient_id,
        room_id: roomId,
        status: 'in_progress',
        scheduled_duration: appointment.doctor?.consultation_duration || 15,
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      this.logger.error('Failed to create consultation', error);
      throw error;
    }

    // Update appointment status
    await appointmentRepository.update(appointment.id, {
      status: 'in_progress',
      started_at: new Date().toISOString(),
    });

    return this.transformConsultation(consultation);
  }

  /**
   * End a consultation
   */
  async end(consultationId: string, userId: string, role: string, notes?: string): Promise<Consultation> {
    const { data: consultation, error } = await this.supabase
      .from('consultations')
      .select(`
        *,
        appointment:appointments!consultations_appointment_id_fkey(
          doctor:doctors!appointments_doctor_id_fkey(user_id)
        )
      `)
      .eq('id', consultationId)
      .single();

    if (error || !consultation) {
      throw new NotFoundError('Consultation');
    }

    // Verify doctor permission
    if (role === 'doctor' && consultation.appointment?.doctor?.user_id !== userId) {
      throw new ForbiddenError('You can only end your own consultations');
    }

    if (consultation.status !== 'in_progress') {
      throw new BadRequestError('Consultation is not in progress');
    }

    const endedAt = new Date();
    const startedAt = new Date(consultation.started_at);
    const actualDuration = Math.round((endedAt.getTime() - startedAt.getTime()) / 60000);

    // Update consultation
    const { data: updated, error: updateError } = await this.supabase
      .from('consultations')
      .update({
        status: 'completed',
        actual_duration: actualDuration,
        ended_at: endedAt.toISOString(),
        doctor_notes: notes || null,
        updated_at: endedAt.toISOString(),
      })
      .eq('id', consultationId)
      .select()
      .single();

    if (updateError) {
      this.logger.error('Failed to end consultation', updateError);
      throw updateError;
    }

    // Update appointment status
    await appointmentRepository.update(consultation.appointment_id, {
      status: 'completed',
      completed_at: endedAt.toISOString(),
    });

    return this.transformConsultation(updated);
  }

  /**
   * Get consultation by ID
   */
  async getById(consultationId: string, userId: string, role: string): Promise<ConsultationWithDetails> {
    const { data: consultation, error } = await this.supabase
      .from('consultations')
      .select(`
        *,
        appointment:appointments!consultations_appointment_id_fkey(
          id, appointment_date, start_time, consultation_type
        ),
        doctor:doctors!consultations_doctor_id_fkey(
          id, user_id, specialization,
          users!doctors_user_id_fkey(full_name)
        ),
        patient:users!consultations_patient_id_fkey(id, full_name, phone),
        prescriptions(*)
      `)
      .eq('id', consultationId)
      .single();

    if (error || !consultation) {
      throw new NotFoundError('Consultation');
    }

    // Check access
    const hasAccess = this.checkAccess(consultation, userId, role);
    if (!hasAccess) {
      throw new ForbiddenError('You do not have access to this consultation');
    }

    return this.transformWithDetails(consultation);
  }

  /**
   * List consultations
   */
  async list(filters: ListConsultationsInput, userId: string, role: string) {
    let query = this.supabase
      .from('consultations')
      .select(`
        *,
        appointment:appointments!consultations_appointment_id_fkey(
          id, appointment_date, start_time, consultation_type
        ),
        doctor:doctors!consultations_doctor_id_fkey(
          id, user_id,
          users!doctors_user_id_fkey(full_name)
        ),
        patient:users!consultations_patient_id_fkey(id, full_name)
      `, { count: 'exact' });

    // Role-based filtering
    if (role === 'patient') {
      query = query.eq('patient_id', userId);
    } else if (role === 'doctor') {
      const doctor = await doctorRepository.findByUserId(userId);
      if (doctor) {
        query = query.eq('doctor_id', doctor.id);
      }
    }

    // Apply filters
    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    if (filters.startDate) {
      query = query.gte('created_at', filters.startDate);
    }
    if (filters.endDate) {
      query = query.lte('created_at', filters.endDate);
    }

    // Pagination
    const page = filters.page || 1;
    const limit = Math.min(filters.limit || 20, 100);
    const offset = (page - 1) * limit;

    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      this.logger.error('Failed to fetch consultations', error);
      throw error;
    }

    return {
      consultations: (data || []).map(c => this.transformWithDetails(c)),
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    };
  }

  /**
   * Get video call token
   */
  async getVideoToken(consultationId: string, userId: string, role: string): Promise<VideoCallToken> {
    const { data: consultation, error } = await this.supabase
      .from('consultations')
      .select(`
        *,
        appointment:appointments!consultations_appointment_id_fkey(consultation_type),
        doctor:doctors!consultations_doctor_id_fkey(user_id)
      `)
      .eq('id', consultationId)
      .single();

    if (error || !consultation) {
      throw new NotFoundError('Consultation');
    }

    // Check access
    const isDoctor = role === 'doctor' && consultation.doctor?.user_id === userId;
    const isPatient = role === 'patient' && consultation.patient_id === userId;

    if (!isDoctor && !isPatient) {
      throw new ForbiddenError('You do not have access to this consultation');
    }

    if (consultation.appointment?.consultation_type !== 'online') {
      throw new BadRequestError('Video call only available for online consultations');
    }

    if (!consultation.room_id) {
      throw new BadRequestError('Video room not initialized');
    }

    // Generate token (in production, use actual video provider like Daily.co, Twilio, etc.)
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(); // 2 hours

    return {
      token,
      roomId: consultation.room_id,
      expiresAt,
    };
  }

  /**
   * Create prescription
   */
  async createPrescription(userId: string, data: CreatePrescriptionInput): Promise<Prescription> {
    // Get consultation
    const { data: consultation, error } = await this.supabase
      .from('consultations')
      .select(`
        *,
        doctor:doctors!consultations_doctor_id_fkey(user_id)
      `)
      .eq('id', data.consultationId)
      .single();

    if (error || !consultation) {
      throw new NotFoundError('Consultation');
    }

    // Verify doctor
    if (consultation.doctor?.user_id !== userId) {
      throw new ForbiddenError('Only the treating doctor can create prescriptions');
    }

    // Check if prescription already exists
    const { data: existing } = await this.supabase
      .from('prescriptions')
      .select('id')
      .eq('consultation_id', data.consultationId)
      .single();

    if (existing) {
      throw new BadRequestError('Prescription already exists for this consultation');
    }

    // Create prescription
    const { data: prescription, error: createError } = await this.supabase
      .from('prescriptions')
      .insert({
        consultation_id: data.consultationId,
        appointment_id: data.appointmentId,
        doctor_id: consultation.doctor_id,
        patient_id: consultation.patient_id,
        diagnosis: data.diagnosis,
        chief_complaints: data.chiefComplaints || null,
        clinical_notes: data.clinicalNotes || null,
        medications: data.medications,
        lab_tests: data.labTests || null,
        advice: data.advice || null,
        follow_up_date: data.followUpDate || null,
        valid_until: data.validUntil || null,
      })
      .select()
      .single();

    if (createError) {
      this.logger.error('Failed to create prescription', createError);
      throw createError;
    }

    return this.transformPrescription(prescription);
  }

  /**
   * Get prescription by ID
   */
  async getPrescription(prescriptionId: string, userId: string, role: string): Promise<Prescription> {
    const { data: prescription, error } = await this.supabase
      .from('prescriptions')
      .select(`
        *,
        doctor:doctors!prescriptions_doctor_id_fkey(user_id)
      `)
      .eq('id', prescriptionId)
      .single();

    if (error || !prescription) {
      throw new NotFoundError('Prescription');
    }

    // Check access
    const isDoctor = role === 'doctor' && prescription.doctor?.user_id === userId;
    const isPatient = role === 'patient' && prescription.patient_id === userId;
    const isAdmin = role === 'admin';

    if (!isDoctor && !isPatient && !isAdmin) {
      throw new ForbiddenError('You do not have access to this prescription');
    }

    return this.transformPrescription(prescription);
  }

  /**
   * Get prescriptions for patient
   */
  async getPatientPrescriptions(patientId: string, userId: string, role: string) {
    // Verify access
    if (role === 'patient' && patientId !== userId) {
      throw new ForbiddenError('You can only view your own prescriptions');
    }

    const { data: prescriptions, error } = await this.supabase
      .from('prescriptions')
      .select(`
        *,
        doctor:doctors!prescriptions_doctor_id_fkey(
          users!doctors_user_id_fkey(full_name),
          specialization
        )
      `)
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false });

    if (error) {
      this.logger.error('Failed to fetch prescriptions', error);
      throw error;
    }

    return (prescriptions || []).map(p => this.transformPrescription(p));
  }

  // Private helpers

  private checkAccess(consultation: any, userId: string, role: string): boolean {
    if (role === 'admin') return true;
    if (role === 'patient') return consultation.patient_id === userId;
    if (role === 'doctor') return consultation.doctor?.user_id === userId;
    return false;
  }

  private transformConsultation(row: any): Consultation {
    return {
      id: row.id,
      appointmentId: row.appointment_id,
      doctorId: row.doctor_id,
      patientId: row.patient_id,
      roomId: row.room_id,
      status: row.status,
      scheduledDuration: row.scheduled_duration,
      actualDuration: row.actual_duration,
      startedAt: row.started_at,
      endedAt: row.ended_at,
      doctorNotes: row.doctor_notes,
      recordingUrl: row.recording_url,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private transformWithDetails(row: any): ConsultationWithDetails {
    return {
      ...this.transformConsultation(row),
      appointment: {
        id: row.appointment?.id || '',
        date: row.appointment?.appointment_date || '',
        startTime: row.appointment?.start_time || '',
        consultationType: row.appointment?.consultation_type || '',
      },
      doctor: {
        id: row.doctor?.id || '',
        name: row.doctor?.users?.full_name || '',
        specialization: row.doctor?.specialization || '',
      },
      patient: {
        id: row.patient?.id || '',
        name: row.patient?.full_name || '',
        phone: row.patient?.phone || '',
      },
      prescription: row.prescriptions?.[0] ? this.transformPrescription(row.prescriptions[0]) : undefined,
    };
  }

  private transformPrescription(row: any): Prescription {
    return {
      id: row.id,
      consultationId: row.consultation_id,
      appointmentId: row.appointment_id,
      doctorId: row.doctor_id,
      patientId: row.patient_id,
      diagnosis: row.diagnosis,
      chiefComplaints: row.chief_complaints,
      clinicalNotes: row.clinical_notes,
      medications: row.medications,
      labTests: row.lab_tests,
      advice: row.advice,
      followUpDate: row.follow_up_date,
      validUntil: row.valid_until,
      pdfUrl: row.pdf_url,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

// Export singleton instance
export const consultationService = new ConsultationService();

