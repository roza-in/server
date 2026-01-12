import { getSupabaseAdmin } from '../../config/db.js';
import { logger } from '../../common/logger.js';
import { NotFoundError, ForbiddenError, BadRequestError } from '../../common/errors.js';
import type { SubscriptionTier, VerificationStatus } from '../../types/database.types.js';
import type { HospitalFilters, HospitalListResponse, HospitalStats, HospitalDashboard, UpdateHospitalInput, UpdatePaymentSettingsInput, HospitalListItem } from './hospital.types.js';

/**
 * Hospital Service 
 */
class HospitalService {
  private logger = logger.child('HospitalService');
  private supabase = getSupabaseAdmin();

  /**
   * Get hospital by ID
   */
  async getById(hospitalId: string): Promise<any> {
    const { data: hospital, error } = await this.supabase
      .from('hospitals')
      .select(`*, admin:users!hospitals_admin_user_id_fkey(id, full_name, email, phone, avatar_url)`)
      .eq('id', hospitalId)
      .single();

    if (error || !hospital) {
      throw new NotFoundError('Hospital not found');
    }
    return hospital;
  }

  /**
   * Get hospital by slug (public profile)
   */
  async getBySlug(slug: string): Promise<any> {
    const { data: hospital, error } = await this.supabase
      .from('hospitals')
      .select('*')
      .eq('slug', slug)
      .eq('is_active', true)
      .single();

    if (error || !hospital) {
      throw new NotFoundError('Hospital not found');
    }

    // Get active doctors with their schedules
    const { data: doctors } = await this.supabase
      .from('doctors')
      .select(`
        *,
        user:users!doctors_user_id_fkey(id, full_name, avatar_url),
        specialization:specializations(id, name, display_name)
      `)
      .eq('hospital_id', (hospital as any).id)
      .eq('is_active', true)
      .eq('verification_status', 'verified');

    const hp = hospital as any;
    return {
      ...(hp || {}),
      doctors: (doctors || []) as any[],
    };
  }

