import { logger } from '../../config/logger.js';
import { logger } from '../../config/logger.js';
import { formatToIST, formatAppointmentDate } from '../../common/utils/date.js';
import { notificationService } from '../../integrations/notification/notification.service.js';
import { NotificationPurpose, NotificationChannel } from '../../integrations/notification/notification.types.js';
import { NotFoundError, ForbiddenError, BadRequestError } from '../../common/errors/index.js';
import { PLATFORM_FEES, APPOINTMENT_DURATIONS } from '../../config/constants.js';
import { APPOINTMENT_TRANSITIONS } from './appointment.types.js';
import { appointmentRepository } from '../../database/repositories/appointment.repo.js';
import { doctorRepository } from '../../database/repositories/doctor.repo.js';
import { hospitalRepository } from '../../database/repositories/hospital.repo.js';
import { familyMemberRepository } from '../../database/repositories/family-member.repo.js';
import { userRepository } from '../../database/repositories/user.repo.js';
import { appointmentPolicy } from './appointment.policy.js';
import { paymentService } from '../payments/payment.service.js';
import type { AppointmentStatus, ConsultationType } from '../../types/database.types.js';
import type { CreateOrderResponse } from '../payments/payment.types.js';
import type {
  AppointmentWithDetails,
  AppointmentListItem,
  AppointmentFilters,
  AppointmentListResponse,
  AppointmentStats,
  BookAppointmentInput,
} from './appointment.types.js';

/**
 * Appointment Service - Business logic for appointment management
 */
class AppointmentService {
  private log = logger.child('AppointmentService');

  /**
   * Book a new appointment
   */
  async bookAppointment(
    patientId: string,
    input: BookAppointmentInput
  ): Promise<{
    appointment: AppointmentWithDetails;
    requiresPayment: boolean;
    amount: number;
    paymentOrder?: CreateOrderResponse;
  }> {
    const {
      doctorId,
      hospitalId,
      familyMemberId,
      appointmentDate,
      startTime,
      endTime,
      consultationType,
      symptoms,
      notes,
    } = input;

    // Get doctor with schedule validation
    const doctor = await doctorRepository.findWithRelations(doctorId);

    if (!doctor) {
      throw new NotFoundError('Doctor');
    }

    if (!doctor.is_active || doctor.verification_status !== 'verified') {
      throw new BadRequestError('Doctor is not available for appointments');
    }

    // Validate consultation type
    const supportedTypes = doctor.consultation_types as ConsultationType[] || [];
    if (!supportedTypes.includes(consultationType)) {
      throw new BadRequestError(`Doctor does not offer ${consultationType} consultations`);
    }

    // Validate family member if provided
    if (familyMemberId) {
      const familyMember = await familyMemberRepository.findByUserAndId(patientId, familyMemberId);
      if (!familyMember) {
        throw new BadRequestError('Invalid family member');
      }
    }

    // Calculate end time
    const duration = doctor.consultation_duration || APPOINTMENT_DURATIONS.DEFAULT;
    const calculatedEndTime = endTime || this.calculateEndTime(startTime, duration);

    // Check for duplicate booking (patient already has appointment with this doctor on this day)
    const hasExisting = await appointmentRepository.hasExistingAppointment(
      patientId,
      doctorId,
      appointmentDate
    );
    if (hasExisting) {
      throw new BadRequestError('You already have an appointment with this doctor on this date');
    }

    // Check slot availability with atomic locking
    const hospitalIdToUse = hospitalId || doctor.hospital_id;
    const availability = await appointmentRepository.checkSlotAvailability(
      doctorId,
      hospitalIdToUse,
      appointmentDate,
      startTime,
      consultationType,
      patientId
    );

    if (!availability.available) {
      throw new BadRequestError(availability.reason || 'Selected time slot is not available');
    }

    // Calculate fees
    const consultationFee = this.getConsultationFee(doctor, consultationType);
    // User Update: No platform fee charged to patient
    const platformFee = 0;
    const totalAmount = consultationFee;

    // Create appointment
    const appointment = await appointmentRepository.create({
      patient_id: patientId,
      doctor_id: doctorId,
      hospital_id: hospitalId || doctor.hospital_id,
      family_member_id: familyMemberId || null,
      slot_id: availability.slotId || null,
      scheduled_date: appointmentDate,
      scheduled_start: `${appointmentDate}T${startTime}:00+05:30`,
      scheduled_end: `${appointmentDate}T${calculatedEndTime}:00+05:30`,
      consultation_type: this.mapConsultationType(consultationType),
      status: 'pending_payment',
      patient_notes: notes || null,
      consultation_fee: consultationFee,
      platform_fee: platformFee,
      total_amount: totalAmount,
    } as any);

    if (!appointment) {
      throw new BadRequestError('Failed to book appointment');
    }

    // Get full appointment details
    const fullAppointment = await this.getById(appointment.id);

    this.log.info(`Appointment booked: ${fullAppointment.appointment_number}`, {
      appointmentId: appointment.id,
      patientId,
      doctorId: doctorId,
      date: appointmentDate,
    });

    // Generate payment order if required
    let paymentOrder: CreateOrderResponse | undefined;
    if (totalAmount > 0) {
      try {
        paymentOrder = await paymentService.createOrder(patientId, {
          appointment_id: appointment.id
        });
      } catch (error) {
        this.log.error(`Failed to create payment order for appointment ${appointment.id}`, error);
        // We still return the appointment, client can retry payment order creation
      }
    } else {
      // Free appointment - auto confirm
      await this.updateStatus(appointment.id, 'confirmed', 'system', 'admin');

      // Trigger Notification
      const fullAppt = await this.getById(appointment.id);
      await this.sendConfirmationNotification(fullAppt);
    }

    return {
      appointment: await this.getById(appointment.id),
      requiresPayment: totalAmount > 0,
      amount: totalAmount,
      paymentOrder,
    };
  }

