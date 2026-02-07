import { logger } from '../../config/logger.js';
import { NotFoundError, ForbiddenError, BadRequestError, ConflictError } from '../../common/errors/index.js';
import bcrypt from 'bcrypt';
import type {
  HospitalFilters,
  HospitalListResponse,
  HospitalStats,
  HospitalDashboard,
  UpdateHospitalInput,
  UpdatePaymentSettingsInput,
  HospitalListItem
} from './hospital.types.js';
import { hospitalRepository } from '../../database/repositories/hospital.repo.js';
import { userRepository } from '../../database/repositories/user.repo.js';
import { doctorRepository } from '../../database/repositories/doctor.repo.js';
import type { HospitalType, SubscriptionTier, VerificationStatus } from '../../types/database.types.js';

/**
 * Hospital Service 
 * Orchestrates hospital-related business logic and data access via repositories
 */
class HospitalService {
  private log = logger.child('HospitalService');
  private saltRounds = 10;

  /**
   * Get hospital by ID
   */
  async getById(hospitalId: string): Promise<any> {
    const hospital = await hospitalRepository.findWithRelations(hospitalId);
    if (!hospital) {
      throw new NotFoundError('Hospital not found');
    }
    return hospital;
  }

  /**
   * Get hospital by slug (public profile)
   */
  async getBySlug(slug: string): Promise<any> {
    const hospital = await hospitalRepository.findBySlugWithDoctors(slug);
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
        hospitals: result.data.map((h: any) => ({
          id: h.id,
          name: h.name,
          slug: h.slug,
          hospital_type: h.type as HospitalType,
          city: h.city,
          state: h.state,
          logo_url: h.logo_url,
          cover_image_url: h.cover_image_url,
          specializations: h.specializations,
          subscription_tier: h.subscription_tier as SubscriptionTier,
          verification_status: h.verification_status as VerificationStatus,
          rating: h.rating,
          total_ratings: h.total_ratings || 0,
          total_consultations: h.total_consultations || 0,
          emergency_24x7: h.emergency_24x7 || false,
          is_active: h.is_active || false,
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

    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    // Map input to database columns (Sync with HospitalRepository fields)
    const fieldMappings: Record<string, string> = {
      name: 'name',
      tagline: 'tagline',
      description: 'description',
      logo_url: 'logo_url',
      cover_image_url: 'cover_image_url',
      registration_number: 'registration_number',
      license_number: 'license_number',
      accreditations: 'accreditations',
      established_year: 'established_year',
      total_beds: 'total_beds',
      icu_beds: 'icu_beds',
      operating_theaters: 'operating_theaters',
      contact_phone: 'phone',
      contact_email: 'email',
      website_url: 'website',
      emergency_phone: 'emergency_phone',
      facilities: 'amenities',
      specializations: 'specializations',
      gstin: 'gstin',
      pan: 'pan',
      insurance_accepted: 'insurance_accepted',
      languages_spoken: 'languages_spoken',
      operating_hours: 'operating_hours',
      emergency_24x7: 'emergency_24x7',
      pharmacy_24x7: 'pharmacy_24x7',
      lab_24x7: 'lab_24x7',
      ambulance_service: 'ambulance_service',
      parking_available: 'parking_available',
      cafeteria_available: 'cafeteria_available',
      meta_title: 'meta_title',
      meta_description: 'meta_description',
      address: 'address',
      landmark: 'landmark',
      city: 'city',
      state: 'state',
      pincode: 'pincode',
      country: 'country',
    };

    for (const [inputKey, dbKey] of Object.entries(fieldMappings)) {
      if ((data as any)[inputKey] !== undefined) {
        updateData[dbKey] = (data as any)[inputKey];
      }
    }

    // Handle location JSONB
    if (data.latitude && data.longitude) {
      updateData.location = {
        type: 'Point',
        coordinates: [data.longitude, data.latitude]
      };
    }

    // Legacy/Alternate field support
    if ((data as any).specialties) updateData.specializations = (data as any).specialties;
    if ((data as any).amenities) updateData.amenities = (data as any).amenities;
    if ((data as any).website) updateData.website = (data as any).website;
    if ((data as any).phone) updateData.phone = (data as any).phone;
    if ((data as any).bed_count) updateData.bed_count = (data as any).bed_count;
    if ((data as any).totalBeds) updateData.bed_count = (data as any).totalBeds;

    // Bank Details JSONB
    if ((data as any).bankAccountName || (data as any).bankAccountNumber || (data as any).bankIfsc || (data as any).upiId) {
      const existingDetails = (hospital as any).bank_details || {};
      updateData.bank_details = {
        ...existingDetails,
        account_name: (data as any).bankAccountName ?? existingDetails.account_name,
        account_number: (data as any).bankAccountNumber ?? existingDetails.account_number,
        ifsc: (data as any).bankIfsc ?? existingDetails.ifsc,
        bank_branch: (data as any).bankBranch ?? existingDetails.bank_branch,
        upi_id: (data as any).upiId ?? existingDetails.upi_id,
      };
    }

    try {
      return await hospitalRepository.update(hospitalId, updateData);
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

    const updateData: any = {
      payment_gateway_enabled: data.payment_gateway_enabled,
      updated_at: new Date().toISOString(),
    };

    if (data.platform_fee_online !== undefined) updateData.platform_fee_online = data.platform_fee_online;
    if (data.platform_fee_in_person !== undefined) updateData.platform_fee_in_person = data.platform_fee_in_person;
    if (data.platform_fee_walk_in !== undefined) updateData.platform_fee_walk_in = data.platform_fee_walk_in;
    if (data.auto_settlement !== undefined) updateData.auto_settlement = data.auto_settlement;
    if (data.settlement_frequency !== undefined) updateData.settlement_frequency = data.settlement_frequency;

    // Bank details within updatePaymentSettings might map to the same JSONB if needed, 
    // but the original code seemed to update flat columns or a mix.
    // Consistent with update() method:
    if (data.bank_account_name) updateData.bank_account_name = data.bank_account_name;
    if (data.bank_account_number) updateData.bank_account_number = data.bank_account_number;
    if (data.bank_ifsc) updateData.bank_ifsc = data.bank_ifsc;
    if (data.bank_branch) updateData.bank_branch = data.bank_branch;
    if (data.upi_id) updateData.upi_id = data.upi_id;
    if (data.gstin) updateData.gstin = data.gstin;
    if (data.pan) updateData.pan = data.pan;

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
  async verify(hospitalId: string, data: any) {
    try {
      return await hospitalRepository.update(hospitalId, {
        verification_status: data.verification_status,
        verification_notes: data.verification_notes,
        is_verified: data.verification_status === 'verified',
        verified_at: data.verification_status === 'verified' ? new Date().toISOString() : null,
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
  async addStaff(hospitalId: string, userId: string, data: { name: string; phone: string; email?: string }): Promise<any> {
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

    // Generate default password: name@123
    const firstName = data.name.split(' ')[0].toLowerCase();
    const defaultPassword = `${firstName}@123`;
    const passwordHash = await bcrypt.hash(defaultPassword, this.saltRounds);

    try {
      // Create user with reception role
      const newUser = await userRepository.create({
        name: data.name,
        phone: data.phone,
        email: data.email || null,
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
        defaultPassword,
        message: 'Staff added successfully. Share the login credentials with the staff member.',
      };
    } catch (error) {
      this.log.error('Failed to add staff', error);
      throw new BadRequestError('Failed to add staff member');
    }
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
}

export const hospitalService = new HospitalService();


