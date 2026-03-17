import { logger } from '../../config/logger.js';
import { NotFoundError, BadRequestError } from '../../common/errors/index.js';
import { prescriptionRepository } from '../../database/repositories/prescription.repo.js';
import type { Prescription } from '../../types/database.types.js';
import type { PrescriptionFilters, CreatePrescriptionInput, PrescriptionWithRelations } from './prescription.types.js';

/**
 * Prescription Service - Domain module for prescription management
 */
class PrescriptionService {
    private log = logger.child('PrescriptionService');

    /**
     * Generate prescription number
     */
    private generatePrescriptionNumber(hospitalSlug?: string): string {
        const year = new Date().getFullYear();
        const seq = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
        const prefix = hospitalSlug ? hospitalSlug.toUpperCase().substring(0, 4) : 'ROZX';
        return `${prefix}/${year}/${seq}`;
    }

    /**
     * Create prescription
     */
    async create(doctorId: string, input: CreatePrescriptionInput): Promise<Prescription> {
        // Fetch consultation to get patient/hospital context
        const consultation = await this.getConsultationContext(input.consultation_id);

        const prescriptionNumber = this.generatePrescriptionNumber(consultation.hospitalSlug);

        const prescription = await prescriptionRepository.create({
            prescription_number: prescriptionNumber,
            consultation_id: input.consultation_id,
            doctor_id: doctorId,
            patient_id: consultation.patientId,
            hospital_id: consultation.hospitalId,
            diagnosis: input.diagnosis || null,
            medications: input.medications as unknown as Prescription['medications'],
            lab_tests: input.lab_tests || null,
            imaging_tests: input.imaging_tests || null,
            diet_advice: input.diet_advice || null,
            lifestyle_advice: input.lifestyle_advice || null,
            general_instructions: input.general_instructions || null,
            valid_until: input.valid_until || this.calculateValidity(),
        });

        if (!prescription) {
            throw new BadRequestError('Failed to create prescription');
        }

        this.log.info(`Prescription created: ${prescriptionNumber}`, {
            prescriptionId: prescription.id,
            doctorId,
            consultationId: input.consultation_id,
        });

        return prescription;
    }

    /**
     * Get consultation context for prescription creation
     */
    private async getConsultationContext(consultationId: string): Promise<{
        patientId: string;
        hospitalId: string;
        hospitalSlug?: string;
    }> {
        const { supabaseAdmin } = await import('../../database/supabase-admin.js');
        const { data, error } = await supabaseAdmin
            .from('consultations')
            .select('appointment:appointments(patient_id, hospital_id, hospital:hospitals(slug))')
            .eq('id', consultationId)
            .single();

        if (error || !data) {
            this.log.error('Failed to get consultation context', { error, consultationId });
            throw new NotFoundError('Consultation not found');
        }

        const appointment = data.appointment as any;
        return {
            patientId: appointment?.patient_id,
            hospitalId: appointment?.hospital_id,
            hospitalSlug: appointment?.hospital?.slug,
        };
    }

    private calculateValidity(): string {
        const date = new Date();
        date.setMonth(date.getMonth() + 6);
        return date.toISOString().split('T')[0];
    }

    /**
     * Get prescription by ID with relations
     */
    async getById(prescriptionId: string): Promise<PrescriptionWithRelations> {
        const prescription = await prescriptionRepository.findByIdWithRelations(prescriptionId);
        if (!prescription) {
            throw new NotFoundError('Prescription not found');
        }
        return this.transformPrescription(prescription);
    }

    /**
     * List prescriptions with filters
     */
    async list(filters: PrescriptionFilters): Promise<{
        prescriptions: PrescriptionWithRelations[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    }> {
        const page = filters.page || 1;
        const limit = filters.limit || 20;

        const dbFilters: Record<string, unknown> = {};
        if (filters.patient_id) dbFilters.patient_id = filters.patient_id;
        if (filters.doctor_id) dbFilters.doctor_id = filters.doctor_id;
        if (filters.hospital_id) dbFilters.hospital_id = filters.hospital_id;

        const { data, total } = await prescriptionRepository.findMany(dbFilters, page, limit);

        const transformedData = (data || []).map(p => this.transformPrescription(p));

        return {
            prescriptions: transformedData,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }

    /**
     * Transform database row to prescription type with flattened fields
     */
    private transformPrescription(data: any): PrescriptionWithRelations {
        const doctorData = data.doctor || data.doctors;
        const hospitalData = data.hospital || data.hospitals;

        return {
            ...data,
            // Flattened fields for frontend consistency
            patientName: data.patient?.name || 'Unknown Patient',
            doctorName: doctorData?.users?.name || doctorData?.name || 'Doctor',
            doctorSpecialization: doctorData?.specialization?.name || doctorData?.specialization || 'General Physician',
            doctorRegistrationNumber: doctorData?.registration_number || doctorData?.registrationNumber || 'N/A',
            hospitalName: hospitalData?.name || 'Rozx Partner Hospital',

            // Ensure consistent naming for relations
            doctor: doctorData,
            patient: data.patient,
            hospital: hospitalData,
        } as PrescriptionWithRelations;
    }

    /**
     * Get patient prescriptions
     */
    async getPatientPrescriptions(patientId: string, page = 1, limit = 20): Promise<{
        prescriptions: Prescription[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    }> {
        return this.list({ patient_id: patientId, page, limit });
    }

    /**
     * Update prescription PDF URL
     */
    async updatePdfUrl(prescriptionId: string, pdfUrl: string): Promise<Prescription | null> {
        return prescriptionRepository.update(prescriptionId, {
            pdf_url: pdfUrl,
            updated_at: new Date().toISOString(),
        });
    }
}

export const prescriptionService = new PrescriptionService();
