import crypto from 'crypto';
import { logger } from '../../config/logger.js';
import { consultationRepository } from '../../database/repositories/consultation.repo.js';
import { appointmentRepository } from '../../database/repositories/appointment.repo.js';
import { doctorRepository } from '../../database/repositories/doctor.repo.js';
import { prescriptionService } from '../prescriptions/prescription.service.js';
import { env } from '../../config/env.js';
import { videoService } from '../../integrations/video/index.js';
import { notificationService } from '../notifications/notification.service.js';
import { NotificationPurpose } from '../../integrations/notification/notification.types.js';
import {
  NotFoundError,
  ForbiddenError,
  BadRequestError,
  InvalidAppointmentStatusError,
} from '../../common/errors/index.js';
import type {
  Consultation,
  ConsultationWithDetails,
  VideoCallToken,
  ConsultationStatus,
} from './consultation.types.js';
import type {
  StartConsultationInput,
  ListConsultationsInput,
  CreatePrescriptionInput,
  UpdateConsultationNotesInput,
  UpdateConsultationVitalsInput
} from './consultation.validator.js';

/**
 * Consultation Service - Business logic for consultations
 */
class ConsultationService {
  private log = logger.child('ConsultationService');

  /**
   * Start a consultation session
   * This is an atomic operation that updates the appointment status and creates a consultation record.
   * 
   * @param userId - ID of the doctor starting the consultation
   * @param role - Role of the user (must be 'doctor' or 'admin')
   * @param data - Input data containing appointmentId
   * @returns The started consultation
   * @throws {NotFoundError} If appointment is not found
   * @throws {ForbiddenError} If user is not authorized
   * @throws {InvalidAppointmentStatusError} If appointment status is not confirmed or checked_in
   * @throws {BadRequestError} If transaction fails
   */
  async start(userId: string, role: string, data: StartConsultationInput): Promise<Consultation> {
    const appointment = await appointmentRepository.findByIdWithRelations(data.appointmentId);

    if (!appointment) {
      throw new NotFoundError('Appointment');
    }

    // Verify doctor permission
    // Check if appointment is assigned to this doctor
    // We check both the direct doctor_id match and the nested user_id if valid
    const doctorId = appointment.doctor_id;
    const doctorUserId = appointment.doctor?.user_id || (appointment.doctors as any)?.user_id;

    // Authorization Check:
    // 1. If we have the Doctor Profile ID (doctorId) and the user also has a doctor profile, checking if they match would be ideal.
    // 2. If we have the Doctor User ID (doctorUserId), it must match the requesting userId.

    let isAuthorized = false;

    if (doctorUserId && doctorUserId === userId) {
      isAuthorized = true;
    } else if (doctorId) {
      // Fallback: Check if the current user owns this doctor profile
      // This requires an extra query if we don't trust the session context, but usually the 'doctor' role implies the user IS a doctor.
      // We can trust that appointment.doctor_id refers to the doctor profile. 
      // Since we don't have the user's doctor profile ID handy without a query, we skip this if doctorUserId was present but didn't match.

      // However, if relations failed to load, we might ONLY have doctorId.
      // Let's assume for now that if relations failed, we should try to fetch the doctor profile of the current user to compare.
      const doctorProfile = await doctorRepository.findByUserId(userId);
      if (doctorProfile && doctorProfile.id === doctorId) {
        isAuthorized = true;
      }
    }

    if (role === 'doctor' && !isAuthorized) {
      this.log.warn('Consultation start forbidden', {
        appointmentDoctorId: doctorId,
        appointmentDoctorUserId: doctorUserId,
        requestingUserId: userId
      });
      // Only throw if we are sure it's a mismatch. If data is partial, we might be blocking valid users.
      // But assuming findByIdWithRelations works, doctorUserId SHOULD be there.
      throw new ForbiddenError('You can only start your own consultations');
    }

    // Check appointment status
    if (!['confirmed', 'checked_in', 'pending_payment'].includes(appointment.status)) {
      throw new InvalidAppointmentStatusError(appointment.status, 'confirmed, checked_in, or pending_payment');
    }

    // Check if consultation already exists
    const { data: existingList } = await consultationRepository.findMany({
      appointment_id: appointment.id
    });
    const existing = existingList[0];

    if (existing) {
      if (existing.status === 'in_progress') {
        return this.transformConsultation(existing);
      } else if (existing.status === 'completed') {
        throw new BadRequestError('Consultation already completed');
      }
    }

    // Generate channel name for video call (online consultations)
    const consultationId = crypto.randomUUID();
    const roomId = appointment.consultation_type === 'online'
      ? videoService.generateChannelName(consultationId)
      : null;

    // Use atomic RPC to start consultation
    const { data: result, error } = await consultationRepository.rpc('start_consultation', {
      p_appointment_id: appointment.id,
      p_consultation_id: consultationId,
      p_doctor_id: appointment.doctor_id,
      p_patient_id: appointment.patient_id,
      p_room_id: roomId,
      p_scheduled_duration: (appointment.doctor as any)?.consultation_duration || 15,
      p_started_at: new Date().toISOString()
    });

    if (error) {
      // Check for unique constraint violation (Postgres code 23505)
      // The error message might vary, but "duplicate key" or "unique constraint" is consistent
      if (error.code === '23505' || error.message?.includes('duplicate key') || error.message?.includes('unique constraint')) {
        this.log.info('Consultation already started (caught race condition), returning existing', { appointmentId: appointment.id });

        // Fetch the existing one
        const { data: existingList } = await consultationRepository.findMany({
          appointment_id: appointment.id
        });

        if (existingList && existingList.length > 0) {
          const existing = existingList[0];
          return this.transformConsultation(existing);
        }
      }

      this.log.error('Failed to start consultation via RPC', { error, appointmentId: appointment.id });
      throw new BadRequestError(error?.message || 'Failed to start consultation');
    }

    // Link appointment to result for transformer
    (result as any).appointment = appointment;
    const consultation = result as any;

    // Send notification to patient that consultation is starting
    this.sendConsultationStartNotification(
      appointment.patient_id,
      (appointment.doctor as any)?.user?.name || (appointment.doctors as any)?.users?.name || 'Doctor',
      appointment.scheduled_start,
      consultation.id,
      appointment.patient
    ).catch(err => {
      this.log.error('Failed to send consultation start notification', { error: err });
    });

    return this.transformConsultation(consultation);
  }

