import { Request, Response } from 'express';
import { prescriptionService } from './prescription.service.js';
import { consultationPolicy } from '../consultations/consultation.policy.js';
import { consultationService } from '../consultations/consultation.service.js';
import { sendSuccess, sendPaginated, calculatePagination } from '../../common/responses/index.js';
import { asyncHandler } from '../../middlewares/error.middleware.js';
import { ForbiddenError } from '../../common/errors/index.js';
import type { AuthenticatedRequest } from '../../types/request.js';

/**
 * Create prescription
 * POST /api/v1/prescriptions
 */
export const createPrescription = asyncHandler(async (req: Request, res: Response) => {
    const user = (req as AuthenticatedRequest).user;
    const data = req.body;

    const consultation = await consultationService.getById(data.consultationId, user.userId, user.role);
    if (!consultationPolicy.canCreatePrescription(user, consultation)) {
        throw new ForbiddenError('Only the treating doctor can create prescriptions');
    }

    const doctorId = user.doctorId || (user.role === 'doctor' ? user.userId : null);
    if (!doctorId) {
        throw new ForbiddenError('Invalid doctor session');
    }

    const prescription = await prescriptionService.create(doctorId, data);
    return sendSuccess(res, prescription, 'Prescription created successfully', 201);
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
    const isDoctor = user.role === 'doctor' && (prescription.doctor?.user_id === user.userId || prescription.doctor_id === user.userId);
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
    const filters = req.query as any;
    const user = (req as AuthenticatedRequest).user;

    // Apply role-based filters
    if (user.role === 'doctor') {
        filters.doctorId = user.userId; // Usually we need the doctor profile ID, but prescriptionService.list handles it
    } else if (user.role === 'hospital') {
        filters.hospitalId = user.hospitalId;
    } else if (user.role === 'patient') {
        filters.patientId = user.userId;
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
    const { page, limit } = req.query as any;

    const { prescriptions, total, page: rPage, limit: rLimit } = await prescriptionService.getPatientPrescriptions(user.userId, Number(page) || 1, Number(limit) || 20);
    const pagination = calculatePagination(total, rPage, rLimit);
    return sendPaginated(res, prescriptions, pagination);
});

/**
 * Sign prescription
 * POST /api/v1/prescriptions/:prescriptionId/sign
 */
export const signPrescription = asyncHandler(async (req: Request, res: Response) => {
    const { prescriptionId } = req.params;
    const user = (req as AuthenticatedRequest).user;
    const doctorId = user.doctorId || (user.role === 'doctor' ? user.userId : null);

    if (!doctorId) {
        throw new ForbiddenError('Invalid doctor session');
    }

    const { signatureUrl } = req.body;
    const prescription = await prescriptionService.sign(prescriptionId, doctorId, signatureUrl);
    return sendSuccess(res, prescription, 'Prescription signed successfully');
});

export { prescriptionService } from './prescription.service.js';
export * from './prescription.types.js';

