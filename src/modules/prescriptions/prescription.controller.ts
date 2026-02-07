import { Request, Response } from 'express';
import { asyncHandler } from '../../middlewares/error.middleware.js';
import { AuthenticatedRequest } from "../../types/request.js";
import { CreatePrescriptionInput } from "../consultations/consultation.validator.js";
import { sendCreated } from "../../common/index.js";
import { prescriptionService } from './prescription.service.js';

export const createPrescription = asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as unknown as AuthenticatedRequest;
    const user = authReq.user;
    const data = req.body as any; // Using any to bypass strict type check for now
    const result = await prescriptionService.create(user.userId, data);
    return sendCreated(res, result, 'Prescription created successfully');
});

export const getPrescription = asyncHandler(async (req: Request, res: Response) => {
    const { prescriptionId } = req.params;
    const result = await prescriptionService.getById(prescriptionId);
    return sendCreated(res, result, 'Prescription retrieved successfully');
});

export const listPrescriptions = asyncHandler(async (req: Request, res: Response) => {
    const filters = req.query as any;
    const result = await prescriptionService.list(filters);
    return sendCreated(res, result, 'Prescriptions retrieved successfully');
});

export const getMyPrescriptions = asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as unknown as AuthenticatedRequest;
    const user = authReq.user;
    const result = await prescriptionService.getPatientPrescriptions(user.userId);
    return sendCreated(res, result, 'Prescriptions retrieved successfully');
});

export const signPrescription = asyncHandler(async (req: Request, res: Response) => {
    const { prescriptionId } = req.params;
    const authReq = req as unknown as AuthenticatedRequest;
    const user = authReq.user;
    const result = await prescriptionService.sign(prescriptionId, user.userId);
    return sendCreated(res, result, 'Prescription signed successfully');
});
