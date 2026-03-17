import { logger } from '../../config/logger.js';
import { NotFoundError, ForbiddenError, BadRequestError, ConflictError } from '../../common/errors/index.js';
import bcrypt from 'bcrypt';
import { cacheGetOrSet, cacheInvalidate, CacheKeys, CacheTTL } from '../../config/redis.js';
import type {
  HospitalFilters,
  HospitalListResponse,
  HospitalStats,
  HospitalDashboard,
  HospitalListItem,
} from './hospital.types.js';
import type { UpdateHospitalInput, UpdatePaymentSettingsInput } from './hospital.validator.js';
import { hospitalRepository } from '../../database/repositories/hospital.repo.js';
import { userRepository } from '../../database/repositories/user.repo.js';
import { doctorRepository } from '../../database/repositories/doctor.repo.js';
import type { Hospital } from '../../types/database.types.js';

/**
 * Hospital Service 
 * Orchestrates hospital-related business logic and data access via repositories
 */
class HospitalService {
  private log = logger.child('HospitalService');
  private saltRounds = 10;

  /**
   * Get hospital by ID — cached for 2 minutes
   */
  async getById(hospitalId: string): Promise<any> {
    const hospital = await cacheGetOrSet(
      CacheKeys.hospitalProfile(hospitalId),
      () => hospitalRepository.findWithRelations(hospitalId),
      CacheTTL.HOSPITAL_PROFILE,
    );
    if (!hospital) {
      throw new NotFoundError('Hospital not found');
    }
    return hospital;
  }

  /**
   * Get hospital by slug (public profile) — cached for 2 minutes
   */
  async getBySlug(slug: string): Promise<any> {
    const hospital = await cacheGetOrSet(
      CacheKeys.hospitalBySlug(slug),
      () => hospitalRepository.findBySlugWithDoctors(slug),
      CacheTTL.HOSPITAL_PROFILE,
    );
    if (!hospital) {
      throw new NotFoundError('Hospital not found');
    }
    return hospital;
  }

  /**
   * List hospitals with filters (public)
   */
  async list(filters: HospitalFilters): Promise<HospitalListResponse> {
    try {
      const result = await hospitalRepository.findMany(filters);
      const page = filters.page || 1;
      const limit = Math.min(filters.limit || 20, 100);

      return {
        hospitals: result.data.map((h: any): HospitalListItem => ({
          id: h.id,
          name: h.name,
          slug: h.slug,
          type: h.type,
          city: h.city,
          state: h.state,
          logo_url: h.logo_url,
          banner_url: h.banner_url,
          verification_status: h.verification_status,
          rating: h.rating ?? 0,
          total_ratings: h.total_ratings ?? 0,
          total_appointments: h.total_appointments ?? 0,
          emergency_services: h.emergency_services ?? false,
          is_active: h.is_active ?? false,
        })),
        total: result.total,
        page,
        limit,
        totalPages: Math.ceil(result.total / limit),
        hasMore: (page * limit) < result.total,
      };
    } catch (error) {
      this.log.error('Failed to fetch hospitals', error);
      throw new BadRequestError('Failed to fetch hospitals');
    }
  }

  /**
   * Get hospital by user ID (admin)
   */
  async getByUserId(userId: string): Promise<any> {
    const hospital = await hospitalRepository.findByUserId(userId);
    if (!hospital) {
      return null;
    }
    return hospital;
  }

