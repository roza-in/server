import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { roleGuard } from '../../middlewares/role.middleware.js';
import {
    createPrescription,
    getPrescription,
    listPrescriptions,
    getMyPrescriptions,
} from './prescription.controller.js';
import { idempotencyMiddleware } from '../../middlewares/idempotency.middleware.js';

const router = Router();

router.use(authMiddleware);

/**
 * @route GET /api/v1/prescriptions/my
 * @desc Get current patient's prescriptions
 * @access Patient
 */
router.get('/my', roleGuard('patient'), getMyPrescriptions);

/**
 * @route GET /api/v1/prescriptions
 * @desc List all prescriptions (for doctors/hospitals/admin)
 * @access Doctor, Hospital, Admin, Patient
 */
router.get('/', listPrescriptions);

/**
 * @route POST /api/v1/prescriptions
 * @desc Create a new prescription
 * @access Doctor
 */
router.post('/', roleGuard('doctor'), idempotencyMiddleware(), createPrescription);

/**
 * @route GET /api/v1/prescriptions/:prescriptionId
 * @desc Get prescription by ID
 * @access Authenticated
 */
router.get('/:prescriptionId', getPrescription);

export const prescriptionRoutes = router;
export default router;