  /**
   * Confirm appointment after payment
   */
  async confirmPayment(appointmentId: string, paymentId: string): Promise<AppointmentWithDetails> {
    const appointment = await appointmentRepository.update(appointmentId, {
      status: 'confirmed',
    });

    if (!appointment) {
      throw new BadRequestError('Failed to confirm appointment payment');
    }

    // TODO: Update payment record with paymentId and paid_at

    const fullAppt = await this.getById(appointmentId);
    await this.sendConfirmationNotification(fullAppt);

    return fullAppt;
  }

  /**
   * Get appointment by ID with all details
   */
  async getById(appointmentId: string): Promise<AppointmentWithDetails> {
    const data = await appointmentRepository.findByIdWithRelations(appointmentId);
    if (!data) {
      throw new NotFoundError('Appointment');
    }

    return this.transformAppointment(data);
  }

  /**
   * List appointments with filters
   */
  async list(filters: AppointmentFilters): Promise<AppointmentListResponse> {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const result = await appointmentRepository.findMany(filters, page, limit);
    const appointments = result.data;
    const total = result.total;

    const items: AppointmentListItem[] = (appointments || []).map((a: any) => ({
      id: a.id,
      bookingId: a.appointment_number,
      appointmentDate: a.scheduled_date,
      startTime: a.scheduled_start?.includes('T') ? a.scheduled_start.split('T')[1].substring(0, 5) : a.scheduled_start,
      endTime: a.scheduled_end?.includes('T') ? a.scheduled_end.split('T')[1].substring(0, 5) : a.scheduled_end,
      consultationType: a.consultation_type,
      status: a.status,
      patientName: a.patient?.name || null,
      patientAvatar: a.patient?.avatar_url || null,
      doctorName: a.doctors?.users?.name || a.doctor?.users?.name || null,
      doctorAvatar: a.doctors?.users?.avatar_url || a.doctor?.users?.avatar_url || null,
      doctorSpecialization: a.doctors?.specializations?.name || a.doctor?.specializations?.name || null,
      hospitalName: a.hospitals?.name || a.hospital?.name || null,
      hospitalAddress: a.hospitals?.address || a.hospital?.address || null,
      hospitalCity: a.hospitals?.city || a.hospital?.city || null,
      hospitalState: a.hospitals?.state || a.hospital?.state || null,
      symptoms: a.symptoms,
      paymentStatus: a.payment_status,
      totalAmount: a.total_amount,
      isFollowup: a.is_followup || false,
    }));

    const totalPages = Math.ceil(total / limit);
    const hasMore = page * limit < total;

    return {
      appointments: items,
      total,
      page,
      limit,
      totalPages,
      hasMore,
    };
  }

