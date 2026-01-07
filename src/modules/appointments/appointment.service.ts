import { getSupabaseAdmin } from '../../config/db.js';
import { logger } from '../../common/logger.js';
import { NotFoundError, ForbiddenError, BadRequestError } from '../../common/errors.js';
import { PLATFORM_FEES, APPOINTMENT_DURATIONS } from '../../config/constants.js';
import type {
  AppointmentStatus,
  ConsultationType,
  PaymentStatus,
} from '../../types/database.types.js';
import type {
  AppointmentWithDetails,
  AppointmentListItem,
  AppointmentFilters,
  AppointmentListResponse,
  AppointmentStats,
  BookAppointmentInput,
  RescheduleInput,
  CancelInput,
  ConsultationDetails,
  StartConsultationInput,
  EndConsultationInput,
  CreatePrescriptionInput,
  AvailableSlot,
  APPOINTMENT_TRANSITIONS,
} from './appointment.types.js';

/**
 * Appointment Service - Production-ready appointment management
 * Features: Slot-based booking, state machine, consultations, prescriptions
 */
class AppointmentService {
  private log = logger.child('AppointmentService');
  private supabase = getSupabaseAdmin();

  // ============================================================================
  // Booking Operations
  // ============================================================================

  /**
   * Book a new appointment
   */
  async bookAppointment(
    patientId: string,
    input: BookAppointmentInput
  ): Promise<{ appointment: AppointmentWithDetails; paymentRequired: boolean; amount: number }> {
    const {
      doctor_id,
      hospital_id,
      family_member_id,
      appointment_date,
      start_time,
      end_time,
      consultation_type,
      symptoms,
      patient_notes,
    } = input;

    // Get doctor with schedule validation
    const { data: doctor, error: doctorError } = await this.supabase
      .from('doctors')
      .select(`
        id, user_id, status, verification_status,
        consultation_types, consultation_duration,
        fee_in_person, fee_video, fee_chat,
        hospital_id,
        users!inner(full_name)
      `)
      .eq('id', doctor_id)
      .single();

    if (doctorError || !doctor) {
      throw new NotFoundError('Doctor');
    }

    if (doctor.status !== 'active' || doctor.verification_status !== 'verified') {
      throw new BadRequestError('Doctor is not available for appointments');
    }

    // Validate consultation type
    const supportedTypes = doctor.consultation_types as ConsultationType[];
    if (!supportedTypes.includes(consultation_type)) {
      throw new BadRequestError(`Doctor does not offer ${consultation_type} consultations`);
    }

    // Validate family member if provided
    if (family_member_id) {
      const { data: familyMember, error: fmError } = await this.supabase
        .from('family_members')
        .select('id, user_id')
        .eq('id', family_member_id)
        .eq('user_id', patientId)
        .single();

      if (fmError || !familyMember) {
        throw new BadRequestError('Invalid family member');
      }
    }

    // Calculate end time if not provided
    const duration = doctor.consultation_duration || APPOINTMENT_DURATIONS.DEFAULT;
    const calculatedEndTime = end_time || this.calculateEndTime(start_time, duration);

    // Check slot availability
    const isAvailable = await this.checkSlotAvailability(
      doctor_id,
      hospital_id || doctor.hospital_id,
      appointment_date,
      start_time,
      calculatedEndTime,
      consultation_type
    );

    if (!isAvailable) {
      throw new BadRequestError('Selected time slot is not available');
    }

    // Calculate fees
    const consultationFee = this.getConsultationFee(doctor, consultation_type);
    const platformFee = Math.round(consultationFee * (PLATFORM_FEES.PERCENTAGE / 100));
    const totalAmount = consultationFee + platformFee;

    // Generate booking ID
    const bookingId = this.generateBookingId();

    // Create appointment
    const { data: appointment, error: createError } = await this.supabase
      .from('appointments')
      .insert({
        booking_id: bookingId,
        patient_id: patientId,
        doctor_id: doctor_id,
        hospital_id: hospital_id || doctor.hospital_id,
        family_member_id: family_member_id || null,
        appointment_date: appointment_date,
        start_time: start_time,
        end_time: calculatedEndTime,
        consultation_type: consultation_type,
        status: 'pending_payment',
        symptoms: symptoms || null,
        patient_notes: patient_notes || null,
        consultation_fee: consultationFee,
        platform_fee: platformFee,
        total_amount: totalAmount,
        payment_status: 'pending',
      })
      .select()
      .single();

    if (createError) {
      this.log.error('Failed to create appointment', createError);
      throw new BadRequestError('Failed to book appointment');
    }

    // Get full appointment details
    const fullAppointment = await this.getById(appointment.id);

    this.log.info(`Appointment booked: ${bookingId}`, {
      appointmentId: appointment.id,
      patientId,
      doctorId: doctor_id,
      date: appointment_date,
    });

    return {
      appointment: fullAppointment,
      paymentRequired: true,
      amount: totalAmount,
    };
  }

