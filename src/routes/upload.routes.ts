import { Router } from 'express';
import { authenticate, requireHospitalOwner, requireDoctorOwner, requireOwnerOrAdmin } from '../middlewares/auth.middleware.js';
import {
  uploadMiddleware,
  uploadHospitalLogo,
  uploadHospitalImages,
  uploadDoctorAvatar,
  uploadPatientAvatar,
  uploadGeneric,
} from '../modules/uploads/upload.controller.js';

const router = Router();

// Hospital uploads (hospital admin only)
router.post('/hospitals/:hospitalId/logo', authenticate, requireHospitalOwner('hospitalId'), uploadMiddleware.single('file'), uploadHospitalLogo);
router.post('/hospitals/:hospitalId/images', authenticate, requireHospitalOwner('hospitalId'), uploadMiddleware.array('files', 12), uploadHospitalImages);

// Doctor uploads (doctor or hospital)
router.post('/doctors/:doctorId/avatar', authenticate, uploadMiddleware.single('file'), uploadDoctorAvatar);

// Patient uploads (owner or admin)
router.post('/patients/:userId/avatar', authenticate, requireOwnerOrAdmin('userId'), uploadMiddleware.single('file'), uploadPatientAvatar);

// Generic upload (authenticated)
router.post('/:bucket/:id', authenticate, uploadMiddleware.single('file'), uploadGeneric);

export const uploadRoutes = router;
