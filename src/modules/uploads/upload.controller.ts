import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import type { File as MulterFile } from 'multer';
import { randomUUID } from 'crypto';
import { storageService } from './storage.service.js';
import { logger } from '../../config/logger.js';
import { sendSuccess } from '../../common/responses/index.js';
import { supabaseAdmin } from '../../database/supabase-admin.js';

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
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter(req, file, cb) {
    const allowed = [
      'image/png',
      'image/jpeg',
      'image/webp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ];
    if (!allowed.includes(file.mimetype)) {
      cb(new Error('Invalid file type. Allowed: Images, PDF, Word Docs'));
    } else {
      cb(null, true);
    }
  },
});

/* ----------------------------------
   HELPERS
----------------------------------- */
function uniqueFilename(original: string) {
  return `${randomUUID()}-${original}`;
}

const ALLOWED_BUCKETS = ['hospitals', 'doctors', 'patients'];

/* ----------------------------------
   HOSPITAL LOGO
   POST /uploads/hospitals/:hospitalId/logo
----------------------------------- */
export async function uploadHospitalLogo(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { hospitalId } = req.params;
    const file = (req as MulterRequest).file;

    if (!file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const bucket = 'hospitals';
    const prefix = `hospital-${hospitalId}/logo`;
    const filename = uniqueFilename(file.originalname);

    const result = await storageService.uploadBuffer(
      bucket,
      prefix,
      filename,
      file.buffer,
      file.mimetype
    );

    const { error } = await supabaseAdmin
      .from('hospitals')
      .update({ logo_url: result.publicUrl })
      .eq('id', hospitalId);

    if (error) throw error;

    return sendSuccess(res, { url: result.publicUrl, path: result.path }, 'Uploaded');
  } catch (err) {
    logger.error('uploadHospitalLogo error', { err });
    next(err);
  }
}

/* ----------------------------------
   HOSPITAL IMAGES (MULTIPLE)
   POST /uploads/hospitals/:hospitalId/images
----------------------------------- */
export async function uploadHospitalImages(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { hospitalId } = req.params;
    const files = (req as MulterRequest).files;

    if (!files || files.length === 0) {
      return res.status(400).json({ success: false, message: 'No files uploaded' });
    }

    const bucket = 'hospitals';

    const uploadedUrls: string[] = [];

    // Upload images
    for (const file of files) {
      const filename = uniqueFilename(file.originalname);
      const result = await storageService.uploadBuffer(
        bucket,
        `hospital-${hospitalId}/images`,
        filename,
        file.buffer,
        file.mimetype
      );
      uploadedUrls.push(result.publicUrl);
    }

    // Get existing images
    const { data, error: fetchError } = await supabaseAdmin
      .from('hospitals')
      .select('images')
      .eq('id', hospitalId)
      .single();

    if (fetchError) throw fetchError;

    const existingImages: string[] = data?.images ?? [];

    // Update hospital record
    const { error: updateError } = await supabaseAdmin
      .from('hospitals')
      .update({ images: [...existingImages, ...uploadedUrls] })
      .eq('id', hospitalId);

    if (updateError) throw updateError;

    return sendSuccess(res, { urls: uploadedUrls }, 'Uploaded');
  } catch (err) {
    logger.error('uploadHospitalImages error', { err });
    next(err);
  }
}

/* ----------------------------------
   DOCTOR AVATAR
   POST /uploads/doctors/:doctorId/avatar
----------------------------------- */
export async function uploadDoctorAvatar(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { doctorId } = req.params;
    const file = (req as MulterRequest).file;

    if (!file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const filename = uniqueFilename(file.originalname);

    const result = await storageService.uploadBuffer(
      'doctors',
      `doctor-${doctorId}/avatar`,
      filename,
      file.buffer,
      file.mimetype
    );

    const { error } = await supabaseAdmin
      .from('doctors')
      .update({ profile_image_url: result.publicUrl })
      .eq('id', doctorId);

    if (error) throw error;

    return sendSuccess(res, { url: result.publicUrl, path: result.path }, 'Uploaded');
  } catch (err) {
    logger.error('uploadDoctorAvatar error', { err });
    next(err);
  }
}

/* ----------------------------------
   PATIENT AVATAR
   POST /uploads/patients/:userId/avatar
----------------------------------- */
export async function uploadPatientAvatar(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { userId } = req.params;
    const file = (req as MulterRequest).file;

    if (!file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const filename = uniqueFilename(file.originalname);

    const result = await storageService.uploadBuffer(
      'patients',
      `patient-${userId}/avatar`,
      filename,
      file.buffer,
      file.mimetype
    );

    const { error } = await supabaseAdmin
      .from('users')
      .update({ avatar_url: result.publicUrl })
      .eq('id', userId);

    if (error) throw error;

    return sendSuccess(res, { url: result.publicUrl, path: result.path }, 'Uploaded');
  } catch (err) {
    logger.error('uploadPatientAvatar error', { err });
    next(err);
  }
}

/* ----------------------------------
   GENERIC UPLOAD (SAFE)
   POST /uploads/:bucket/:id
----------------------------------- */
export async function uploadGeneric(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { bucket, id } = req.params;
    const file = (req as MulterRequest).file;

    if (!file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    if (!ALLOWED_BUCKETS.includes(bucket)) {
      return res.status(400).json({ success: false, message: 'Invalid bucket' });
    }

    const filename = uniqueFilename(file.originalname);

    const result = await storageService.uploadBuffer(
      bucket,
      id,
      filename,
      file.buffer,
      file.mimetype
    );

    return sendSuccess(res, { url: result.publicUrl, path: result.path }, 'Uploaded');
  } catch (err) {
    logger.error('uploadGeneric error', { err });
    next(err);
  }
}

