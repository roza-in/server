import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { roleGuard } from '../../middlewares/role.middleware.js';
import {
  uploadMiddleware,
  uploadHospitalLogo,
  uploadHospitalImages,
  uploadDoctorAvatar,
  uploadPatientAvatar,
  uploadHospitalDocument,
  uploadPrescription,
  uploadPatientReport,
  uploadMedicineImage,
  uploadUserCover,
  uploadReturnProof,
  uploadSettlementInvoice,
  uploadSupportAttachment
} from './upload.controller.js';

const router = Router();

// Hospital uploads (hospital admin only - must own the hospital)
router.post('/hospitals/:hospitalId/logo', authMiddleware, roleGuard({ ownerParam: 'hospitalId' }), uploadMiddleware.single('file'), uploadHospitalLogo);
router.post('/hospitals/:hospitalId/images', authMiddleware, roleGuard({ ownerParam: 'hospitalId' }), uploadMiddleware.array('files', 12), uploadHospitalImages);
router.post('/hospitals/:hospitalId/documents', authMiddleware, roleGuard({ ownerParam: 'hospitalId' }), uploadMiddleware.single('file'), uploadHospitalDocument);

// Doctor uploads (doctor or hospital admin)
router.post('/doctors/:doctorId/avatar', authMiddleware, roleGuard('admin', 'hospital', { ownerParam: 'doctorId' }), uploadMiddleware.single('file'), uploadDoctorAvatar);

// Patient uploads (owner or admin)
router.post('/patients/:userId/avatar', authMiddleware, roleGuard({ ownerParam: 'userId' }), uploadMiddleware.single('file'), uploadPatientAvatar);
router.post('/patients/:userId/cover', authMiddleware, roleGuard({ ownerParam: 'userId' }), uploadMiddleware.single('file'), uploadUserCover);

// Prescriptions (Doctors can upload for patients)
router.post('/patients/:patientId/prescriptions', authMiddleware, roleGuard('doctor'), uploadMiddleware.single('file'), uploadPrescription);

// Reports (Patient owner or Doctor)
router.post('/patients/:patientId/reports', authMiddleware, uploadMiddleware.single('file'), uploadPatientReport);

// Pharmacy / Admin Medicines
router.post('/medicines/image', authMiddleware, roleGuard('admin', 'pharmacy'), uploadMiddleware.single('file'), uploadMedicineImage);

// Returns (Patient uploads proof)
router.post('/returns/:orderId/proof', authMiddleware, uploadMiddleware.single('file'), uploadReturnProof);

// Invoices (Admin only - System generated usually, but if manual upload needed)
router.post('/invoices/upload', authMiddleware, roleGuard('admin'), uploadMiddleware.single('file'), uploadSettlementInvoice);

// Support Attachments (Any auth user)
router.post('/support/attachments', authMiddleware, uploadMiddleware.single('file'), uploadSupportAttachment);

export const uploadRoutes = router;

export default router;