  /**
   * Confirm appointment after payment
   */
  async confirmPayment(appointmentId: string, paymentId: string): Promise<AppointmentWithDetails> {
    const { data: appointment, error } = await this.supabase
      .from('appointments')
      .update({
        status: 'confirmed',
        payment_status: 'completed',
        payment_id: paymentId,
        paid_at: new Date().toISOString(),
      })
      .eq('id', appointmentId)
      .eq('status', 'pending_payment')
      .select()
      .single();

    if (error || !appointment) {
      throw new BadRequestError('Failed to confirm appointment payment');
    }

    return this.getById(appointmentId);
  }

  // ============================================================================
  // Read Operations
  // ============================================================================

  /**
   * Get appointment by ID with all details
   */
  async getById(appointmentId: string): Promise<AppointmentWithDetails> {
    const { data, error } = await this.supabase
      .from('appointments')
      .select(`
        *,
        patient:users!appointments_patient_id_fkey(
          id, full_name, phone, email, avatar_url, gender, date_of_birth
        ),
        family_member:family_members(
          id, full_name, relationship, gender, date_of_birth
        ),
        doctor:doctors!inner(
          id, user_id, title,
          users!inner(full_name, avatar_url),
          specializations(name)
        ),
        hospital:hospitals(
          id, name, slug, address, contact_phone
        ),
        consultation:consultations(*),
        prescription:prescriptions(*)
      `)
      .eq('id', appointmentId)
      .single();

    if (error || !data) {
      throw new NotFoundError('Appointment');
    }

    return this.transformAppointment(data);
  }

  /**
   * Get appointment by booking ID
   */
  async getByBookingId(bookingId: string): Promise<AppointmentWithDetails> {
    const { data, error } = await this.supabase
      .from('appointments')
      .select(`
        *,
        patient:users!appointments_patient_id_fkey(
          id, full_name, phone, email, avatar_url, gender, date_of_birth
        ),
        family_member:family_members(
          id, full_name, relationship, gender, date_of_birth
        ),
        doctor:doctors!inner(
          id, user_id, title,
          users!inner(full_name, avatar_url),
          specializations(name)
        ),
        hospital:hospitals(
          id, name, slug, address, contact_phone
        ),
        consultation:consultations(*),
        prescription:prescriptions(*)
      `)
      .eq('booking_id', bookingId)
      .single();

    if (error || !data) {
      throw new NotFoundError('Appointment');
    }

    return this.transformAppointment(data);
  }

  /**
   * List appointments with filters
   */
  async list(filters: AppointmentFilters): Promise<AppointmentListResponse> {
    const {
      patient_id,
      doctor_id,
      hospital_id,
      status,
      consultation_type,
      date_from,
      date_to,
      search,
      page = 1,
      limit = 20,
      sort_by = 'date',
      sort_order = 'desc',
    } = filters;

    let query = this.supabase
      .from('appointments')
      .select(`
        id, booking_id, appointment_date, start_time, end_time,
        consultation_type, status, symptoms, total_amount, payment_status,
        patient:users!appointments_patient_id_fkey(full_name, avatar_url),
        doctor:doctors!inner(users!inner(full_name, avatar_url)),
        hospital:hospitals(name)
      `, { count: 'exact' });

    // Apply filters
    if (patient_id) query = query.eq('patient_id', patient_id);
    if (doctor_id) query = query.eq('doctor_id', doctor_id);
    if (hospital_id) query = query.eq('hospital_id', hospital_id);
    if (consultation_type) query = query.eq('consultation_type', consultation_type);
    if (date_from) query = query.gte('appointment_date', date_from);
    if (date_to) query = query.lte('appointment_date', date_to);

    if (status) {
      if (Array.isArray(status)) {
        query = query.in('status', status);
      } else {
        query = query.eq('status', status);
      }
    }

    // Apply sorting
    const sortColumn = sort_by === 'date' ? 'appointment_date' : sort_by;
    query = query.order(sortColumn, { ascending: sort_order === 'asc' });
    query = query.order('start_time', { ascending: true });

    // Apply pagination
    const from = (page - 1) * limit;
    query = query.range(from, from + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      this.log.error('Failed to list appointments', error);
      throw new BadRequestError('Failed to fetch appointments');
    }

    const total = count || 0;
    const appointments: AppointmentListItem[] = (data || []).map((a: any) => ({
      id: a.id,
      booking_id: a.booking_id,
      appointment_date: a.appointment_date,
      start_time: a.start_time,
      end_time: a.end_time,
      consultation_type: a.consultation_type,
      status: a.status,
      patient_name: a.patient?.full_name || null,
      patient_avatar: a.patient?.avatar_url || null,
      doctor_name: a.doctor?.users?.full_name || null,
      doctor_avatar: a.doctor?.users?.avatar_url || null,
      hospital_name: a.hospital?.name || null,
      symptoms: a.symptoms,
      payment_status: a.payment_status,
      total_amount: a.total_amount,
    }));

    return {
      appointments,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasMore: page * limit < total,
    };
  }