  /**
   * Update appointment status with state machine validation
   */
  async updateStatus(
    appointmentId: string,
    newStatus: AppointmentStatus,
    userId: string,
    role: any,
    reason?: string
  ): Promise<AppointmentWithDetails> {
    const appointment = await this.getById(appointmentId);

    // Check access permission via Policy
    if (!appointmentPolicy.canUpdate({ userId, role } as any, appointment)) {
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

    const updated = await appointmentRepository.update(appointmentId, updateData);

    if (!updated) {
      throw new BadRequestError('Failed to update appointment status');
    }

    this.log.info(`Appointment status updated: ${appointment.appointment_number}`, {
      appointmentId,
      from: appointment.status,
      to: newStatus,
      by: userId,
    });

    return this.getById(appointmentId);
  }

  /**
   * Reschedule appointment
   */
  async reschedule(
    appointmentId: string,
    userId: string,
    role: any,
    input: { newDate: string; newStartTime: string; reason?: string }
  ): Promise<AppointmentWithDetails> {
    const appointment = await this.getById(appointmentId);

    // Validate current status
    if (!['confirmed', 'rescheduled'].includes(appointment.status)) {
      throw new BadRequestError('Cannot reschedule appointment in current status');
    }

    // Check access via Policy
    if (!appointmentPolicy.canUpdate({ userId, role } as any, appointment)) {
      throw new ForbiddenError('You do not have permission to reschedule this appointment');
    }

    // Calculate new end time
    const duration = this.calculateDuration(appointment.start_time, appointment.end_time);
    const newEndTime = this.calculateEndTime(input.newStartTime, duration);

    // Check new slot availability
    const isBooked = await appointmentRepository.isSlotBooked(
      appointment.doctor_id,
      input.newDate,
      input.newStartTime
    );

    if (isBooked) {
      throw new BadRequestError('New time slot is not available');
    }

    // Update appointment
    const updated = await appointmentRepository.update(appointmentId, {
      status: 'rescheduled',
      scheduled_date: input.newDate,
      scheduled_start: `${input.newDate}T${input.newStartTime}:00+05:30`,
      scheduled_end: `${input.newDate}T${newEndTime}:00+05:30`,
      reason: input.reason || null,
      updated_at: new Date().toISOString(),
      // rescheduled_from is a UUID reference to appointments(id), skipping string date
    } as any);

    if (!updated) {
      throw new BadRequestError('Failed to reschedule appointment');
    }

    this.log.info(`Appointment rescheduled: ${appointment.appointment_number}`, {
      appointmentId,
      oldDate: appointment.appointment_date,
      newDate: input.newDate,
    });

    return this.getById(appointmentId);
  }

  /**
   * Get appointment stats
   */
  async getStats(
    userId: string,
    role: 'patient' | 'doctor' | 'hospital'
  ): Promise<AppointmentStats> {
    let filters: AppointmentFilters = {};

    if (role === 'patient') {
      filters.patient_id = userId;
    } else if (role === 'doctor') {
      const doctor = await doctorRepository.findByUserId(userId);
      if (doctor) {
        filters.doctor_id = doctor.id;
      }
    } else if (role === 'hospital') {
      const hospital = await hospitalRepository.findByUserId(userId);
      if (hospital) {
        filters.hospital_id = hospital.id;
      }
    }

    const { data } = await appointmentRepository.findMany({
      ...filters,
      limit: 1000 // Get enough for stats
    });

    const appointments = (data || []).map(a => this.transformAppointment(a));
    const today = new Date().toISOString().split('T')[0];
    const statusCounts: Record<string, number> = {};

    appointments.forEach((a: any) => {
      statusCounts[a.status] = (statusCounts[a.status] || 0) + 1;
    });

    const todayCount = appointments.filter((a: any) => a.appointment_date === today).length;
    const upcomingCount = appointments.filter((a: any) =>
      a.appointment_date > today && ['confirmed', 'rescheduled'].includes(a.status)
    ).length;

    return {
      total: appointments.length,
      pending: statusCounts['pending_payment'] || 0,
      confirmed: statusCounts['confirmed'] || 0,
      completed: statusCounts['completed'] || 0,
      cancelled: statusCounts['cancelled'] || 0,
      no_show: statusCounts['no_show'] || 0,
      today: todayCount,
      upcoming: upcomingCount,
    };
  }

  /**
   * Get available slots for a doctor
   */
  async getAvailableSlots(
    doctorId: string,
    hospitalId: string | null,
    date: string,
    consultationType?: ConsultationType
  ): Promise<any[]> {
    // Robust date parsing (avoid UTC shift issues)
    const [year, month, day] = date.split('-').map(Number);
    const dateObj = new Date(year, month - 1, day);
    const dayOfWeek = dateObj.getDay();
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayName = dayNames[dayOfWeek];

    const schedules = await doctorRepository.getScheduleByDay(doctorId, dayName);

    // Get current IST time for filtering today's slots
    const now = new Date();
    const currentISTDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now);
    const currentISTTime = new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(now);

    const isTodayInIST = date === currentISTDate;

    if (!schedules || schedules.length === 0) {
      return [];
    }

    const doctor = await doctorRepository.findWithRelations(doctorId);

    // Get existing appointments for the date
    const { data: appointments } = await appointmentRepository.findMany(
      {
        doctor_id: doctorId,
        scheduled_date: date,
        status: ['confirmed', 'checked_in', 'in_progress', 'rescheduled']
      },
      1,
      100
    );

    // Normalize booked slots to HH:mm from TIMESTAMPTZ - Converting to IST
    const bookedSlots = new Set(
      (appointments || []).map((a: any) => {
        if (!a.scheduled_start) return null;
        return formatToIST(a.scheduled_start);
      }).filter(Boolean)
    );

    // Generate available slots from all shifts
    const slots: any[] = [];

    // Check if doctor supports the requested consultation type (from their profile)
    const doctorTypes = (doctor?.consultation_types as string[]) || [];
    if (consultationType && doctorTypes.length > 0 && !doctorTypes.includes(consultationType)) {
      // Doctor doesn't support this consultation type at all
      return [];
    }

    for (const schedule of schedules) {
      // No longer filter by schedule.consultation_type - use doctor profile instead

      // Time normalization
      let currentTime = schedule.start_time?.substring(0, 5);
      const endTimeLimit = schedule.end_time?.substring(0, 5);

      if (!currentTime || !endTimeLimit) {
        continue;
      }

      const duration = schedule.slot_duration_minutes ||
        doctor?.slot_duration_minutes ||
        doctor?.consultation_duration ||
        APPOINTMENT_DURATIONS.DEFAULT;

      // Handle breaks if any
      const breakStart = schedule.break_start?.substring(0, 5);
      const breakEnd = schedule.break_end?.substring(0, 5);

      let iterations = 0;
      while (currentTime < endTimeLimit && iterations < 100) {
        iterations++;
        const nextTime = this.calculateEndTime(currentTime, duration);

        if (nextTime <= endTimeLimit) {
          // Check if it's during a break
          const isInBreak = breakStart && breakEnd && currentTime >= breakStart && currentTime < breakEnd;

          if (!isInBreak && !bookedSlots.has(currentTime)) {
            // Filter out past slots for today
            const isPastSlot = isTodayInIST && currentTime <= currentISTTime;

            if (!isPastSlot) {
              const fee = this.getConsultationFee(doctor, consultationType || schedule.consultation_type || 'in_person');

              slots.push({
                date,
                time: currentTime,
                startTime: currentTime, // Legacy support for SlotPicker
                endTime: nextTime,
                consultation_types: (doctor?.consultation_types as string[]) || ['in_person', 'online'],
                remaining_capacity: (schedule.max_patients_per_slot || doctor?.max_patients_per_slot || 1),
                available: true,
                isAvailable: true, // Legacy support for SlotPicker
                fee,
              });
            }
          }
        }

        currentTime = nextTime;
      }
    }

    // Sort slots by time
    return slots.sort((a, b) => a.time.localeCompare(b.time));
  }

