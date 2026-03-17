import { Request, Response } from 'express';
import { prescriptionService } from './prescription.service.js';
import { consultationPolicy } from '../consultations/consultation.policy.js';
import { consultationService } from '../consultations/consultation.service.js';
import { sendSuccess, sendCreated, sendPaginated, calculatePagination } from '../../common/responses/index.js';
import { asyncHandler } from '../../middlewares/error.middleware.js';
import { ForbiddenError } from '../../common/errors/index.js';
import type { AuthenticatedRequest } from '../../types/request.js';
import type { CreatePrescriptionInput, PrescriptionFilters } from './prescription.types.js';

/**
 * Create prescription
 * POST /api/v1/prescriptions
 */
export const createPrescription = asyncHandler(async (req: Request, res: Response) => {
    const user = (req as AuthenticatedRequest).user;
    let data = req.body as any;

    if (!data.consultation_id && data.appointmentId) {
        const result = await consultationService.list({ appointmentId: data.appointmentId } as any, user.userId, user.role);
        if (result.consultations.length > 0) {
            data.consultation_id = result.consultations[0].id;
        } else {
            throw new ForbiddenError('No valid consultation available for this appointment.');
        }
    }

    if (!data.consultation_id) {
        throw new ForbiddenError('consultation_id or appointmentId is required to create a prescription.');
    }

    // Validate the doctor has access to the consultation
    const consultation = await consultationService.getById(data.consultation_id, user.userId, user.role);
    if (!consultationPolicy.canCreatePrescription(user, consultation)) {
        throw new ForbiddenError('Only the treating doctor can create prescriptions');
    }

    const doctorId = user.doctorId || (user.role === 'doctor' ? user.userId : null);
    if (!doctorId) {
        throw new ForbiddenError('Invalid doctor session');
    }

    // Map frontend payload to match CreatePrescriptionInput
    const inputData: CreatePrescriptionInput = {
        consultation_id: data.consultation_id,
        diagnosis: data.diagnosis ? (Array.isArray(data.diagnosis) ? data.diagnosis : [data.diagnosis]) : undefined,
        medications: (data.medications || []).map((m: any) => ({
            name: m.medicineName || m.name,
            dosage: m.dosage,
            frequency: m.frequency,
            duration: m.duration,
            timing: m.beforeAfterFood || m.timing,
            instructions: m.instructions
        })),
        lab_tests: (data.labTests || []).map((l: any) => l.testName || l),
        general_instructions: data.advice || data.general_instructions,
        valid_until: data.validityDays ? new Date(Date.now() + data.validityDays * 24 * 60 * 60 * 1000).toISOString() : data.valid_until
    };

    const prescription = await prescriptionService.create(doctorId, inputData);
    return sendCreated(res, prescription, 'Prescription created successfully');
});

/**
 * Get prescription by ID
 * GET /api/v1/prescriptions/:prescriptionId
 */
export const getPrescription = asyncHandler(async (req: Request, res: Response) => {
    const { prescriptionId } = req.params;
    const user = (req as AuthenticatedRequest).user;

    const prescription = await prescriptionService.getById(prescriptionId);

    // Authorization check
    const isDoctor = user.role === 'doctor' && (prescription.doctors?.users?.name !== undefined || prescription.doctor_id === user.doctorId);
    const isPatient = user.role === 'patient' && prescription.patient_id === user.userId;
    const isAdmin = user.role === 'admin';
    const isHospital = user.role === 'hospital' && prescription.hospital_id === user.hospitalId;

    if (!isDoctor && !isPatient && !isAdmin && !isHospital) {
        throw new ForbiddenError('You do not have access to this prescription');
    }

    return sendSuccess(res, prescription);
});

/**
 * List prescriptions (for doctors/hospitals)
 * GET /api/v1/prescriptions
 */
export const listPrescriptions = asyncHandler(async (req: Request, res: Response) => {
    const user = (req as AuthenticatedRequest).user;
    const filters: PrescriptionFilters = {
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 20,
    };

    // Apply role-based filters
    if (user.role === 'doctor') {
        filters.doctor_id = user.doctorId || user.userId;
    } else if (user.role === 'hospital') {
        filters.hospital_id = user.hospitalId;
    } else if (user.role === 'patient') {
        filters.patient_id = user.userId;
    }

    const { prescriptions, total, page, limit } = await prescriptionService.list(filters);
    const pagination = calculatePagination(total, page, limit);
    return sendPaginated(res, prescriptions, pagination);
});

/**
 * Get my prescriptions (for patients)
 * GET /api/v1/prescriptions/my
 */
export const getMyPrescriptions = asyncHandler(async (req: Request, res: Response) => {
    const user = (req as AuthenticatedRequest).user;
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;

    let result;
    if (user.role === 'doctor') {
        const doctorId = user.doctorId || user.userId;
        result = await prescriptionService.list({ doctor_id: doctorId, page, limit });
    } else {
        result = await prescriptionService.getPatientPrescriptions(user.userId, page, limit);
    }

    const pagination = calculatePagination(result.total, result.page, result.limit);
    return sendPaginated(res, result.prescriptions, pagination);
});