  // ============================================================================
  // Status Transitions (State Machine)
  // ============================================================================

  /**
   * Update appointment status with state machine validation
   */
  async updateStatus(
    appointmentId: string,
    newStatus: AppointmentStatus,
    userId: string,
    role: 'patient' | 'doctor' | 'hospital' | 'admin',
    reason?: string
  ): Promise<AppointmentWithDetails> {
    const appointment = await this.getById(appointmentId);

    // Check access permission
    if (!this.hasAccess(appointment, userId, role)) {
      throw new ForbiddenError('You do not have permission to update this appointment');
    }

    // Validate state transition
    const transition = APPOINTMENT_TRANSITIONS.find(
      (t) => t.from === appointment.status && t.to === newStatus
    );

    if (!transition) {
      throw new BadRequestError(
        `Cannot transition from ${appointment.status} to ${newStatus}`
      );
    }

    if (!transition.allowed_roles.includes(role)) {
      throw new ForbiddenError(
        `Role ${role} cannot perform this status transition`
      );
    }

    // Prepare update data
    const updateData: Record<string, any> = { status: newStatus };
    const now = new Date().toISOString();

    switch (newStatus) {
      case 'checked_in':
        updateData.checked_in_at = now;
        break;
      case 'in_progress':
        updateData.started_at = now;
        break;
      case 'completed':
        updateData.completed_at = now;
        break;
      case 'cancelled':
        updateData.cancelled_at = now;
        updateData.cancelled_by = role;
        updateData.cancellation_reason = reason || null;
        break;
      case 'no_show':
        updateData.no_show_at = now;
        break;
    }

    const { error } = await this.supabase
      .from('appointments')
      .update(updateData)
      .eq('id', appointmentId);

    if (error) {
      throw new BadRequestError('Failed to update appointment status');
    }

    this.log.info(`Appointment status updated: ${appointment.booking_id}`, {
      appointmentId,
      from: appointment.status,
      to: newStatus,
      by: userId,
    });

    return this.getById(appointmentId);
  }

  /**
   * Check-in patient
   */
  async checkIn(
    appointmentId: string,
    userId: string,
    role: 'patient' | 'doctor' | 'hospital'
  ): Promise<AppointmentWithDetails> {
    return this.updateStatus(appointmentId, 'checked_in', userId, role);
  }

  /**
   * Cancel appointment
   */
  async cancel(
    appointmentId: string,
    userId: string,
    role: 'patient' | 'doctor' | 'hospital' | 'admin',
    input: CancelInput
  ): Promise<{ appointment: AppointmentWithDetails; refundAmount: number }> {
    const appointment = await this.updateStatus(
      appointmentId,
      'cancelled',
      userId,
      role,
      input.reason
    );

    // Calculate refund based on cancellation policy
    const refundAmount = this.calculateRefund(appointment);

    return { appointment, refundAmount };
  }