  /**
   * Get fee breakdown for a specific doctor and consultation type
   */
  async getFeeBreakdown(
    doctorId: string,
    consultationType: ConsultationType,
    hospitalId?: string
  ): Promise<{
    consultationFee: number;
    platformFee: number;
    gstAmount: number;
    totalAmount: number;
  }> {
    const doctor = await doctorRepository.findWithRelations(doctorId);
    if (!doctor) {
      throw new NotFoundError('Doctor');
    }

    const consultationFee = this.getConsultationFee(doctor, consultationType);
    const platformFee = 0; // STRICT: No platform fee
    const gstAmount = 0; // STRICT: No GST
    const totalAmount = consultationFee;

    return {
      consultationFee,
      platformFee,
      gstAmount,
      totalAmount,
    };
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Transform database row to appointment type
   */
  private transformAppointment(data: any): AppointmentWithDetails {
    const doctorData = data.doctor || data.doctors;
    const hospitalData = data.hospital || data.hospitals;
    const consultationData = data.consultation;

    return {
      ...data,
      // Map DB names back to frontend expected names
      booking_id: data.appointment_number,
      bookingId: data.appointment_number,
      appointmentNumber: data.appointment_number,
      appointment_date: data.scheduled_date,
      appointmentDate: data.scheduled_date,

      // Preserve original timestamps for frontend
      scheduledStart: data.scheduled_start,
      scheduledEnd: data.scheduled_end,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      completedAt: data.completed_at,

      // Legacy formatted times (HH:mm) - Convering to IST
      start_time: formatToIST(data.scheduled_start),
      startTime: formatToIST(data.scheduled_start),
      end_time: formatToIST(data.scheduled_end),
      endTime: formatToIST(data.scheduled_end),

      // Explicit billing mapping
      consultationFee: data.consultation_fee,
      totalAmount: data.total_amount,

      consultationType: data.consultation_type,

      patient: data.patient ? {
        id: data.patient.id,
        name: data.patient.name,
        phone: data.patient.phone,
        email: data.patient.email,
        avatar_url: data.patient.avatar_url,
        gender: data.patient.gender,
        date_of_birth: data.patient.date_of_birth,
      } : undefined,

      // Address frontend requirement for top-level patient details
      patientName: data.patient?.name || 'Unknown Patient',
      patientPhone: data.patient?.phone || '',
      patientAge: data.patient?.date_of_birth ? new Date().getFullYear() - new Date(data.patient.date_of_birth).getFullYear() : null,
      patientGender: data.patient?.gender || null,

      family_member: data.family_member || null,

      doctor: doctorData ? {
        id: doctorData.id,
        user_id: doctorData.user_id,
        name: doctorData.users?.name || null,
        title: doctorData.title,
        profilePictureUrl: doctorData.users?.avatar_url || null,
        specialization: doctorData.specializations?.name || null,
      } : undefined,

      hospital: hospitalData || undefined,

      // Clinical data
      consultation: consultationData || null,
      vitals: consultationData?.vitals || null,
      notes: consultationData?.chief_complaint || data.patient_notes || null,

      prescription: data.prescription || null,
      payment: (() => {
        // Handle payment relation being an array (One-to-Many)
        const paymentData = Array.isArray(data.payment) ? data.payment[0] : data.payment;

        if (!paymentData) return null;

        return {
          id: paymentData.id,
          consultationFee: paymentData.base_amount || data.consultation_fee || 0,
          platformFee: paymentData.platform_fee || 0,
          gatewayFee: 0,
          gstAmount: paymentData.gst_amount || 0,
          totalAmount: paymentData.total_amount || data.total_amount || 0,
          discountAmount: paymentData.discount_amount || 0,
          finalAmount: paymentData.total_amount || data.total_amount || 0,
          status: paymentData.status,
          paidAt: paymentData.paid_at,
        };
      })(),
    };
  }



  /**
   * Get consultation fee based on type
   */
  private getConsultationFee(doctor: any, type: ConsultationType): number {
    switch (type) {
      case 'online':
        return doctor?.consultation_fee_online || doctor?.consultation_fee_in_person || 0;
      default:
        return doctor?.consultation_fee_in_person || 0;
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
   * Send appointment confirmation notification
   */
  private async sendConfirmationNotification(appointment: AppointmentWithDetails): Promise<void> {
    const patientName = appointment.patientName || 'Patient';
    const doctorName = appointment.doctor?.name ? `Dr. ${appointment.doctor.name}` : 'Doctor';
    const dateStr = formatAppointmentDate(appointment.appointmentDate, appointment.startTime);
    // Format consultation type: 'online' -> 'online', 'in_person' -> 'in-clinic'
    const typeStr = appointment.consultationType === 'online' ? 'online' : 'in-clinic';

    try {
      if (appointment.patientPhone) {
        await notificationService.send({
          purpose: NotificationPurpose.APPOINTMENT_CONFIRMED,
          phone: appointment.patientPhone,
          channel: NotificationChannel.WhatsApp,
          variables: {
            "1": patientName,
            "2": doctorName,
            "3": dateStr,
            "4": typeStr
          }
        });
      }
    } catch (error) {
      this.log.error('Failed to send appointment confirmation', error);
      // Don't fail the request, just log
    }
  }

  /**
   * Map ConsultationType to database enum values
   */
  private mapConsultationType(type: ConsultationType | string): "in_person" | "online" | "phone" | "home_visit" {
    if (type === 'video' || type === 'chat') return 'online';
    return type as any;
  }
}

export const appointmentService = new AppointmentService();
