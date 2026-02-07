import { supabaseAdmin } from '../../database/supabase-admin.js';
import { logger } from '../../config/logger.js';
import { NotFoundError, ForbiddenError, BadRequestError } from '../../common/errors/index.js';
import type {
  FamilyMember,
  FamilyMemberWithHealth,
  CreateFamilyMemberInput,
  UpdateFamilyMemberInput,
  HealthDocument,
  DocumentWithDetails,
  UploadDocumentInput,
  UpdateDocumentInput,
  DocumentFilters,
  VitalRecord,
  CreateVitalRecordInput,
  VitalFilters,
  VitalTrends,
  Medication,
  MedicationWithReminders,
  CreateMedicationInput,
  UpdateMedicationInput,
  MedicationReminder,
  ReminderAction,
  ReminderFilters,
  Allergy,
  CreateAllergyInput,
  MedicalCondition,
  HealthSummary,
  FamilyHealthSummary,
} from './health-records.types.js';

/**
 * Health Records Service - Production-ready health data management
 * Features: Family members, documents, vitals, medications, reminders
 */
class HealthRecordsService {
  private log = logger.child('HealthRecordsService');
  private supabase = supabaseAdmin;

  // ============================================================================
  // Family Members
  // ============================================================================

  /**
   * Create family member
   */
  async createFamilyMember(
    userId: string,
    input: CreateFamilyMemberInput
  ): Promise<FamilyMember> {
    const { data, error } = await this.supabase
      .from('family_members')
      .insert({
        user_id: userId,
        ...input,
      })
      .select()
      .single();

    if (error) {
      this.log.error('Failed to create family member', error);
      throw new BadRequestError('Failed to create family member');
    }

    this.log.info('Family member created', { userId, memberId: (data as any).id });
    return data as unknown as FamilyMember;
  }

  /**
   * Get family member by ID
   */
  async getFamilyMember(
    memberId: string,
    userId: string
  ): Promise<FamilyMemberWithHealth> {
    const { data, error } = await this.supabase
      .from('family_members')
      .select('*')
      .eq('id', memberId)
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      throw new NotFoundError('Family member');
    }

    // Get related health data
    const [vitals, medications, reminders, documents] = await Promise.all([
      this.getLatestVitals(userId, memberId),
      this.getActiveMedications(userId, memberId),
      this.getUpcomingReminders(userId, memberId),
      this.listDocuments({ user_id: userId, family_member_id: memberId, limit: 5 }),
    ]);