  /**
   * Update hospital profile
   */
  async update(hospitalId: string, userId: string, data: UpdateHospitalInput, isAdmin = false): Promise<any> {
    // Verify ownership (allow admins)
    const hospital = await hospitalRepository.findById(hospitalId);
    if (!hospital) {
      throw new NotFoundError('Hospital not found');
    }

    if (!isAdmin && hospital.admin_user_id !== userId) {
      throw new ForbiddenError('You do not have permission to update this hospital');
    }

    const updateData: Partial<Hospital> & { updated_at: string } = {
      updated_at: new Date().toISOString(),
    };

    // Direct field mappings — input field names match DB column names
    const directFields: (keyof UpdateHospitalInput)[] = [
      'name', 'description', 'short_description',
      'logo_url', 'banner_url', 'photos',
      'registration_number', 'accreditations', 'founding_year', 'number_of_employees',
      'address', 'landmark', 'city', 'state', 'pincode', 'country',
      'phone', 'alternate_phone', 'email', 'website',
      'facilities', 'accepted_insurance', 'payment_methods_accepted',
      'area_served', 'also_known_as', 'departments',
      'languages_spoken', 'emergency_services',
      'gstin', 'pan',
      'meta_title', 'meta_description', 'meta_keywords',
      'og_image_url', 'canonical_slug', 'noindex',
      'social_links', 'faq_content',
      'platform_commission_percent', 'medicine_commission_percent', 'commission_slab_id',
    ];

    for (const field of directFields) {
      if (data[field] !== undefined) {
        (updateData as any)[field] = data[field];
      }
    }

    // Handle working_hours JSONB
    if (data.working_hours !== undefined) {
      (updateData as any).working_hours = data.working_hours;
    }

    // Handle location — update latitude/longitude directly + location JSONB
    if (data.latitude !== undefined && data.longitude !== undefined) {
      (updateData as any).latitude = data.latitude;
      (updateData as any).longitude = data.longitude;
      (updateData as any).location = {
        type: 'Point',
        coordinates: [data.longitude, data.latitude],
      };
    }

    try {
      const updated = await hospitalRepository.update(hospitalId, updateData);
      // Invalidate cached hospital profiles
      await Promise.all([
        cacheInvalidate(CacheKeys.hospitalProfile(hospitalId)),
        hospital.slug ? cacheInvalidate(CacheKeys.hospitalBySlug(hospital.slug)) : Promise.resolve(),
      ]);
      return updated;
    } catch (error) {
      this.log.error('Failed to update hospital', error);
      throw new BadRequestError('Failed to update hospital');
    }
  }

  /**
   * Get hospital patients
   */
  async getPatients(hospitalId: string, filters: any = {}) {
    try {
      const result = await hospitalRepository.findPatients(hospitalId, filters);
      return {
        patients: result.patients,
        total: result.total,
        page: filters.page || 1,
        limit: filters.limit || 20
      };
    } catch (error) {
      this.log.error('Failed to fetch patients', error);
      throw new BadRequestError('Failed to fetch patients');
    }
  }

  /**
   * Get hospital appointments
   */
  async getAppointments(hospitalId: string, filters: any = {}) {
    try {
      const result = await hospitalRepository.findAppointments(hospitalId, filters);
      return {
        appointments: result.appointments,
        total: result.total,
        page: filters.page || 1,
        limit: filters.limit || 20
      };
    } catch (error) {
      this.log.error('Failed to fetch appointments', error);
      throw new BadRequestError('Failed to fetch appointments');
    }
  }

  /**
   * Get hospital payments
   */
  async getPayments(hospitalId: string, filters: any = {}) {
    try {
      const result = await hospitalRepository.findPayments(hospitalId, filters);
      return {
        payments: result.payments,
        total: result.total,
        page: filters.page || 1,
        limit: filters.limit || 20
      };
    } catch (error) {
      this.log.error('Failed to fetch payments', error);
      throw new BadRequestError('Failed to fetch payments');
    }
  }

  /**
   * Get hospital invoices
   */
  async getInvoices(hospitalId: string, filters: any = {}) {
    try {
      const result = await hospitalRepository.findInvoices(hospitalId, filters);
      return {
        invoices: result.invoices,
        total: result.total,
        page: filters.page || 1,
        limit: filters.limit || 20
      };
    } catch (error) {
      this.log.error('Failed to fetch invoices', error);
      throw new BadRequestError('Failed to fetch invoices');
    }
  }

  /**
   * Update payment settings
   */
  async updatePaymentSettings(hospitalId: string, userId: string, data: UpdatePaymentSettingsInput): Promise<any> {
    const hospital = await hospitalRepository.findById(hospitalId);
    if (!hospital) throw new NotFoundError('Hospital not found');

    if (hospital.admin_user_id !== userId) {
      throw new ForbiddenError('You do not have permission to update payment settings');
    }

    const updateData: Partial<Hospital> & { updated_at: string } = {
      updated_at: new Date().toISOString(),
    };

    if (data.platform_commission_percent !== undefined) {
      (updateData as any).platform_commission_percent = data.platform_commission_percent;
    }
    if (data.medicine_commission_percent !== undefined) {
      (updateData as any).medicine_commission_percent = data.medicine_commission_percent;
    }

    try {
      return await hospitalRepository.update(hospitalId, updateData);
    } catch (error) {
      this.log.error('Failed to update payment settings', error);
      throw new BadRequestError('Failed to update payment settings');
    }
  }