  /**
   * Reschedule appointment
   */
  async reschedule(
    appointmentId: string,
    userId: string,
    role: 'patient' | 'doctor' | 'hospital',
    input: RescheduleInput
  ): Promise<AppointmentWithDetails> {
    const appointment = await this.getById(appointmentId);

    // Validate current status
    if (!['confirmed', 'rescheduled'].includes(appointment.status)) {
      throw new BadRequestError('Cannot reschedule appointment in current status');
    }

    // Check access
    if (!this.hasAccess(appointment, userId, role)) {
      throw new ForbiddenError('You do not have permission to reschedule this appointment');
    }

    // Calculate new end time
    const duration = this.calculateDuration(appointment.start_time, appointment.end_time);
    const newEndTime = this.calculateEndTime(input.new_start_time, duration);

    // Check new slot availability
    const isAvailable = await this.checkSlotAvailability(
      appointment.doctor?.id || '',
      appointment.hospital?.id || null,
      input.new_date,
      input.new_start_time,
      newEndTime,
      appointment.consultation_type
    );

    if (!isAvailable) {
      throw new BadRequestError('New time slot is not available');
    }

    // Update appointment
    const { error } = await this.supabase
      .from('appointments')
      .update({
        status: 'rescheduled',
        appointment_date: input.new_date,
        start_time: input.new_start_time,
        end_time: newEndTime,
        rescheduled_from: `${appointment.appointment_date} ${appointment.start_time}`,
        reschedule_reason: input.reason || null,
        rescheduled_at: new Date().toISOString(),
      })
      .eq('id', appointmentId);

    if (error) {
      throw new BadRequestError('Failed to reschedule appointment');
    }

    this.log.info(`Appointment rescheduled: ${appointment.booking_id}`, {
      appointmentId,
      oldDate: appointment.appointment_date,
      newDate: input.new_date,
    });

    return this.getById(appointmentId);
  }

  /**
   * Mark as no-show
   */
  async markNoShow(
    appointmentId: string,
    userId: string,
    role: 'doctor' | 'hospital' | 'admin'
  ): Promise<AppointmentWithDetails> {
    return this.updateStatus(appointmentId, 'no_show', userId, role);
  }

  // ============================================================================
  // Consultation Operations
  // ============================================================================