    return {
      ...(data as unknown as FamilyMember),
      latest_vitals: vitals,
      active_medications: medications,
      upcoming_reminders: reminders,
      recent_documents: documents.documents,
    } as FamilyMemberWithHealth;
  }

  /**
   * List family members
   */
  async listFamilyMembers(userId: string): Promise<FamilyMember[]> {
    const { data, error } = await this.supabase
      .from('family_members')
      .select('*')
      .eq('user_id', userId)
      .order('is_primary', { ascending: false })
      .order('name');

    if (error) {
      throw new BadRequestError('Failed to fetch family members');
    }

    return (data || []) as unknown as FamilyMember[];
  }

  /**
   * Update family member
   */
  async updateFamilyMember(
    memberId: string,
    userId: string,
    input: UpdateFamilyMemberInput
  ): Promise<FamilyMember> {
    const { data, error } = await this.supabase
      .from('family_members')
      .update({
        ...input,
        updated_at: new Date().toISOString(),
      })
      .eq('id', memberId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error || !data) {
      throw new BadRequestError('Failed to update family member');
    }

    return data as unknown as FamilyMember;
  }

  /**
   * Delete family member
   */
  async deleteFamilyMember(memberId: string, userId: string): Promise<void> {
    const { error } = await this.supabase
      .from('family_members')
      .delete()
      .eq('id', memberId)
      .eq('user_id', userId);

    if (error) {
      throw new BadRequestError('Failed to delete family member');
    }
  }

  // ============================================================================
  // Health Documents
  // ============================================================================

  /**
   * Upload document
   */
  async uploadDocument(
    userId: string,
    input: UploadDocumentInput
  ): Promise<HealthDocument> {
    // Validate family member if provided
    if (input.family_member_id) {
      const { data: member } = await this.supabase
        .from('family_members')
        .select('id')
        .eq('id', input.family_member_id)
        .eq('user_id', userId)
        .single();

      if (!member) {
        throw new BadRequestError('Invalid family member');
      }
    }

    const { data, error } = await this.supabase
      .from('health_documents')
      .insert({
        user_id: userId,
        uploaded_by: userId,
        ...input,
      })
      .select()
      .single();

    if (error) {
      this.log.error('Failed to upload document', error);
      throw new BadRequestError('Failed to upload document');
    }

    this.log.info('Document uploaded', { userId, documentId: data.id });
    return data;
  }

  /**
   * Get document by ID
   */
  async getDocument(documentId: string, userId: string): Promise<DocumentWithDetails> {
    const { data, error } = await this.supabase
      .from('health_documents')
      .select(`
        *,
        family_member:family_members(id, name),
        appointment:appointments(
          id, appointment_number, scheduled_date, scheduled_start,
          doctor:doctors(users(name))
        )
      `)
      .eq('id', documentId)
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      throw new NotFoundError('Document');
    }

    return {
      ...data,
      appointment: data.appointment
        ? {
          id: data.appointment.id,
          booking_id: data.appointment.appointment_number,
          appointment_date: data.appointment.scheduled_date,
          doctor_name: data.appointment.doctor?.users?.name || null,
        }
        : null,
    };
  }

  /**
   * List documents
   */
  async listDocuments(
    filters: DocumentFilters
  ): Promise<{ documents: HealthDocument[]; total: number }> {
    const {
      user_id,
      family_member_id,
      appointment_id,
      document_type,
      tags,
      date_from,
      date_to,
      search,
      page = 1,
      limit = 20,
    } = filters;

    let query = this.supabase
      .from('health_documents')
      .select('*', { count: 'exact' });

    if (user_id) query = query.eq('user_id', user_id);
    if (family_member_id) query = query.eq('family_member_id', family_member_id);
    if (appointment_id) query = query.eq('appointment_id', appointment_id);
    if (date_from) query = query.gte('created_at', date_from);
    if (date_to) query = query.lte('created_at', date_to);
    if (search) {
      // SECURITY: Sanitize search input to prevent PostgREST filter injection
      const sanitizedSearch = search
        .replace(/[%_(),.]/g, '') // Remove special PostgREST filter characters
        .replace(/'/g, "''")       // Escape single quotes
        .substring(0, 100);        // Limit length to prevent abuse
      if (sanitizedSearch.length > 0) {
        query = query.ilike('title', `%${sanitizedSearch}%`);
      }
    }

    if (document_type) {
      if (Array.isArray(document_type)) {
        query = query.in('document_type', document_type);
      } else {
        query = query.eq('document_type', document_type);
      }
    }

    if (tags && tags.length > 0) {
      query = query.overlaps('tags', tags);
    }

    query = query.order('created_at', { ascending: false });

    const from = (page - 1) * limit;
    query = query.range(from, from + limit - 1);

    const { data, count, error } = await query;

    if (error) {
      throw new BadRequestError('Failed to fetch documents');
    }

    return {
      documents: data || [],
      total: count || 0,
    };
  }

  /**
   * Update document
   */
  async updateDocument(
    documentId: string,
    userId: string,
    input: UpdateDocumentInput
  ): Promise<HealthDocument> {
    const { data, error } = await this.supabase
      .from('health_documents')
      .update({
        ...input,
        updated_at: new Date().toISOString(),
      })
      .eq('id', documentId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error || !data) {
      throw new BadRequestError('Failed to update document');
    }

    return data;
  }

  /**
   * Delete document
   */
  async deleteDocument(documentId: string, userId: string): Promise<void> {
    // Get document to delete file from storage
    const { data: doc } = await this.supabase
      .from('health_documents')
      .select('file_url')
      .eq('id', documentId)
      .eq('user_id', userId)
      .single();

    if (!doc) {
      throw new NotFoundError('Document');
    }

    // Delete from database
    const { error } = await this.supabase
      .from('health_documents')
      .delete()
      .eq('id', documentId)
      .eq('user_id', userId);

    if (error) {
      throw new BadRequestError('Failed to delete document');
    }

    // TODO: Delete file from storage
  }

  // ============================================================================
  // Vitals
  // ============================================================================

  /**
   * Record vitals
   */
  async recordVitals(
    userId: string,
    input: CreateVitalRecordInput
  ): Promise<VitalRecord> {
    // Calculate BMI if weight and height provided
    let bmi: number | null = null;
    if (input.weight && input.height) {
      const weightKg = input.weight_unit === 'lb' ? input.weight * 0.453592 : input.weight;
      const heightM = input.height_unit === 'ft' ? input.height * 0.3048 : input.height / 100;
      bmi = Math.round((weightKg / (heightM * heightM)) * 10) / 10;
    }

    const { data, error } = await this.supabase
      .from('vital_records')
      .insert({
        user_id: userId,
        ...input,
        bmi,
        recorded_at: input.recorded_at || new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      this.log.error('Failed to record vitals', error);
      throw new BadRequestError('Failed to record vitals');
    }

    this.log.info('Vitals recorded', { userId, vitalId: data.id });
    return data;
  }

  /**
   * Get latest vitals
   */
  async getLatestVitals(
    userId: string,
    familyMemberId?: string
  ): Promise<VitalRecord | null> {
    let query = this.supabase
      .from('vital_records')
      .select('*')
      .eq('user_id', userId)
      .order('recorded_at', { ascending: false })
      .limit(1);

    if (familyMemberId) {
      query = query.eq('family_member_id', familyMemberId);
    } else {
      query = query.is('family_member_id', null);
    }

    const { data } = await query.single();
    return data || null;
  }

  /**
   * List vitals
   */
  async listVitals(
    filters: VitalFilters
  ): Promise<{ vitals: VitalRecord[]; total: number }> {
    const { user_id, family_member_id, date_from, date_to, page = 1, limit = 20 } = filters;

    let query = this.supabase
      .from('vital_records')
      .select('*', { count: 'exact' });

    if (user_id) query = query.eq('user_id', user_id);
    if (family_member_id) query = query.eq('family_member_id', family_member_id);
    if (date_from) query = query.gte('recorded_at', date_from);
    if (date_to) query = query.lte('recorded_at', date_to);

    query = query.order('recorded_at', { ascending: false });

    const from = (page - 1) * limit;
    query = query.range(from, from + limit - 1);

    const { data, count, error } = await query;

    if (error) {
      throw new BadRequestError('Failed to fetch vitals');
    }

    return {
      vitals: data || [],
      total: count || 0,
    };
  }

  /**
   * Get vital trends
   */
  async getVitalTrends(
    userId: string,
    familyMemberId: string | null,
    days: number = 30
  ): Promise<VitalTrends[]> {
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);

    let query = this.supabase
      .from('vital_records')
      .select('*')
      .eq('user_id', userId)
      .gte('recorded_at', fromDate.toISOString())
      .order('recorded_at');

    if (familyMemberId) {
      query = query.eq('family_member_id', familyMemberId);
    } else {
      query = query.is('family_member_id', null);
    }

    const { data } = await query;

    if (!data || data.length === 0) return [];

    // Group by day
    const grouped = new Map<string, VitalRecord[]>();
    data.forEach((v) => {
      const day = v.recorded_at.split('T')[0];
      if (!grouped.has(day)) grouped.set(day, []);
      grouped.get(day)!.push(v);
    });

    // Calculate averages per day
    const trends: VitalTrends[] = [];
    grouped.forEach((records, period) => {
      const avg = (arr: (number | null)[]) => {
        const valid = arr.filter((n): n is number => n !== null);
        return valid.length > 0 ? Math.round((valid.reduce((a, b) => a + b, 0) / valid.length) * 10) / 10 : null;
      };

      trends.push({
        period,
        avg_systolic: avg(records.map((r) => r.blood_pressure_systolic)),
        avg_diastolic: avg(records.map((r) => r.blood_pressure_diastolic)),
        avg_heart_rate: avg(records.map((r) => r.heart_rate)),
        avg_weight: avg(records.map((r) => r.weight)),
        avg_blood_sugar: avg(records.map((r) => r.blood_sugar)),
        records_count: records.length,
      });
    });

    return trends;
  }

  // ============================================================================
  // Medications
  // ============================================================================

  /**
   * Add medication
   */
  async addMedication(
    userId: string,
    input: CreateMedicationInput
  ): Promise<MedicationWithReminders> {
    const { create_reminders, ...medicationData } = input;

    const { data: medication, error } = await this.supabase
      .from('medications')
      .insert({
        user_id: userId,
        ...medicationData,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      this.log.error('Failed to add medication', error);
      throw new BadRequestError('Failed to add medication');
    }

    // Create reminders if requested
    const reminders: MedicationReminder[] = [];
    if (create_reminders && input.timing && input.timing.length > 0) {
      const createdReminders = await this.createMedicationReminders(
        medication.id,
        userId,
        input.family_member_id || null,
        input.timing
      );
      reminders.push(...createdReminders);
    }

    this.log.info('Medication added', { userId, medicationId: medication.id });

    return {
      ...medication,
      reminders,
    };
  }

  /**
   * Get active medications
   */
  async getActiveMedications(
    userId: string,
    familyMemberId?: string
  ): Promise<Medication[]> {
    let query = this.supabase
      .from('medications')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('name');

    if (familyMemberId) {
      query = query.eq('family_member_id', familyMemberId);
    } else {
      query = query.is('family_member_id', null);
    }

    const { data, error } = await query;

    if (error) {
      throw new BadRequestError('Failed to fetch medications');
    }

    return data || [];
  }

  /**
   * Update medication
   */
  async updateMedication(
    medicationId: string,
    userId: string,
    input: UpdateMedicationInput
  ): Promise<Medication> {
    const { data, error } = await this.supabase
      .from('medications')
      .update({
        ...input,
        updated_at: new Date().toISOString(),
      })
      .eq('id', medicationId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error || !data) {
      throw new BadRequestError('Failed to update medication');
    }

    return data;
  }

  /**
   * Stop medication
   */
  async stopMedication(medicationId: string, userId: string): Promise<void> {
    await this.supabase
      .from('medications')
      .update({
        is_active: false,
        end_date: new Date().toISOString().split('T')[0],
      })
      .eq('id', medicationId)
      .eq('user_id', userId);
  }

  // ============================================================================
  // Medication Reminders
  // ============================================================================

  /**
   * Create reminders for medication
   */
  private async createMedicationReminders(
    medicationId: string,
    userId: string,
    familyMemberId: string | null,
    timings: string[]
  ): Promise<MedicationReminder[]> {
    const timeMap: Record<string, string> = {
      morning: '08:00',
      afternoon: '13:00',
      evening: '18:00',
      night: '21:00',
      before_meal: '07:30',
      after_meal: '09:00',
      with_meal: '08:30',
      empty_stomach: '06:00',
      bedtime: '22:00',
    };

    const today = new Date().toISOString().split('T')[0];
    const reminders = timings.map((timing) => ({
      medication_id: medicationId,
      user_id: userId,
      family_member_id: familyMemberId,
      scheduled_time: `${today}T${timeMap[timing] || '09:00'}:00`,
      status: 'pending' as const,
    }));

    const { data, error } = await this.supabase
      .from('medication_reminders')
      .insert(reminders)
      .select();

    if (error) {
      this.log.error('Failed to create reminders', error);
      return [];
    }

    return data || [];
  }

  /**
   * Get upcoming reminders
   */
  async getUpcomingReminders(
    userId: string,
    familyMemberId?: string
  ): Promise<MedicationReminder[]> {
    const now = new Date().toISOString();
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59);

    let query = this.supabase
      .from('medication_reminders')
      .select(`
        *,
        medication:medications(name, dosage)
      `)
      .eq('user_id', userId)
      .eq('status', 'pending')
      .gte('scheduled_time', now)
      .lte('scheduled_time', endOfDay.toISOString())
      .order('scheduled_time');

    if (familyMemberId) {
      query = query.eq('family_member_id', familyMemberId);
    }

    const { data, error } = await query;

    if (error) {
      return [];
    }

    return data || [];
  }

  /**
   * Record reminder action
   */
  async recordReminderAction(
    userId: string,
    action: ReminderAction
  ): Promise<MedicationReminder> {
    const updateData: any = {
      status: action.action === 'take' ? 'taken' : 'skipped',
    };

    if (action.action === 'take') {
      updateData.taken_at = new Date().toISOString();
    } else {
      updateData.skipped_reason = action.skipped_reason || null;
    }

    if (action.notes) {
      updateData.notes = action.notes;
    }

    const { data, error } = await this.supabase
      .from('medication_reminders')
      .update(updateData)
      .eq('id', action.reminder_id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error || !data) {
      throw new BadRequestError('Failed to record action');
    }

    return data;
  }

  // ============================================================================
  // Allergies
  // ============================================================================

  /**
   * Add allergy
   */
  async addAllergy(userId: string, input: CreateAllergyInput): Promise<Allergy> {
    const { data, error } = await this.supabase
      .from('allergies')
      .insert({
        user_id: userId,
        ...input,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      throw new BadRequestError('Failed to add allergy');
    }

    return data;
  }

  /**
   * List allergies
   */
  async listAllergies(userId: string, familyMemberId?: string): Promise<Allergy[]> {
    let query = this.supabase
      .from('allergies')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('allergen');

    if (familyMemberId) {
      query = query.eq('family_member_id', familyMemberId);
    } else {
      query = query.is('family_member_id', null);
    }

    const { data, error } = await query;

    if (error) {
      return [];
    }

    return data || [];
  }

  /**
   * Remove allergy
   */
  async removeAllergy(allergyId: string, userId: string): Promise<void> {
    await this.supabase
      .from('allergies')
      .update({ is_active: false })
      .eq('id', allergyId)
      .eq('user_id', userId);
  }

  // ============================================================================
  // Health Summary
  // ============================================================================

  /**
   * Get comprehensive health summary
   */
  async getHealthSummary(userId: string): Promise<HealthSummary> {
    // Get user details
    const { data: user } = await this.supabase
      .from('users')
      .select('id, name, date_of_birth, blood_group')
      .eq('id', userId)
      .single();

    if (!user) {
      throw new NotFoundError('User');
    }

    // Get all data in parallel
    const [
      familyMembers,
      latestVitals,
      medications,
      allergies,
      conditions,
      documents,
      reminders,
    ] = await Promise.all([
      this.listFamilyMembers(userId),
      this.getLatestVitals(userId),
      this.getActiveMedications(userId),
      this.listAllergies(userId),
      this.listMedicalConditions(userId),
      this.listDocuments({ user_id: userId, limit: 5 }),
      this.getUpcomingReminders(userId),
    ]);

    return {
      user,
      family_members: familyMembers,
      latest_vitals: latestVitals,
      active_medications: medications,
      allergies,
      chronic_conditions: conditions.filter((c) => c.condition_type === 'chronic'),
      recent_documents: documents.documents,
      upcoming_reminders: reminders,
    };
  }

  /**
   * Get family member health summary
   */
  async getFamilyHealthSummary(
    userId: string,
    memberId: string
  ): Promise<FamilyHealthSummary> {
    const member = await this.getFamilyMember(memberId, userId);

    const [vitals, medications, allergies, conditions, reminders] = await Promise.all([
      this.getLatestVitals(userId, memberId),
      this.getActiveMedications(userId, memberId),
      this.listAllergies(userId, memberId),
      this.listMedicalConditions(userId, memberId),
      this.getUpcomingReminders(userId, memberId),
    ]);

    return {
      member,
      latest_vitals: vitals,
      active_medications: medications,
      allergies,
      conditions,
      upcoming_reminders: reminders,
    };
  }

  /**
   * List medical conditions
   */
  private async listMedicalConditions(
    userId: string,
    familyMemberId?: string
  ): Promise<MedicalCondition[]> {
    let query = this.supabase
      .from('medical_conditions')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('condition_name');

    if (familyMemberId) {
      query = query.eq('family_member_id', familyMemberId);
    } else {
      query = query.is('family_member_id', null);
    }

    const { data } = await query;
    return data || [];
  }

  // ============================================================================
  // Controller-compatible method aliases
  // ============================================================================

  /** Alias for recordVitals */
  async createVitalRecord(userId: string, input: CreateVitalRecordInput): Promise<VitalRecord> {
    return this.recordVitals(userId, input);
  }

  /** Get single vital record */
  async getVitalRecord(vitalId: string, userId: string): Promise<VitalRecord> {
    const { data, error } = await this.supabase
      .from('vital_records')
      .select('*')
      .eq('id', vitalId)
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      throw new NotFoundError('Vital record');
    }

    return data;
  }

  /** Delete vital record */
  async deleteVitalRecord(vitalId: string, userId: string): Promise<void> {
    const { error } = await this.supabase
      .from('vital_records')
      .delete()
      .eq('id', vitalId)
      .eq('user_id', userId);

    if (error) {
      throw new BadRequestError('Failed to delete vital record');
    }
  }

  /** Alias for addMedication */
  async createMedication(userId: string, input: any): Promise<MedicationWithReminders> {
    return this.addMedication(userId, input);
  }

  /** Get single medication */
  async getMedication(medicationId: string, userId: string): Promise<Medication> {
    const { data, error } = await this.supabase
      .from('medications')
      .select('*')
      .eq('id', medicationId)
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      throw new NotFoundError('Medication');
    }

    return data;
  }

  /** List medications with pagination */
  async listMedications(filters: any): Promise<{ medications: Medication[]; total: number; page: number; limit: number }> {
    const { user_id, family_member_id, is_active, page = 1, limit = 20 } = filters;

    let query = this.supabase
      .from('medications')
      .select('*', { count: 'exact' })
      .eq('user_id', user_id);

    if (family_member_id) query = query.eq('family_member_id', family_member_id);
    if (is_active !== undefined) query = query.eq('is_active', is_active);

    query = query.order('created_at', { ascending: false });

    const from = (page - 1) * limit;
    query = query.range(from, from + limit - 1);

    const { data, count, error } = await query;

    if (error) {
      throw new BadRequestError('Failed to fetch medications');
    }

    return {
      medications: data || [],
      total: count || 0,
      page,
      limit,
    };
  }

  /** Delete medication */
  async deleteMedication(medicationId: string, userId: string): Promise<void> {
    await this.stopMedication(medicationId, userId);
  }

  /** Record medication action (taken/skipped) */
  async recordMedicationAction(
    medicationId: string,
    userId: string,
    action: { action: string; scheduled_time: string; taken_at?: string; notes?: string }
  ): Promise<any> {
    // Update medication last_taken if action is taken
    if (action.action === 'taken') {
      await this.supabase
        .from('medication_reminders')
        .update({
          last_taken: action.taken_at || new Date().toISOString(),
        })
        .eq('id', medicationId)
        .eq('user_id', userId);
    }

    return { success: true, action: action.action };
  }

  /** Alias for addAllergy */
  async createAllergy(userId: string, input: any): Promise<Allergy> {
    return this.addAllergy(userId, input);
  }

  /** Get single allergy */
  async getAllergy(allergyId: string, userId: string): Promise<Allergy> {
    const { data, error } = await this.supabase
      .from('allergies')
      .select('*')
      .eq('id', allergyId)
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      throw new NotFoundError('Allergy');
    }

    return data;
  }

  /** Update allergy */
  async updateAllergy(allergyId: string, userId: string, input: any): Promise<Allergy> {
    const { data, error } = await this.supabase
      .from('allergies')
      .update({
        ...input,
        updated_at: new Date().toISOString(),
      })
      .eq('id', allergyId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error || !data) {
      throw new BadRequestError('Failed to update allergy');
    }

    return data;
  }

  /** Delete allergy */
  async deleteAllergy(allergyId: string, userId: string): Promise<void> {
    await this.removeAllergy(allergyId, userId);
  }

  /** Get health summary for user or family member */
  async getHealthSummaryForMember(
    userId: string,
    familyMemberId?: string
  ): Promise<HealthSummary | FamilyHealthSummary> {
    if (familyMemberId) {
      return this.getFamilyHealthSummary(userId, familyMemberId);
    }
    return this.getHealthSummary(userId);
  }
}

export const healthRecordsService = new HealthRecordsService();