  /**
   * Get hospital dashboard data
   */
  async getDashboard(hospitalId: string, userId: string): Promise<HospitalDashboard> {
    const hospital = await hospitalRepository.findWithRelations(hospitalId);
    if (!hospital) throw new NotFoundError('Hospital not found');

    if (hospital.admin_user_id !== userId) {
      throw new ForbiddenError('Access denied');
    }

    if (!hospital.is_active) {
      throw new ForbiddenError('This hospital account has been deactivated. Please contact support.');
    }

    const [stats, recentAppointments, topDoctors] = await Promise.all([
      hospitalRepository.getStats(hospitalId),
      hospitalRepository.getRecentAppointments(hospitalId),
      hospitalRepository.getTopDoctors(hospitalId),
    ]);

    return {
      hospital,
      stats,
      recentAppointments,
      topDoctors,
      revenueChart: [],
      upcomingSettlement: null,
    };
  }

  /**
   * Get hospital statistics (Proxy to repository)
   */
  async getStats(hospitalId: string, userId: string, period?: string): Promise<HospitalStats> {
    const hospital = await hospitalRepository.findById(hospitalId);
    if (!hospital) throw new NotFoundError('Hospital not found');

    if (hospital.admin_user_id !== userId) {
      throw new ForbiddenError('Access denied');
    }

    if (!hospital.is_active) {
      throw new ForbiddenError('This hospital account has been deactivated. Please contact support.');
    }

    return await hospitalRepository.getStats(hospitalId);
  }

  /**
   * Get hospital doctors
   */
  async getDoctors(hospitalId: string) {
    return await hospitalRepository.getDoctors(hospitalId);
  }

  /**
   * Verify hospital (admin only)
   */
  async verify(hospitalId: string, data: { status: string; rejection_reason?: string; verified_by: string }) {
    try {
      const isVerified = data.status === 'verified';
      return await hospitalRepository.update(hospitalId, {
        verification_status: data.status as any,
        rejection_reason: data.rejection_reason || null,
        verified_at: isVerified ? new Date().toISOString() : null,
        verified_by: data.verified_by,
        updated_at: new Date().toISOString(),
      } as any);
    } catch (error) {
      this.log.error('Failed to verify hospital', error);
      throw new BadRequestError('Failed to verify hospital');
    }
  }

  /**
   * Update doctor settings
   */
  async updateDoctorSettings(doctorId: string, data: any): Promise<any> {
    try {
      const updated = await doctorRepository.update(doctorId, data);
      if (!updated) {
        throw new NotFoundError('Doctor settings not updated');
      }
      return updated;
    } catch (error) {
      this.log.error('Failed to update doctor settings', error);
      if (error instanceof NotFoundError) throw error;
      throw new BadRequestError('Failed to update doctor settings');
    }
  }

  // ============================================================================
  // Staff Management (Reception Users)
  // ============================================================================

