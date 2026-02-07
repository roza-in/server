import { Request, Response } from 'express';
import { receptionService } from './reception.service.js';
import { sendSuccess, sendCreated } from '../../common/responses/index.js';
import { asyncHandler } from '../../middlewares/error.middleware.js';
import type { AuthenticatedRequest } from '../../types/request.js';
import type { WalkInBookingInput } from './reception.types.js';

/**
 * Reception Controller - HTTP handlers for reception desk operations
 */

/**
 * Get today's appointment queue
 * GET /api/v1/reception/queue
 */
export const getQueue = asyncHandler(async (req: Request, res: Response) => {
    const user = (req as AuthenticatedRequest).user;
    const hospitalId = user.hospitalId;

    if (!hospitalId) {
        return res.status(400).json({ error: 'User is not associated with a hospital' });
    }

    const { date, status, doctorId } = req.query as any;
    const result = await receptionService.getQueue(hospitalId, date, status, doctorId);
    return sendSuccess(res, result);
});

/**
 * Check in a patient
 * PATCH /api/v1/reception/appointments/:appointmentId/check-in
 */
export const checkInPatient = asyncHandler(async (req: Request, res: Response) => {
    const user = (req as AuthenticatedRequest).user;
    const { appointmentId } = req.params;
    const hospitalId = user.hospitalId;

    if (!hospitalId) {
        return res.status(400).json({ error: 'User is not associated with a hospital' });
    }

    const result = await receptionService.checkInAppointment(appointmentId, hospitalId, user.userId);
    return sendSuccess(res, result, 'Patient checked in successfully');
});

/**
 * Mark appointment as no-show
 * PATCH /api/v1/reception/appointments/:appointmentId/no-show
 */
export const markNoShow = asyncHandler(async (req: Request, res: Response) => {
    const user = (req as AuthenticatedRequest).user;
    const { appointmentId } = req.params;
    const hospitalId = user.hospitalId;
    const { reason } = req.body || {};

    if (!hospitalId) {
        return res.status(400).json({ error: 'User is not associated with a hospital' });
    }

    const result = await receptionService.markNoShow(appointmentId, hospitalId, reason);
    return sendSuccess(res, result, 'Marked as no-show');
});

/**
 * Create walk-in booking
 * POST /api/v1/reception/walk-in
 */
export const createWalkInBooking = asyncHandler(async (req: Request, res: Response) => {
    const user = (req as AuthenticatedRequest).user;
    const hospitalId = user.hospitalId;

    if (!hospitalId) {
        return res.status(400).json({ error: 'User is not associated with a hospital' });
    }

    const input: WalkInBookingInput = req.body;
    const result = await receptionService.createWalkInBooking(hospitalId, user.userId, input);
    return sendCreated(res, result, 'Walk-in booked successfully');
});

/**
 * Search patients
 * GET /api/v1/reception/patients/search
 */
export const searchPatients = asyncHandler(async (req: Request, res: Response) => {
    const user = (req as AuthenticatedRequest).user;
    const hospitalId = user.hospitalId;
    const { q, limit } = req.query as any;

    if (!hospitalId) {
        return res.status(400).json({ error: 'User is not associated with a hospital' });
    }

    const result = await receptionService.searchPatients(hospitalId, q, parseInt(limit) || 20);
    return sendSuccess(res, result);
});

/**
 * Register new patient
 * POST /api/v1/reception/patients
 */
export const registerPatient = asyncHandler(async (req: Request, res: Response) => {
    const result = await receptionService.registerWalkInPatient(req.body);
    return sendCreated(res, result, 'Patient registered successfully');
});

/**
 * Record cash payment
 * POST /api/v1/reception/payments/cash
 */
export const recordCashPayment = asyncHandler(async (req: Request, res: Response) => {
    const user = (req as AuthenticatedRequest).user;
    const hospitalId = user.hospitalId;

    if (!hospitalId) {
        return res.status(400).json({ error: 'User is not associated with a hospital' });
    }

    const { appointmentId, amount, receiptNumber } = req.body;
    const result = await receptionService.recordCashPayment(
        appointmentId,
        hospitalId,
        user.userId,
        amount,
        receiptNumber
    );
    return sendCreated(res, result, 'Cash payment recorded successfully');
});
/**
 * Check in a patient with payment collection
 * PATCH /api/v1/reception/appointments/:appointmentId/check-in-with-payment
 */
export const checkInWithPayment = asyncHandler(async (req: Request, res: Response) => {
    const user = (req as AuthenticatedRequest).user;
    const { appointmentId } = req.params;
    const hospitalId = user.hospitalId;
    const { amount, method } = req.body;

    if (!hospitalId) {
        return res.status(400).json({ error: 'User is not associated with a hospital' });
    }

    const result = await receptionService.checkInWithPayment(
        appointmentId,
        hospitalId,
        user.userId,
        { amount, method }
    );

    return sendSuccess(res, result, 'Patient checked in and payment recorded successfully');
});

export const getPrescription = asyncHandler(async (req: Request, res: Response) => {
    const { hospitalId } = req.user;
    const { appointmentId } = req.params;

    const result = await receptionService.getPrescriptionForAppointment(appointmentId, hospitalId);
    return sendSuccess(res, result, 'Prescription fetched successfully');
});
