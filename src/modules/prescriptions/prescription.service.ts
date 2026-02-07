import { logger } from '../../config/logger.js';
import { NotFoundError, BadRequestError } from '../../common/errors/index.js';
import { prescriptionRepository } from '../../database/repositories/prescription.repo.js';
import { appointmentRepository } from '../../database/repositories/appointment.repo.js';
import type { PrescriptionFilters, CreatePrescriptionInput } from './prescription.types.js';

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
    async create(doctorId: string, input: CreatePrescriptionInput): Promise<any> {
        // Get appointment and validate doctor
        const appointment = await appointmentRepository.findByIdWithRelations(input.appointment_id);

        if (!appointment) {
            throw new NotFoundError('Appointment not found');
        }

        if (appointment.doctor_id !== doctorId) {
            throw new BadRequestError('You are not authorized to create prescription for this appointment');
        }

        const hospitalSlug = appointment.hospital?.slug;
        const prescriptionNumber = this.generatePrescriptionNumber(hospitalSlug);

        const prescription = await prescriptionRepository.create({
            prescription_number: prescriptionNumber,
            appointment_id: input.appointment_id,
            consultation_id: input.consultation_id || null,
            doctor_id: doctorId,
            patient_id: appointment.patient_id,
            hospital_id: appointment.hospital_id,
            chief_complaints: input.chief_complaints,
            diagnosis: input.diagnosis,
            diagnosis_icd_codes: input.diagnosis_icd_codes,
            vitals: input.vitals,
            medications: input.medications,
            lab_tests: input.lab_tests,
            investigations: input.investigations,
            lifestyle_advice: input.lifestyle_advice,
            dietary_advice: input.dietary_advice,
            general_advice: input.general_advice,
            precautions: input.precautions,
            follow_up_date: input.follow_up_date,
            follow_up_instructions: input.follow_up_instructions,
            valid_until: this.calculateValidity(),
            updated_at: new Date().toISOString()
        });

        if (!prescription) {
            throw new BadRequestError('Failed to create prescription');
        }

        return prescription;
    }

    private calculateValidity(): string {
        const date = new Date();
        date.setMonth(date.getMonth() + 6);
        return date.toISOString().split('T')[0];
    }

    /**
     * Get prescription by ID
     */
    async getById(prescriptionId: string): Promise<any> {
        const prescription = await prescriptionRepository.findByIdWithRelations(prescriptionId);
        if (!prescription) {
            throw new NotFoundError('Prescription not found');
        }
        return prescription;
    }

    /**
     * List prescriptions with filters
     */
    async list(filters: PrescriptionFilters): Promise<any> {
        const { data, total } = await prescriptionRepository.findMany({
            patient_id: filters.patientId,
            doctor_id: filters.doctorId,
            hospital_id: filters.hospitalId,
            page: filters.page,
            limit: filters.limit
        });

        return {
            prescriptions: data,
            total,
            page: filters.page || 1,
            limit: filters.limit || 20,
            totalPages: Math.ceil(total / (filters.limit || 20)),
        };
    }

    /**
     * Get patient prescriptions
     */
    async getPatientPrescriptions(patientId: string, page = 1, limit = 20): Promise<any> {
        return this.list({ patientId, page, limit });
    }

    /**
     * Sign prescription (digital signature)
     */
    async sign(prescriptionId: string, doctorId: string, signatureUrl?: string): Promise<any> {
        const existing = await prescriptionRepository.findById(prescriptionId);

        if (!existing || existing.doctor_id !== doctorId) {
            throw new BadRequestError('You are not authorized to sign this prescription');
        }

        const data = await prescriptionRepository.update(prescriptionId, {
            signed_at: new Date().toISOString(),
            signature_url: signatureUrl || null,
            updated_at: new Date().toISOString(),
        });

        if (!data) {
            throw new BadRequestError('Failed to sign prescription');
        }

        return data;
    }
}

export const prescriptionService = new PrescriptionService();

