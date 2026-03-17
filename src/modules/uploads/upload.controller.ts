import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import type { File as MulterFile } from 'multer';
import { storageService } from '../../integrations/storage/storage.service.js';
import { logger } from '../../config/logger.js';
import { sendSuccess } from '../../common/responses/index.js';
import { hospitalRepository } from '../../database/repositories/hospital.repo.js';
import { doctorRepository } from '../../database/repositories/doctor.repo.js';
import { userRepository } from '../../database/repositories/user.repo.js';

/* ----------------------------------
   TYPES
----------------------------------- */
interface MulterRequest extends Request {
  file?: MulterFile;
  files?: MulterFile[];
}

/* ----------------------------------
   MULTER CONFIG
----------------------------------- */
export const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit (matches private bucket max)
  },
  fileFilter(_req, file, cb) {
    const allowed = [
      'image/png', 'image/jpeg', 'image/webp', 'image/gif',
      'application/pdf', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
    ];
    if (!allowed.includes(file.mimetype)) {
      cb(new Error('Invalid file type. Allowed: Images, PDF, Word Docs'));
    } else {
      cb(null, true);
    }
  },
});

/* ----------------------------------
   HELPER
----------------------------------- */
function requireFile(req: Request): MulterFile {
  const file = (req as MulterRequest).file;
  if (!file) throw new Error('NO_FILE');
  return file;
}

/* ----------------------------------
   PUBLIC UPLOADS
----------------------------------- */

/**
 * HOSPITAL LOGO
 * Path: public/photos/{hospitalId}/...
 */
export async function uploadHospitalLogo(req: Request, res: Response, next: NextFunction) {
  try {
    const { hospitalId } = req.params;
    const file = requireFile(req);

    const result = await storageService.uploadPublic({
      folder: `photos/${hospitalId}`,
      filename: file.originalname,
      buffer: file.buffer,
      contentType: file.mimetype,
    });

    await hospitalRepository.update(hospitalId, { logo_url: result.publicUrl } as any);

    return sendSuccess(res, { url: result.publicUrl, path: result.path }, 'Uploaded Logo');
  } catch (err: any) {
    if (err.message === 'NO_FILE') return res.status(400).json({ success: false, message: 'No file uploaded' });
    next(err);
  }
}

/**
 * HOSPITAL IMAGES (Multiple)
 * Path: public/photos/{hospitalId}/...
 */
export async function uploadHospitalImages(req: Request, res: Response, next: NextFunction) {
  try {
    const { hospitalId } = req.params;
    const files = (req as MulterRequest).files as MulterFile[];
    if (!files || files.length === 0) {
      return res.status(400).json({ success: false, message: 'No files uploaded' });
    }

    const uploadedUrls: string[] = [];
    for (const file of files) {
      const result = await storageService.uploadPublic({
        folder: `photos/${hospitalId}`,
        filename: file.originalname,
        buffer: file.buffer,
        contentType: file.mimetype,
      });
      if (result.publicUrl) uploadedUrls.push(result.publicUrl);
    }

    // Append to existing images
    const hospital = await hospitalRepository.findById(hospitalId);
    const existing: string[] = (hospital as any)?.images || [];

    await hospitalRepository.update(hospitalId, {
      images: [...existing, ...uploadedUrls],
    } as any);

    return sendSuccess(res, { urls: uploadedUrls }, 'Uploaded Images');
  } catch (err) {
    next(err);
  }
}

/**
 * DOCTOR AVATAR
 * Path: public/avatars/{userId}/...
 */
export async function uploadDoctorAvatar(req: Request, res: Response, next: NextFunction) {
  try {
    const { doctorId } = req.params;
    const userId = (req as any).user?.userId;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const file = requireFile(req);

    const result = await storageService.uploadPublic({
      folder: `avatars/${userId}`,
      filename: file.originalname,
      buffer: file.buffer,
      contentType: file.mimetype,
    });

    if (doctorId && doctorId !== 'temp') {
      await doctorRepository.update(doctorId, { profile_image_url: result.publicUrl } as any);
    }

    return sendSuccess(res, { url: result.publicUrl, path: result.path }, 'Uploaded Avatar');
  } catch (err: any) {
    if (err.message === 'NO_FILE') return res.status(400).json({ success: false, message: 'No file uploaded' });
    next(err);
  }
}

/**
 * PATIENT AVATAR
 * Path: public/avatars/{userId}/...
 */
export async function uploadPatientAvatar(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId } = req.params;
    const file = requireFile(req);

    const result = await storageService.uploadPublic({
      folder: `avatars/${userId}`,
      filename: file.originalname,
      buffer: file.buffer,
      contentType: file.mimetype,
    });

    await userRepository.update(userId, { avatar_url: result.publicUrl } as any);

    return sendSuccess(res, { url: result.publicUrl, path: result.path }, 'Uploaded Avatar');
  } catch (err: any) {
    if (err.message === 'NO_FILE') return res.status(400).json({ success: false, message: 'No file uploaded' });
    next(err);
  }
}

/* ----------------------------------
   PRIVATE UPLOADS
----------------------------------- */

/**
 * HOSPITAL DOCUMENTS
 * Path: private/documents/{hospitalId}/...
 */