  /**
   * Add reception staff to hospital
   * Creates user with reception role and links to hospital_staff
   */
  async addStaff(hospitalId: string, userId: string, data: { name: string; phone: string; email: string; password?: string }): Promise<any> {
    // Verify hospital ownership
    const hospital = await hospitalRepository.findById(hospitalId);
    if (!hospital) throw new NotFoundError('Hospital not found');
    if (hospital.admin_user_id !== userId) {
      throw new ForbiddenError('You do not have permission to add staff');
    }

    // Check if phone already registered
    const existingUser = await userRepository.findByPhone(data.phone);
    if (existingUser) {
      throw new ConflictError('A user with this phone number already exists');
    }

    // Password handling: Use provided password
    const passwordHash = await bcrypt.hash(data.password, this.saltRounds);

    try {
      // Create user with reception role
      const newUser = await userRepository.create({
        name: data.name,
        phone: data.phone,
        email: data.email,
        password_hash: passwordHash,
        role: 'reception',
        is_active: true,
        verification_status: 'verified',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as any);

      // Link to hospital_staff table
      await hospitalRepository.addStaff(hospitalId, newUser.id, 'reception');

      this.log.info(`Added reception staff ${newUser.id} to hospital ${hospitalId}`);

      return {
        id: newUser.id,
        name: newUser.name,
        phone: newUser.phone,
        email: newUser.email,
        role: 'reception',
        defaultPassword: data.password,
        message: 'Staff added successfully. Share the login credentials with the staff member.',
      };
    } catch (error) {
      this.log.error('Failed to add staff', error);
      throw new BadRequestError('Failed to add staff member');
    }
  }

  /**
   * Update hospital staff member
   */
  async updateStaff(hospitalId: string, staffId: string, data: { name?: string; phone?: string; email?: string; password?: string }): Promise<any> {
    const isLinked = await hospitalRepository.isStaffLinked(hospitalId, staffId);
    if (!isLinked) {
      throw new BadRequestError('Staff member does not belong to this hospital');
    }

    const updates: any = {};
    if (data.name) updates.name = data.name;
    if (data.phone) updates.phone = data.phone;
    if (data.email) updates.email = data.email;
    if (data.password) {
      updates.password_hash = await bcrypt.hash(data.password, this.saltRounds);
    }
    updates.updated_at = new Date().toISOString();

    const updatedUser = await userRepository.update(staffId, updates);
    if (!updatedUser) {
      throw new BadRequestError('Failed to update staff member');
    }

    return {
      id: updatedUser.id,
      name: updatedUser.name,
      phone: updatedUser.phone,
      email: updatedUser.email,
      message: 'Staff member updated successfully',
    };
  }

  /**
   * List all staff for a hospital
   */
  async listStaff(hospitalId: string, userId: string): Promise<any[]> {
    const hospital = await hospitalRepository.findById(hospitalId);
    if (!hospital) throw new NotFoundError('Hospital not found');
    if (hospital.admin_user_id !== userId) {
      throw new ForbiddenError('Access denied');
    }

    try {
      return await hospitalRepository.getStaff(hospitalId);
    } catch (error) {
      this.log.error('Failed to list staff', error);
      throw new BadRequestError('Failed to list staff');
    }
  }

  /**
   * Remove staff from hospital (soft delete)
   */
  async removeStaff(hospitalId: string, staffUserId: string, adminUserId: string): Promise<void> {
    const hospital = await hospitalRepository.findById(hospitalId);
    if (!hospital) throw new NotFoundError('Hospital not found');
    if (hospital.admin_user_id !== adminUserId) {
      throw new ForbiddenError('You do not have permission to remove staff');
    }

    try {
      // Deactivate user
      await userRepository.updateProfile(staffUserId, {
        is_active: false,
        updated_at: new Date().toISOString(),
      } as any);

      // Remove from hospital_staff
      await hospitalRepository.removeStaff(hospitalId, staffUserId);

      this.log.info(`Removed staff ${staffUserId} from hospital ${hospitalId}`);
    } catch (error) {
      this.log.error('Failed to remove staff', error);
      throw new BadRequestError('Failed to remove staff member');
    }
  }
  /**
   * Get payout settings (Bank Details)
   */
  async getPayoutSettings(hospitalId: string, userId: string): Promise<any> {
    const hospital = await hospitalRepository.findById(hospitalId);
    if (!hospital) throw new NotFoundError('Hospital not found');
    if (hospital.admin_user_id !== userId) {
      throw new ForbiddenError('Access denied');
    }

    const account = await hospitalRepository.getPayoutAccount(hospitalId);
    return account || { message: 'No payout account linked' };
  }

  /**
   * Update payout settings (Bank Details)
   * Note: In a real scenario, this should verify with the gateway or use a secure flow.
   */
  async updatePayoutSettings(hospitalId: string, userId: string, data: any): Promise<any> {
    const hospital = await hospitalRepository.findById(hospitalId);
    if (!hospital) throw new NotFoundError('Hospital not found');
    if (hospital.admin_user_id !== userId) {
      throw new ForbiddenError('Access denied');
    }

    // For MVP, we update the payout_accounts table directly.
    // In production, this should trigger a KYC flow with the payment gateway.
    try {
      return await hospitalRepository.updatePayoutAccount(hospitalId, {
        account_holder_name: data.account_holder_name,
        bank_name: data.bank_name,
        account_number_masked: data.account_number ? `XXXX${data.account_number.slice(-4)}` : undefined,
        ifsc_code: data.ifsc_code,
        // Mock gateway fields for MVP
        gateway_provider: 'razorpay',
        gateway_account_id: `acc_${Math.random().toString(36).substring(7)}`,
        is_active: true,
      });
    } catch (error) {
      this.log.error('Failed to update payout settings', error);
      throw new BadRequestError('Failed to update payout settings');
    }
  }

  /**
   * Update hospital facilities
   */
  async updateFacilities(hospitalId: string, userId: string, facilities: string[]): Promise<any> {
    const hospital = await hospitalRepository.findById(hospitalId);
    if (!hospital) throw new NotFoundError('Hospital not found');
    if (hospital.admin_user_id !== userId) {
      throw new ForbiddenError('Access denied');
    }

    try {
      return await hospitalRepository.updateFacilities(hospitalId, facilities);
    } catch (error) {
      this.log.error('Failed to update facilities', error);
      throw new BadRequestError('Failed to update facilities');
    }
  }
}

export const hospitalService = new HospitalService();