  /**
   * End a consultation session
   * This updates the consultation status and appointment status to 'completed'.
   * 
   * @param consultationId - The ID of the consultation session
   * @param userId - ID of the user ending it
   * @param role - Role of the user
   * @param notes - Optional final consolidated doctor notes
   * @returns Updated consultation record
   */
  async end(consultationId: string, userId: string, role: string, notes?: string): Promise<Consultation> {
    const consultation = await consultationRepository.findByIdWithRelations(consultationId);

    if (!consultation) {
      throw new NotFoundError('Consultation');
    }

    // Verify doctor permission
    // Provide fallback for missing direct columns using nested appointment
    const doctorUserId = consultation.doctor?.user_id || consultation.appointment?.doctor?.user_id;
    const doctorId = consultation.doctor_id || consultation.appointment?.doctor_id;

    let isAuthorized = false;

    if (doctorUserId && doctorUserId === userId) {
      isAuthorized = true;
    } else if (doctorId) {
      // Fallback: Check if the current user owns this doctor profile
      const doctorProfile = await doctorRepository.findByUserId(userId);
      if (doctorProfile && doctorProfile.id === doctorId) {
        isAuthorized = true;
      }
    }

    if (role === 'doctor' && !isAuthorized) {
      this.log.warn('Consultation end forbidden', {
        consultationDoctorId: doctorId,
        consultationDoctorUserId: doctorUserId,
        requestingUserId: userId
      });
      throw new ForbiddenError('You can only end your own consultations');
    }

    if (consultation.status !== 'in_progress') {
      // If it is already completed, just return it. Idempotency.
      if (consultation.status === 'completed') {
        this.log.info('Consultation already completed, returning existing', { consultationId });
        return this.transformConsultation(consultation);
      }
      throw new BadRequestError('Consultation is not in progress');
    }

    const endedAt = new Date();
    const startedAt = new Date(consultation.started_at);
    const actualDuration = Math.round((endedAt.getTime() - startedAt.getTime()) / 60000);

    // Use atomic RPC to end consultation and update appointment
    const { data: result, error } = await consultationRepository.rpc('end_consultation', {
      p_consultation_id: consultationId,
      p_appointment_id: consultation.appointment_id,
      p_notes: notes || null,
      p_actual_duration: actualDuration,
      p_ended_at: endedAt.toISOString(),
    });

    if (error || !result) {
      this.log.error('Failed to end consultation via RPC', { error, consultationId });
      throw new BadRequestError(error?.message || 'Failed to complete consultation');
    }

    // Attach appointment context for transformer
    // CRITICAL: The RPC result usually doesn't include the joined appointment relation, so we must re-attach it from the initial fetch.
    (result as any).appointment = consultation.appointment;

    return this.transformConsultation(result);
  }