  /**
   * Start consultation
   */
  async startConsultation(
    userId: string,
    input: StartConsultationInput
  ): Promise<ConsultationDetails> {
    const appointment = await this.getById(input.appointment_id);

    // Validate doctor access
    if (appointment.doctor?.user_id !== userId) {
      throw new ForbiddenError('Only the assigned doctor can start the consultation');
    }

    // Update appointment status
    await this.updateStatus(input.appointment_id, 'in_progress', userId, 'doctor');

    // Create consultation record
    const { data: consultation, error } = await this.supabase
      .from('consultations')
      .insert({
        appointment_id: input.appointment_id,
        doctor_id: appointment.doctor.id,
        patient_id: appointment.patient?.id,
        hospital_id: appointment.hospital?.id,
        consultation_type: appointment.consultation_type,
        status: 'in_progress',
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      throw new BadRequestError('Failed to start consultation');
    }

    this.log.info(`Consultation started: ${appointment.booking_id}`);

    return {
      ...consultation,
      appointment,
    };
  }

  /**
   * End consultation
   */
  async endConsultation(
    userId: string,
    input: EndConsultationInput
  ): Promise<AppointmentWithDetails> {
    const appointment = await this.getById(input.appointment_id);

    // Validate doctor access
    if (appointment.doctor?.user_id !== userId) {
      throw new ForbiddenError('Only the assigned doctor can end the consultation');
    }

    // Update consultation
    const { error: consultationError } = await this.supabase
      .from('consultations')
      .update({
        status: 'completed',
        ended_at: new Date().toISOString(),
        consultation_notes: input.consultation_notes || null,
        diagnosis: input.diagnosis || null,
      })
      .eq('appointment_id', input.appointment_id);

    if (consultationError) {
      this.log.error('Failed to update consultation', consultationError);
    }

    // Update appointment status
    await this.updateStatus(input.appointment_id, 'completed', userId, 'doctor');

    this.log.info(`Consultation completed: ${appointment.booking_id}`);

    return this.getById(input.appointment_id);
  }

  // ============================================================================
  // Prescription Operations
  // ============================================================================

  /**
   * Create prescription
   */
  async createPrescription(
    userId: string,
    input: CreatePrescriptionInput
  ): Promise<any> {
    const appointment = await this.getById(input.appointment_id);

    // Validate doctor access
    if (appointment.doctor?.user_id !== userId) {
      throw new ForbiddenError('Only the assigned doctor can create prescriptions');
    }

    // Create prescription
    const { data: prescription, error } = await this.supabase
      .from('prescriptions')
      .insert({
        appointment_id: input.appointment_id,
        doctor_id: appointment.doctor.id,
        patient_id: appointment.patient?.id,
        hospital_id: appointment.hospital?.id,
        diagnosis: input.diagnosis || null,
        medications: JSON.stringify(input.medications),
        lab_tests: input.lab_tests ? JSON.stringify(input.lab_tests) : null,
        radiology_tests: input.radiology_tests || null,
        advice: input.advice || null,
        follow_up_date: input.follow_up_date || null,
        follow_up_instructions: input.follow_up_instructions || null,
      })
      .select()
      .single();

    if (error) {
      throw new BadRequestError('Failed to create prescription');
    }

    this.log.info(`Prescription created for appointment: ${appointment.booking_id}`);

    return prescription;
  }

  // ============================================================================
  // Stats Operations
  // ============================================================================

  /**
   * Get appointment stats for a user
   */
  async getStats(
    userId: string,
    role: 'patient' | 'doctor' | 'hospital'
  ): Promise<AppointmentStats> {
    let query = this.supabase.from('appointments').select('status', { count: 'exact' });

    if (role === 'patient') {
      query = query.eq('patient_id', userId);
    } else if (role === 'doctor') {
      const { data: doctor } = await this.supabase
        .from('doctors')
        .select('id')
        .eq('user_id', userId)
        .single();
      if (doctor) {
        query = query.eq('doctor_id', doctor.id);
      }
    } else if (role === 'hospital') {
      const { data: hospital } = await this.supabase
        .from('hospitals')
        .select('id')
        .eq('admin_user_id', userId)
        .single();
      if (hospital) {
        query = query.eq('hospital_id', hospital.id);
      }
    }

    const { data: appointments } = await query;

    const today = new Date().toISOString().split('T')[0];
    const statusCounts: Record<string, number> = {};

    (appointments || []).forEach((a: any) => {
      statusCounts[a.status] = (statusCounts[a.status] || 0) + 1;
    });

    // Get today's count
    const { count: todayCount } = await this.supabase
      .from('appointments')
      .select('id', { count: 'exact', head: true })
      .eq('appointment_date', today);

    // Get upcoming count
    const { count: upcomingCount } = await this.supabase
      .from('appointments')
      .select('id', { count: 'exact', head: true })
      .gt('appointment_date', today)
      .in('status', ['confirmed', 'rescheduled']);

    return {
      total: appointments?.length || 0,
      pending: statusCounts['pending_payment'] || 0,
      confirmed: statusCounts['confirmed'] || 0,
      completed: statusCounts['completed'] || 0,
      cancelled: statusCounts['cancelled'] || 0,
      no_show: statusCounts['no_show'] || 0,
      today: todayCount || 0,
      upcoming: upcomingCount || 0,
    };
  }

  // ============================================================================
  // Slot Operations
  // ============================================================================

  /**
   * Get available slots for a doctor
   */
  async getAvailableSlots(
    doctorId: string,
    hospitalId: string | null,
    date: string,
    consultationType?: ConsultationType
  ): Promise<AvailableSlot[]> {
    // Get doctor's schedule for the day
    const dayOfWeek = new Date(date).getDay();
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayName = dayNames[dayOfWeek];

    const { data: schedule } = await this.supabase
      .from('doctor_schedules')
      .select('*')
      .eq('doctor_id', doctorId)
      .eq('day_of_week', dayName)
      .eq('is_active', true)
      .maybeSingle();

    if (!schedule) {
      return [];
    }

    // Get doctor's consultation duration
    const { data: doctor } = await this.supabase
      .from('doctors')
      .select('consultation_duration, fee_in_person, fee_video, fee_chat, consultation_types')
      .eq('id', doctorId)
      .single();

    const duration = doctor?.consultation_duration || APPOINTMENT_DURATIONS.DEFAULT;

    // Get existing appointments for the date
    const { data: existingAppointments } = await this.supabase
      .from('appointments')
      .select('start_time, end_time')
      .eq('doctor_id', doctorId)
      .eq('appointment_date', date)
      .not('status', 'in', '("cancelled", "no_show")');

    const bookedSlots = new Set(
      (existingAppointments || []).map((a: any) => a.start_time)
    );

    // Generate available slots
    const slots: AvailableSlot[] = [];
    const scheduleSlots = [
      { start: schedule.morning_start, end: schedule.morning_end },
      { start: schedule.afternoon_start, end: schedule.afternoon_end },
      { start: schedule.evening_start, end: schedule.evening_end },
    ];

    for (const slot of scheduleSlots) {
      if (!slot.start || !slot.end) continue;

      let currentTime = slot.start;
      while (currentTime < slot.end) {
        const endTime = this.calculateEndTime(currentTime, duration);

        if (endTime <= slot.end && !bookedSlots.has(currentTime)) {
          const fee = this.getConsultationFee(doctor, consultationType || 'in_person');
          
          slots.push({
            date,
            start_time: currentTime,
            end_time: endTime,
            consultation_types: doctor?.consultation_types || ['in_person'],
            remaining_capacity: 1,
            fee,
          });
        }

        currentTime = endTime;
      }
    }

    return slots;
  }

  /**
   * Check if a slot is available
   */
  private async checkSlotAvailability(
    doctorId: string,
    hospitalId: string | null,
    date: string,
    startTime: string,
    endTime: string,
    consultationType: ConsultationType
  ): Promise<boolean> {
    // Check for existing appointments at this slot
    const { count } = await this.supabase
      .from('appointments')
      .select('id', { count: 'exact', head: true })
      .eq('doctor_id', doctorId)
      .eq('appointment_date', date)
      .eq('start_time', startTime)
      .not('status', 'in', '("cancelled", "no_show")');

    return (count || 0) === 0;
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Transform database row to appointment type
   */
  private transformAppointment(data: any): AppointmentWithDetails {
    return {
      ...data,
      patient: data.patient ? {
        id: data.patient.id,
        full_name: data.patient.full_name,
        phone: data.patient.phone,
        email: data.patient.email,
        avatar_url: data.patient.avatar_url,
        gender: data.patient.gender,
        date_of_birth: data.patient.date_of_birth,
      } : undefined,
      family_member: data.family_member || null,
      doctor: data.doctor ? {
        id: data.doctor.id,
        user_id: data.doctor.user_id,
        full_name: data.doctor.users?.full_name || null,
        title: data.doctor.title,
        avatar_url: data.doctor.users?.avatar_url || null,
        specialization_name: data.doctor.specializations?.name || null,
      } : undefined,
      hospital: data.hospital || undefined,
      consultation: data.consultation || null,
      prescription: data.prescription || null,
      payment: data.payment || null,
    };
  }

  /**
   * Check user access to appointment
   */
  private hasAccess(
    appointment: AppointmentWithDetails,
    userId: string,
    role: 'patient' | 'doctor' | 'hospital' | 'admin'
  ): boolean {
    if (role === 'admin') return true;
    if (role === 'patient') return appointment.patient_id === userId;
    if (role === 'doctor') return appointment.doctor?.user_id === userId;
    if (role === 'hospital') {
      // Check if user is admin of the hospital
      return true; // TODO: Implement hospital admin check
    }
    return false;
  }

  /**
   * Generate unique booking ID
   */
  private generateBookingId(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `RZX${timestamp}${random}`;
  }

  /**
   * Get consultation fee based on type
   */
  private getConsultationFee(doctor: any, type: ConsultationType): number {
    switch (type) {
      case 'video':
        return doctor?.fee_video || doctor?.fee_in_person || 0;
      case 'chat':
        return doctor?.fee_chat || doctor?.fee_in_person || 0;
      default:
        return doctor?.fee_in_person || 0;
    }
  }

  /**
   * Calculate end time from start time and duration
   */
  private calculateEndTime(startTime: string, durationMinutes: number): string {
    const [hours, minutes] = startTime.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes + durationMinutes;
    const endHours = Math.floor(totalMinutes / 60);
    const endMinutes = totalMinutes % 60;
    return `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;
  }

  /**
   * Calculate duration between two times
   */
  private calculateDuration(startTime: string, endTime: string): number {
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    return (eh * 60 + em) - (sh * 60 + sm);
  }

  /**
   * Calculate refund amount based on cancellation policy
   */
  private calculateRefund(appointment: AppointmentWithDetails): number {
    const appointmentDate = new Date(`${appointment.appointment_date}T${appointment.start_time}`);
    const now = new Date();
    const hoursUntil = (appointmentDate.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursUntil >= 24) {
      return appointment.total_amount; // 100% refund
    } else if (hoursUntil >= 4) {
      return Math.round(appointment.total_amount * 0.75); // 75% refund
    } else if (hoursUntil >= 1) {
      return Math.round(appointment.total_amount * 0.50); // 50% refund
    }
    return 0; // No refund
  }
}

export const appointmentService = new AppointmentService();
