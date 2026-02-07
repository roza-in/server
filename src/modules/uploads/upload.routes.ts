import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { roleGuard } from '@/middlewares/role.middleware.js';
import {
  uploadMiddleware,
  uploadHospitalLogo,
  uploadHospitalImages,
  uploadDoctorAvatar,
  uploadPatientAvatar,
  uploadGeneric,
} from './upload.controller.js';

const router = Router();

// Hospital uploads (hospital admin only - must own the hospital)
router.post('/hospitals/:hospitalId/logo', authMiddleware, roleGuard({ ownerParam: 'hospitalId' }), uploadMiddleware.single('file'), uploadHospitalLogo);
router.post('/hospitals/:hospitalId/images', authMiddleware, roleGuard({ ownerParam: 'hospitalId' }), uploadMiddleware.array('files', 12), uploadHospitalImages);

// Doctor uploads (doctor or hospital admin)
router.post('/doctors/:doctorId/avatar', authMiddleware, roleGuard('admin', 'hospital', { ownerParam: 'doctorId' }), uploadMiddleware.single('file'), uploadDoctorAvatar);

// Patient uploads (owner or admin)
router.post('/patients/:userId/avatar', authMiddleware, roleGuard({ ownerParam: 'userId' }), uploadMiddleware.single('file'), uploadPatientAvatar);

// Generic upload (authenticated)
router.post('/:bucket/:id', authMiddleware, uploadMiddleware.single('file'), uploadGeneric);

export const uploadRoutes = router;

export default router;