export async function uploadHospitalDocument(req: Request, res: Response, next: NextFunction) {
  try {
    const { hospitalId } = req.params;
    const file = requireFile(req);

    const result = await storageService.uploadPrivate({
      folder: `documents/${hospitalId}`,
      filename: file.originalname,
      buffer: file.buffer,
      contentType: file.mimetype,
    });

    return sendSuccess(res, { path: result.path, key: result.path }, 'Uploaded Document');
  } catch (err: any) {
    if (err.message === 'NO_FILE') return res.status(400).json({ success: false, message: 'No file uploaded' });
    next(err);
  }
}

/**
 * PRESCRIPTIONS
 * Path: private/prescriptions/{patientId}/...
 */
export async function uploadPrescription(req: Request, res: Response, next: NextFunction) {
  try {
    const { patientId } = req.params;
    const file = requireFile(req);

    const result = await storageService.uploadPrivate({
      folder: `prescriptions/${patientId}`,
      filename: file.originalname,
      buffer: file.buffer,
      contentType: file.mimetype,
    });

    return sendSuccess(res, { path: result.path }, 'Uploaded Prescription');
  } catch (err: any) {
    if (err.message === 'NO_FILE') return res.status(400).json({ success: false, message: 'No file uploaded' });
    next(err);
  }
}

/**
 * PATIENT REPORTS
 * Path: private/reports/{patientId}/...
 */
export async function uploadPatientReport(req: Request, res: Response, next: NextFunction) {
  try {
    const { patientId } = req.params;
    const file = requireFile(req);

    const result = await storageService.uploadPrivate({
      folder: `reports/${patientId}`,
      filename: file.originalname,
      buffer: file.buffer,
      contentType: file.mimetype,
    });

    return sendSuccess(res, { path: result.path }, 'Uploaded Report');
  } catch (err: any) {
    if (err.message === 'NO_FILE') return res.status(400).json({ success: false, message: 'No file uploaded' });
    next(err);
  }
}

/**
 * MEDICINE IMAGE (Public Catalog)
 * Path: public/medicines/...
 */
export async function uploadMedicineImage(req: Request, res: Response, next: NextFunction) {
  try {
    const file = requireFile(req);

    const result = await storageService.uploadPublic({
      folder: 'medicines',
      filename: file.originalname,
      buffer: file.buffer,
      contentType: file.mimetype,
    });

    return sendSuccess(res, { url: result.publicUrl, path: result.path }, 'Uploaded Medicine Image');
  } catch (err: any) {
    if (err.message === 'NO_FILE') return res.status(400).json({ success: false, message: 'No file uploaded' });
    next(err);
  }
}

/**
 * USER COVER
 * Path: public/covers/{userId}/...
 */
export async function uploadUserCover(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId } = req.params;
    const file = requireFile(req);

    const result = await storageService.uploadPublic({
      folder: `covers/${userId}`,
      filename: file.originalname,
      buffer: file.buffer,
      contentType: file.mimetype,
    });

    return sendSuccess(res, { url: result.publicUrl, path: result.path }, 'Uploaded Cover');
  } catch (err: any) {
    if (err.message === 'NO_FILE') return res.status(400).json({ success: false, message: 'No file uploaded' });
    next(err);
  }
}

/* ----------------------------------
   PRIVATE UPLOADS - CONTINUED
----------------------------------- */

/**
 * MEDICINE RETURN PROOF
 * Path: private/returns/{orderId}/...
 */
export async function uploadReturnProof(req: Request, res: Response, next: NextFunction) {
  try {
    const { orderId } = req.params;
    const file = requireFile(req);

    const result = await storageService.uploadPrivate({
      folder: `returns/${orderId}`,
      filename: file.originalname,
      buffer: file.buffer,
      contentType: file.mimetype,
    });

    return sendSuccess(res, { path: result.path }, 'Uploaded Return Proof');
  } catch (err: any) {
    if (err.message === 'NO_FILE') return res.status(400).json({ success: false, message: 'No file uploaded' });
    next(err);
  }
}

/**
 * SETTLEMENT INVOICE
 * Path: private/invoices/...
 */
export async function uploadSettlementInvoice(req: Request, res: Response, next: NextFunction) {
  try {
    const file = requireFile(req);

    const result = await storageService.uploadPrivate({
      folder: 'invoices',
      filename: file.originalname,
      buffer: file.buffer,
      contentType: file.mimetype,
    });

    return sendSuccess(res, { path: result.path }, 'Uploaded Invoice');
  } catch (err: any) {
    if (err.message === 'NO_FILE') return res.status(400).json({ success: false, message: 'No file uploaded' });
    next(err);
  }
}

/**
 * SUPPORT TICKET ATTACHMENT
 * Path: private/attachments/{userId}/...
 */
export async function uploadSupportAttachment(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const file = requireFile(req);

    const result = await storageService.uploadPrivate({
      folder: `attachments/${userId}`,
      filename: file.originalname,
      buffer: file.buffer,
      contentType: file.mimetype,
    });

    return sendSuccess(res, { path: result.path }, 'Uploaded Attachment');
  } catch (err: any) {
    if (err.message === 'NO_FILE') return res.status(400).json({ success: false, message: 'No file uploaded' });
    next(err);
  }
}


