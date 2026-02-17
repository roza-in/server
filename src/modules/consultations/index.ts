export type {
  ConsultationWithDetails,
  ConsultationResponse,
  ConsultationFilters,
  ConsultationStatus,
  VideoCallToken,
  Medication,
} from './consultation.types.js';

// Input types from validator (canonical source)
export type {
  StartConsultationInput,
  EndConsultationInput,
  ListConsultationsInput,
  CreatePrescriptionInput,
  UpdateConsultationNotesInput,
  UpdateConsultationVitalsInput,
  JoinConsultationInput,
} from './consultation.validator.js';

// Validator schemas
export {
  startConsultationSchema,
  endConsultationSchema,
  listConsultationsSchema,
  getConsultationSchema,
  getVideoTokenSchema,
  updateConsultationNotesSchema,
  updateConsultationVitalsSchema,
  getConsultationStatusSchema,
  joinConsultationSchema,
  createPrescriptionSchema,
  getPrescriptionSchema,
} from './consultation.validator.js';

// Service and controller
export { consultationService } from './consultation.service.js';
export * from './consultation.controller.js';