  /**
   * Get a consultation by its ID
   * @param consultationId - The ID of the consultation
   * @param userId - Requesting user ID for authorization
   * @param role - Requesting user role
   * @returns Detailed consultation information
   */
  async getById(consultationId: string, userId: string, role: string): Promise<ConsultationWithDetails> {
    const consultation = await consultationRepository.findByIdWithRelations(consultationId);

    if (!consultation) {
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
   * List consultations for a user
   * @param filters - Pagination and filtering criteria
   * @param userId - Requesting user ID
   * @param role - Requesting user role
   * @returns Paginated list of consultations
   */
  async list(filters: ListConsultationsInput, userId: string, role: string) {
    const filterObj: any = {
      status: filters.status,
      appointment_id: filters.appointmentId,
      startDate: filters.startDate,
      endDate: filters.endDate,
      page: filters.page,
      limit: filters.limit
    };

    // Role-based filtering
    if (role === 'patient') {
      filterObj.patient_id = userId;
    } else if (role === 'doctor') {
      const doctor = await doctorRepository.findByUserId(userId);
      if (!doctor) {
        throw new NotFoundError('Doctor profile not found');
      }
      filterObj.doctor_id = doctor.id;
    }

    const { data: consultations, total } = await consultationRepository.findMany(filterObj);

    // Auto-create consultation if missing and appointmentId is provided
    if (total === 0 && filters.appointmentId) {
      const appointment = await appointmentRepository.findByIdWithRelations(filters.appointmentId);

      if (appointment && ['confirmed', 'checked_in', 'pending_payment'].includes(appointment.status)) {
        // Double check if consultation really doesn't exist to avoid race conditions
        const { data: existingCheck } = await consultationRepository.findMany({ appointment_id: filters.appointmentId });

        if (existingCheck.length === 0) {
          const consultationId = crypto.randomUUID();
          const roomId = appointment.consultation_type === 'online'
            ? videoService.generateChannelName(consultationId)
            : null;

          // Create scheduled consultation
          const consultation = await consultationRepository.create({
            id: consultationId,
            appointment_id: appointment.id,
            status: 'scheduled',
            room_id: roomId,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          } as any);

          // Return the newly created consultation
          return {
            consultations: [this.transformWithDetails({ ...consultation, appointment })],
            pagination: {
              page: 1,
              limit: filters.limit || 20,
              total: 1,
              totalPages: 1
            }
          };
        }
      }
    }

    return {
      consultations: consultations.map(c => this.transformWithDetails(c)),
      pagination: {
        page: filters.page || 1,
        limit: filters.limit || 20,
        total,
        totalPages: Math.ceil(total / (filters.limit || 20)),
      },
    };
  }

  /**
   * Get video call token
   */
  async getVideoToken(consultationId: string, userId: string, role: string): Promise<VideoCallToken> {
    const consultation = await consultationRepository.findByIdWithRelations(consultationId);

    if (!consultation) {
      throw new NotFoundError('Consultation');
    }

    // Check access
    if (!this.checkAccess(consultation, userId, role)) {
      throw new ForbiddenError('You do not have access to this consultation');
    }

    const consultationType = consultation.appointment?.consultation_type;
    if (consultationType !== 'online' && consultationType !== 'video') {
      throw new BadRequestError('Video call only available for online/video consultations');
    }

    if (!consultation.room_id) {
      throw new BadRequestError('Video room not initialized');
    }

    // Generate video token via unified service
    const roomId = consultation.room_id;
    const result = await videoService.generateToken({ roomId, userId });
    const clientConfig = await videoService.getClientConfig();

    return {
      token: result.token,
      roomId,
      expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
      appId: String(clientConfig.appId),
      uid: videoService.generateUserUid(userId),
      channelName: roomId,
      provider: result.provider,
    } as VideoCallToken & { appId: string; uid: number; channelName: string };
  }

  /**
   * Create prescription
   */
  async createPrescription(userId: string, data: CreatePrescriptionInput): Promise<any> {
    // Get consultation
    const consultation = await consultationRepository.findByIdWithRelations(data.consultationId);

    if (!consultation) {
      throw new NotFoundError('Consultation');
    }

    // Verify doctor
    const doctorId = consultation.doctor_id || consultation.appointment?.doctor_id;
    const doctorUserId = consultation.doctor?.user_id || consultation.appointment?.doctor?.user_id;

    if (doctorUserId !== userId && doctorId !== userId) {
      throw new ForbiddenError('Only the treating doctor can create prescriptions');
    }

    // Delegate to prescriptionService
    return prescriptionService.create(doctorId, {
      appointment_id: data.appointmentId,
      consultation_id: data.consultationId,
      chief_complaints: data.chiefComplaints,
      diagnosis: data.diagnosis,
      vitals: consultation.vitals, // Pass consultation vitals
      medications: data.medications.map((m: any) => ({
        name: m.name,
        dosage: m.dosage,
        frequency: m.frequency,
        duration: m.duration,
        instructions: m.instructions,
        meal_relation: m.timing.toLowerCase().includes('before') ? 'before' : 'after'
      })),
      lab_tests: data.labTests?.map((t: string) => ({ name: t })),
      general_advice: data.advice,
      follow_up_date: data.followUpDate,
    } as any);
  }

  /**
   * Record when a user joins the consultation room
   */
  async join(consultationId: string, userId: string, role: string): Promise<void> {
    const consultation = await consultationRepository.findByIdWithRelations(consultationId);
    if (!consultation) throw new NotFoundError('Consultation');

    // Resolve IDs from consultation or nested appointment
    const patientId = consultation.patient_id || consultation.appointment?.patient_id;
    const doctorId = consultation.doctor_id || consultation.appointment?.doctor_id;
    const doctorUserId = consultation.doctor?.user_id || consultation.appointment?.doctor?.user_id;

    if (role === 'doctor' && (doctorId === userId || doctorUserId === userId || (await doctorRepository.findByUserId(userId))?.id === doctorId)) {
      // Doctor access valid
    } else if (role === 'patient' && patientId === userId) {
      // Patient access valid
    } else if (role !== 'admin') {
      throw new ForbiddenError('You do not have access to this consultation');
    }

    // Note: joined_at columns removed as they don't exist in schema
  }

  /**
   * Update consultation notes
   */
  async updateNotes(consultationId: string, userId: string, notes: string): Promise<void> {
    const consultation = await consultationRepository.findById(consultationId);
    if (!consultation) throw new NotFoundError('Consultation');

    // Verify doctor
    if (consultation.doctor_id !== userId && (await doctorRepository.findByUserId(userId))?.id !== consultation.doctor_id) {
      throw new ForbiddenError('Only the treating doctor can update notes');
    }

    await consultationRepository.update(consultationId, {
      doctor_notes: notes,
      updated_at: new Date().toISOString(),
    });
  }

  /**
   * Update consultation vitals
   */
  async updateVitals(consultationId: string, userId: string, vitals: any): Promise<void> {
    const consultation = await consultationRepository.findById(consultationId);
    if (!consultation) throw new NotFoundError('Consultation');

    // Verify doctor
    if (consultation.doctor_id !== userId && (await doctorRepository.findByUserId(userId))?.id !== consultation.doctor_id) {
      throw new ForbiddenError('Only the treating doctor can update vitals');
    }

    await consultationRepository.update(consultationId, {
      vitals,
      updated_at: new Date().toISOString(),
    });
  }

  /**
   * Get consultation status
   */
  async getStatus(consultationId: string): Promise<{ status: ConsultationStatus; roomId: string | null }> {
    const consultation = await consultationRepository.findById(consultationId);
    if (!consultation) throw new NotFoundError('Consultation');

    return {
      status: consultation.status as ConsultationStatus,
      roomId: consultation.room_id,
    };
  }

  /**
   * Get prescription by ID
   */
  async getPrescription(prescriptionId: string, userId: string, role: string): Promise<any> {
    const prescription = await prescriptionService.getById(prescriptionId);

    // Check access
    const isDoctor = role === 'doctor' && (prescription.doctor?.user_id === userId || prescription.doctor_id === userId);
    const isPatient = role === 'patient' && prescription.patient_id === userId;
    const isAdmin = role === 'admin';

    if (!isDoctor && !isPatient && !isAdmin) {
      throw new ForbiddenError('You do not have access to this prescription');
    }

    return prescription;
  }

  /**
   * Get prescriptions for patient
   */
  async getPatientPrescriptions(patientId: string, userId: string, role: string) {
    // Verify access
    if (role === 'patient' && patientId !== userId) {
      throw new ForbiddenError('You can only view your own prescriptions');
    }

    return prescriptionService.getPatientPrescriptions(patientId);
  }

  // Private helpers

  private checkAccess(consultation: any, userId: string, role: string): boolean {
    if (role === 'admin') return true;

    // Handle missing direct columns by checking nested appointment
    const patientId = consultation.patient_id || consultation.appointment?.patient_id;
    const doctorId = consultation.doctor_id || consultation.appointment?.doctor_id;
    const doctorUserId = consultation.doctor?.user_id || consultation.appointment?.doctor?.user_id;

    if (role === 'patient') return patientId === userId;
    if (role === 'doctor') return (doctorUserId === userId || doctorId === userId);
    return false;
  }

  private transformConsultation(row: any): Consultation {
    return {
      id: row.id,
      appointmentId: row.appointment_id,
      doctorId: row.doctor_id || row.appointment?.doctor_id,
      patientId: row.patient_id || row.appointment?.patient_id,
      roomId: row.room_id,
      status: row.status,
      scheduledDuration: row.scheduled_duration,
      actualDuration: row.actual_duration,
      startedAt: row.started_at,
      endedAt: row.ended_at,
      doctorNotes: row.treatment_plan,
      vitals: row.vitals,
      recordingUrl: row.recording_url,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private transformWithDetails(row: any): ConsultationWithDetails {
    // Extract relations from direct or nested appointment
    const appointment = row.appointment;
    const doctor = row.doctor || appointment?.doctor;
    const patient = row.patient || appointment?.patient;
    const doctorUser = doctor?.users || doctor?.user; // Handle different join structures

    return {
      ...this.transformConsultation(row),
      appointment: {
        id: appointment?.id || '',
        date: appointment?.scheduled_date || '',
        startTime: appointment?.scheduled_start?.includes('T') ? appointment.scheduled_start.split('T')[1].substring(0, 5) : appointment?.scheduled_start || '',
        consultationType: appointment?.consultation_type || '',
      },
      doctor: {
        id: doctor?.id || '',
        name: doctorUser?.name || doctor?.name || '',
        specialization: doctor?.specialization || doctor?.specializations?.name || '',
      },
      patient: {
        id: patient?.id || '',
        name: patient?.name || '',
        phone: patient?.phone || '',
      },
      prescription: row.prescriptions?.[0] ? row.prescriptions[0] : undefined,
    };
  }

  private async sendConsultationStartNotification(patientId: string, doctorName: string, time: string, consultationId: string, patient?: any) {
    if (!patient) return;

    const link = `${env.CLIENT_URL}/consultation/${consultationId}`;

    await notificationService.send({
      purpose: NotificationPurpose.CONSULTATION_STARTED,
      phone: patient.phone,
      email: patient.email,
      variables: {
        doctor_name: doctorName,
        patient_name: patient.name || "Patient",
        link: link
      }
    });

    this.log.info('Sent consultation start notification', { patientId, doctorName, consultationId });
  }
}

export const consultationService = new ConsultationService();