  /**
   * List hospitals with filters (public)
   */
  async list(filters: HospitalFilters): Promise<HospitalListResponse> {
    const page = filters.page || 1;
    const limit = Math.min(filters.limit || 20, 100);
    const offset = (page - 1) * limit;

    let query = this.supabase
      .from('hospitals')
      .select('*', { count: 'exact' })
      .eq('is_active', true)
      .eq('verification_status', 'verified');

    // Apply filters
    if (filters.search) {
      query = query.or(`name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
    }
    if (filters.city) {
      query = query.ilike('address->>city', `%${filters.city}%`);
    }
    if (filters.state) {
      query = query.ilike('address->>state', `%${filters.state}%`);
    }
    if (filters.hospital_type) {
      query = (query as any).eq('hospital_type', filters.hospital_type as any);
    }
    if (filters.emergency_24x7) {
      query = (query as any).eq('emergency_24x7', true);
    }
    if (filters.min_rating) {
      query = (query as any).gte('rating', filters.min_rating);
    }

    // Sorting
    const sortBy = filters.sort_by || 'name';
    const sortOrder = filters.sort_order === 'desc' ? false : true;
    query = query.order(sortBy, { ascending: sortOrder });

    // Pagination
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      this.logger.error('Failed to fetch hospitals', error);
      throw new BadRequestError('Failed to fetch hospitals');
    }

    const total = count || 0;

    return {
      hospitals: (data || []) as HospitalListItem[],
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasMore: offset + limit < total,
    };
  }

  /**
   * Update hospital profile
   */
  async update(hospitalId: string, userId: string, data: UpdateHospitalInput, isAdmin = false): Promise<any> {
    // Verify ownership (allow admins)
    const hospital = await this.getById(hospitalId);
    if (!isAdmin && hospital?.admin_user_id !== userId) {
      throw new ForbiddenError('You do not have permission to update this hospital');
    }

    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    // Map input to database columns
    const fieldMappings: Record<string, string> = {
      name: 'name',
      tagline: 'tagline',
      description: 'description',
      logo_url: 'logo_url',
      cover_image_url: 'cover_image_url',
      gallery_urls: 'gallery_urls',
      // support both snake_case (server) and camelCase (client)
      registration_number: 'registration_number',
      registrationNumber: 'registration_number',
      license_number: 'license_number',
      licenseNumber: 'license_number',
      accreditations: 'accreditations',
      established_year: 'established_year',
      total_beds: 'total_beds',
      icu_beds: 'icu_beds',
      operating_theaters: 'operating_theaters',
      address: 'address',
      contact_phone: 'contact_phone',
      contact_email: 'contact_email',
      website_url: 'website_url',
      emergency_phone: 'emergency_phone',
      facilities: 'facilities',
      specializations: 'specializations',
      // Compliance identifiers
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
      // SEO / meta (DB columns are `meta_title` and `meta_description`)
      meta_title: 'meta_title',
      meta_description: 'meta_description',
      // Flags and verification fields
      is_active: 'is_active',
      is_featured: 'is_featured',
      verification_status: 'verification_status',
      is_verified: 'is_verified',
      verified_at: 'verified_at',
      verified_by: 'verified_by',
    };

    // Support alternate phone field from client
    if ((data as any).alternate_phone !== undefined) {
      updateData.alternate_phone = (data as any).alternate_phone;
    }

    for (const [inputKey, dbKey] of Object.entries(fieldMappings)) {
      if ((data as any)[inputKey] !== undefined) {
        updateData[dbKey] = (data as any)[inputKey];
      }
    }

    if ((data as any).facilities !== undefined) {
      updateData.amenities = (data as any).facilities;
    }
    if ((data as any).amenities !== undefined) {
      updateData.amenities = (data as any).amenities;
    }

    // Website may be sent as `website`, `websiteUrl` or `website_url`
    if ((data as any).website !== undefined) updateData.website = (data as any).website;
    if ((data as any).websiteUrl !== undefined) updateData.website = (data as any).websiteUrl;
    if ((data as any).website_url !== undefined) updateData.website = (data as any).website_url;

    // Phone may be sent as `phone` or `contact_phone`
    if ((data as any).phone !== undefined) updateData.phone = (data as any).phone;
    if ((data as any).contact_phone !== undefined) updateData.phone = (data as any).contact_phone;

    // Images/gallery
    if ((data as any).images !== undefined) updateData.images = (data as any).images;
    if ((data as any).gallery_urls !== undefined) updateData.images = (data as any).gallery_urls;

    // Beds: accept both camelCase and snake_case
    if ((data as any).totalBeds !== undefined) updateData.bed_count = (data as any).totalBeds;
    if ((data as any).bed_count !== undefined) updateData.bed_count = (data as any).bed_count;

    // Accept legacy key `specialties` from some clients
    if ((data as any).specialties !== undefined) {
      updateData.specializations = (data as any).specialties;
    }

    
    const { data: updated, error } = await this.supabase
      .from('hospitals')
      .update(updateData)
      .eq('id', hospitalId)
      .select()
      .single();

    if (error || !updated) {
      this.logger.error('Failed to update hospital', error);
      throw new BadRequestError('Failed to update hospital');
    }

    return updated as any;
  }

  /**
   * Update payment settings
   */
  async updatePaymentSettings(
    hospitalId: string,
    userId: string,
    data: UpdatePaymentSettingsInput
  ): Promise<any> {
    const hospital = await this.getById(hospitalId);
    if (hospital.admin_user_id !== userId) {
      throw new ForbiddenError('You do not have permission to update payment settings');
    }

    const updateData: any = {
      payment_gateway_enabled: data.payment_gateway_enabled,
      updated_at: new Date().toISOString(),
    };

    if (data.platform_fee_online !== undefined) {
      updateData.platform_fee_online = data.platform_fee_online;
    }
    if (data.platform_fee_in_person !== undefined) {
      updateData.platform_fee_in_person = data.platform_fee_in_person;
    }
    if (data.platform_fee_walk_in !== undefined) {
      updateData.platform_fee_walk_in = data.platform_fee_walk_in;
    }
    if (data.auto_settlement !== undefined) {
      updateData.auto_settlement = data.auto_settlement;
    }
    if (data.settlement_frequency !== undefined) {
      updateData.settlement_frequency = data.settlement_frequency;
    }
    if (data.bank_account_name !== undefined) {
      updateData.bank_account_name = data.bank_account_name;
    }
    if (data.bank_account_number !== undefined) {
      updateData.bank_account_number = data.bank_account_number;
    }
    if (data.bank_ifsc !== undefined) {
      updateData.bank_ifsc = data.bank_ifsc;
    }
    if (data.bank_branch !== undefined) {
      updateData.bank_branch = data.bank_branch;
    }
    if (data.upi_id !== undefined) {
      updateData.upi_id = data.upi_id;
    }
    if (data.gstin !== undefined) {
      updateData.gstin = data.gstin;
    }
    if (data.pan !== undefined) {
      updateData.pan = data.pan;
    }

    const { data: updated, error } = await this.supabase
      .from('hospitals')
      .update(updateData)
      .eq('id', hospitalId)
      .select()
      .single();

    if (error || !updated) {
      throw new BadRequestError('Failed to update payment settings');
    }

    return updated as any;
  }

  // =================================================================
  // Hospital Dashboard & Stats
  // =================================================================

  /**
   * Get hospital dashboard data
   */
  async getDashboard(hospitalId: string, userId: string): Promise<HospitalDashboard> {
    const hospital = await this.getById(hospitalId);
    if (hospital.admin_user_id !== userId) {
      throw new ForbiddenError('Access denied');
    }

    const [stats, recentAppointments, topDoctors] = await Promise.all([
      this.getStats(hospitalId),
      this.getRecentAppointments(hospitalId),
      this.getTopDoctors(hospitalId),
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
   * Get hospital statistics
   */
  async getStats(hospitalId: string): Promise<HospitalStats> {
    const today = new Date().toISOString().split('T')[0];
    const monthStart = new Date(new Date().setDate(1)).toISOString().split('T')[0];

    // Get doctor counts
    const { count: totalDoctors } = await this.supabase
      .from('doctors')
      .select('*', { count: 'exact', head: true })
      .eq('hospital_id', hospitalId);

    const { count: activeDoctors } = await this.supabase
      .from('doctors')
      .select('*', { count: 'exact', head: true })
      .eq('hospital_id', hospitalId)
      .eq('is_active', true);

    // Get appointment counts
    const { count: totalAppointments } = await this.supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true })
      .eq('hospital_id', hospitalId);

    const { count: todayAppointments } = await this.supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true })
      .eq('hospital_id', hospitalId)
      .eq('appointment_date', today);

    const { count: completedAppointments } = await this.supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true })
      .eq('hospital_id', hospitalId)
      .eq('status', 'completed');

    const { count: cancelledAppointments } = await this.supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true })
      .eq('hospital_id', hospitalId)
      .eq('status', 'cancelled');

    // Get revenue data (select only existing column and cast results to any[])
    const { data: revenueData } = await this.supabase
      .from('payments')
      .select('hospital_payout')
      .eq('hospital_id', hospitalId)
      .eq('status', 'completed');

    const totalRevenue = ((revenueData as any[]) || []).reduce((sum, p) => sum + (p.hospital_payout || 0), 0);

    const { data: monthlyRevenueData } = await this.supabase
      .from('payments')
      .select('hospital_payout')
      .eq('hospital_id', hospitalId)
      .eq('status', 'completed')
      .gte('paid_at', monthStart);

    const monthlyRevenue = ((monthlyRevenueData as any[]) || []).reduce((sum, p) => sum + (p.hospital_payout || 0), 0) || 0;

    // Get hospital rating
    const { data: hospitalData } = await this.supabase
      .from('hospitals')
      .select('rating, total_ratings')
      .eq('id', hospitalId)
      .single();

    return {
      totalDoctors: totalDoctors || 0,
      activeDoctors: activeDoctors || 0,
      totalPatients: 0, // Would need a patients table query
      totalAppointments: totalAppointments || 0,
      pendingAppointments: 0,
      completedAppointments: completedAppointments || 0,
      cancelledAppointments: cancelledAppointments || 0,
      todayAppointments: todayAppointments || 0,
      upcomingAppointments: 0,
      totalRevenue,
      monthlyRevenue,
      pendingSettlements: 0,
      platformFeesOwed: 0,
      rating: hospitalData?.rating || null,
      totalRatings: hospitalData?.total_ratings || 0,
    };
  }

  /**
   * Get recent appointments
   */
  private async getRecentAppointments(hospitalId: string) {
    const { data } = await this.supabase
      .from('appointments')
      .select(`
        id,
        booking_id,
        appointment_date,
        start_time,
        consultation_type,
        status,
        patient:users!appointments_patient_id_fkey(full_name),
        doctor:doctors!appointments_doctor_id_fkey(
          user:users!doctors_user_id_fkey(full_name)
        )
      `)
      .eq('hospital_id', hospitalId)
      .order('created_at', { ascending: false })
      .limit(10);

    return (data || []).map((a: any) => ({
      id: a.id,
      booking_id: a.booking_id,
      patient_name: a.patient?.full_name || 'Unknown',
      doctor_name: a.doctor?.user?.full_name || 'Unknown',
      appointment_date: a.appointment_date,
      start_time: a.start_time,
      consultation_type: a.consultation_type,
      status: a.status,
      payment_status: 'completed',
    }));
  }

  /**
   * Get top performing doctors
   */
  private async getTopDoctors(hospitalId: string) {
    const { data } = await this.supabase
      .from('doctors')
      .select(`
        id,
        total_consultations,
        rating,
        total_ratings,
        user:users!doctors_user_id_fkey(full_name),
        specialization:specializations(display_name)
      `)
      .eq('hospital_id', hospitalId)
      .eq('is_active', true)
      .order('total_consultations', { ascending: false })
      .limit(5);

    return (data || []).map((d: any) => ({
      id: d.id,
      name: d.user?.full_name || 'Unknown',
      specialization: d.specialization?.display_name || 'General',
      total_consultations: d.total_consultations || 0,
      rating: d.rating,
      total_ratings: d.total_ratings || 0,
      revenue_generated: 0,
    }));
  }

  // =================================================================
  // Doctor Management
  // =================================================================

  /**
   * Get hospital doctors
   */
  async getDoctors(hospitalId: string) {
    const { data, error } = await this.supabase
      .from('doctors')
      .select(`
        *,
        user:users!doctors_user_id_fkey(id, full_name, avatar_url, phone, email),
        specialization:specializations(id, name, display_name)
      `)
      .eq('hospital_id', hospitalId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new BadRequestError('Failed to fetch doctors');
    }

    return data || [];
  }

  /**
   * Add doctor to hospital
   */
  async addDoctor(hospitalId: string, userId: string, doctorData: any) {
    const hospital = await this.getById(hospitalId);
    if (hospital.admin_user_id !== userId) {
      throw new ForbiddenError('Access denied');
    }

    // Check if user with this phone already exists
    const { data: existingUser } = await this.supabase
      .from('users')
      .select('id, role')
      .eq('phone', doctorData.phone)
      .single();

    let doctorUserId: string;

    if (existingUser) {
      if (existingUser.role === 'doctor') {
        throw new BadRequestError('This phone number is already registered as a doctor');
      }
      doctorUserId = existingUser.id;
      
      // Update user to doctor role
      await this.supabase
        .from('users')
        .update({
          role: 'doctor',
          full_name: doctorData.fullName,
          email: doctorData.email,
        })
        .eq('id', existingUser.id);
    } else {
      // Create new user
      const { data: newUser, error: userError } = await this.supabase
        .from('users')
        .insert({
          phone: doctorData.phone,
          full_name: doctorData.fullName,
          email: doctorData.email || null,
          role: 'doctor',
          is_active: true,
        })
        .select()
        .single();

      if (userError || !newUser) {
        throw new BadRequestError('Failed to create doctor user');
      }
      doctorUserId = (newUser as any).id;
    }

    // Create doctor record (use column names from migrations)
    const { data: doctor, error: doctorError } = await this.supabase
      .from('doctors')
      .insert(({
        user_id: doctorUserId,
        hospital_id: hospitalId,
        registration_number: (doctorData as any).medicalRegistrationNumber || (doctorData as any).registrationNumber || null,
        registration_council: (doctorData as any).registrationCouncil || null,
        license_number: (doctorData as any).licenseNumber || null,
        specialization_id: (doctorData as any).specializationId || null,
        specialization: (doctorData as any).specialization || null,
        sub_specializations: (doctorData as any).subSpecializations || null,
        qualifications: doctorData.qualifications || null,
        years_of_experience: (doctorData as any).experienceYears || (doctorData as any).yearsOfExperience || 0,
        bio: doctorData.bio || null,
        consultation_fee: (doctorData as any).consultationFeeInPerson || (doctorData as any).consultation_fee || 0,
        online_consultation_fee: (doctorData as any).consultationFeeOnline || (doctorData as any).online_consultation_fee || 0,
        follow_up_fee: (doctorData as any).consultationFeeWalkIn || (doctorData as any).follow_up_fee || null,
        home_visit_fee: (doctorData as any).homeVisitFee || null,
        consultation_duration: doctorData.consultationDuration || 15,
        languages: doctorData.languagesSpoken || ['English', 'Hindi'],
        verification_status: 'pending',
        is_active: true,
      } as any))
      .select()
      .single();

    if (doctorError || !doctor) {
      this.logger.error('Failed to create doctor', doctorError);
      throw new BadRequestError('Failed to create doctor');
    }

    return doctor;
  }

  /**
   * Remove doctor from hospital
   */
  async removeDoctor(hospitalId: string, doctorId: string, userId: string) {
    const hospital = await this.getById(hospitalId);
    if (hospital.admin_user_id !== userId) {
      throw new ForbiddenError('Access denied');
    }

    const { error } = await this.supabase
      .from('doctors')
      .update({ is_active: false, hospital_id: null })
      .eq('id', doctorId)
      .eq('hospital_id', hospitalId);

    if (error) {
      throw new BadRequestError('Failed to remove doctor');
    }

    return { success: true };
  }

  // =================================================================
  // Verification (Admin)
  // =================================================================

  /**
   * Verify hospital (admin only)
   */
  async verifyHospital(
    hospitalId: string,
    status: VerificationStatus,
    notes?: string
  ): Promise<any> {
    const { data, error } = await this.supabase
      .from('hospitals')
      .update({
        verification_status: status,
        verification_notes: notes || null,
        verified_at: status === 'verified' ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', hospitalId)
      .select()
      .single();

    if (error || !data) {
      throw new BadRequestError('Failed to update verification status');
    }

    // TODO: Send notification to hospital admin

    return data as any;
  }

  /**
   * Get hospitals pending verification (admin)
   */
  async getPendingVerifications() {
    const { data, error } = await this.supabase
      .from('hospitals')
      .select(`
        *,
        admin:users!hospitals_admin_user_id_fkey(full_name, email, phone)
      `)
      .eq('verification_status', 'pending')
      .order('created_at', { ascending: true });

    if (error) {
      throw new BadRequestError('Failed to fetch pending verifications');
    }

    return data || [];
  }

  // =================================================================
  // Subscription Management
  // =================================================================

  /**
   * Update hospital subscription
   */
  async updateSubscription(
    hospitalId: string,
    tier: SubscriptionTier,
    startsAt: string,
    endsAt: string
  ): Promise<any> {
    const { data, error } = await this.supabase
      .from('hospitals')
      .update({
        subscription_tier: tier,
        subscription_starts_at: startsAt,
        subscription_ends_at: endsAt,
        updated_at: new Date().toISOString(),
      })
      .eq('id', hospitalId)
      .select()
      .single();

    if (error || !data) {
      throw new BadRequestError('Failed to update subscription');
    }

    return data as any;
  }
}

// Export singleton instance
export const hospitalService = new HospitalService();
