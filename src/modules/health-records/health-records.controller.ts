import { Request, Response } from 'express';
import { healthRecordsService } from './health-records.service.js';
import { sendSuccess, sendCreated, sendPaginated, sendNoContent, calculatePagination } from '../../common/responses/index.js';
import { asyncHandler } from '@/middlewares/error.middleware.js';
import { MESSAGES } from '../../config/constants.js';
import type { AuthenticatedRequest } from '../../types/request.js';
import type {
  CreateFamilyMemberInput,
  UpdateFamilyMemberInput,
  UploadDocumentInput,
  UpdateDocumentInput,
  ListDocumentsInput,
  CreateVitalRecordInput,
  ListVitalsInput,
  CreateMedicationInput,
  UpdateMedicationInput,
  ListMedicationsInput,
  CreateAllergyInput,
  UpdateAllergyInput,
  ListAllergiesInput,
} from './health-records.validator.js';

/**
 * Health Records Controller - Production-ready HTTP endpoints
 * Features: Family members, documents, vitals, medications, allergies
 */

// ============================================================================
// Family Members
// ============================================================================

/**
 * Create family member
 * POST /api/v1/health/family-members
 */
export const createFamilyMember = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as AuthenticatedRequest).user;
  const data = req.body as CreateFamilyMemberInput;
  const member = await healthRecordsService.createFamilyMember(user.userId, data);
  return sendCreated(res, member, 'Family member added successfully');
});

/**
 * Get family member by ID
 * GET /api/v1/health/family-members/:memberId
 */
export const getFamilyMember = asyncHandler(async (req: Request, res: Response) => {
  const { memberId } = req.params;
  const user = (req as AuthenticatedRequest).user;
  const member = await healthRecordsService.getFamilyMember(memberId, user.userId);
  return sendSuccess(res, member);
});

/**
 * List family members
 * GET /api/v1/health/family-members
 */
export const listFamilyMembers = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as AuthenticatedRequest).user;
  const members = await healthRecordsService.listFamilyMembers(user.userId);
  return sendSuccess(res, members);
});

/**
 * Update family member
 * PATCH /api/v1/health/family-members/:memberId
 */
export const updateFamilyMember = asyncHandler(async (req: Request, res: Response) => {
  const { memberId } = req.params;
  const user = (req as AuthenticatedRequest).user;
  const data = req.body as UpdateFamilyMemberInput;
  const member = await healthRecordsService.updateFamilyMember(memberId, user.userId, data);
  return sendSuccess(res, member, MESSAGES.UPDATED);
});

/**
 * Delete family member
 * DELETE /api/v1/health/family-members/:memberId
 */
export const deleteFamilyMember = asyncHandler(async (req: Request, res: Response) => {
  const { memberId } = req.params;
  const user = (req as AuthenticatedRequest).user;
  await healthRecordsService.deleteFamilyMember(memberId, user.userId);
  return sendNoContent(res);
});

// ============================================================================
// Health Documents
// ============================================================================

/**
 * Upload document
 * POST /api/v1/health/documents
 */
export const uploadDocument = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as AuthenticatedRequest).user;
  const data = req.body as UploadDocumentInput;
  const document = await healthRecordsService.uploadDocument(user.userId, data);
  return sendCreated(res, document, 'Document uploaded successfully');
});

/**
 * Get document by ID
 * GET /api/v1/health/documents/:documentId
 */
export const getDocument = asyncHandler(async (req: Request, res: Response) => {
  const { documentId } = req.params;
  const user = (req as AuthenticatedRequest).user;
  const document = await healthRecordsService.getDocument(documentId, user.userId);
  return sendSuccess(res, document);
});

/**
 * List documents
 * GET /api/v1/health/documents
 */
export const listDocuments = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as AuthenticatedRequest).user;
  const filters = {
    ...req.query as unknown as ListDocumentsInput,
    user_id: user.userId,
  };
  const { page = 1, limit = 20 } = filters;
  const result = await healthRecordsService.listDocuments(filters);
  return sendPaginated(
    res,
    result.documents,
    calculatePagination(result.total, page, limit)
  );
});

/**
 * Update document
 * PATCH /api/v1/health/documents/:documentId
 */
export const updateDocument = asyncHandler(async (req: Request, res: Response) => {
  const { documentId } = req.params;
  const user = (req as AuthenticatedRequest).user;
  const data = req.body as UpdateDocumentInput;
  const document = await healthRecordsService.updateDocument(documentId, user.userId, data);
  return sendSuccess(res, document, MESSAGES.UPDATED);
});

/**
 * Delete document
 * DELETE /api/v1/health/documents/:documentId
 */
export const deleteDocument = asyncHandler(async (req: Request, res: Response) => {
  const { documentId } = req.params;
  const user = (req as AuthenticatedRequest).user;
  await healthRecordsService.deleteDocument(documentId, user.userId);
  return sendNoContent(res);
});

// ============================================================================
// Vital Records
// ============================================================================

/**
 * Create vital record
 * POST /api/v1/health/vitals
 */
export const createVitalRecord = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as AuthenticatedRequest).user;
  const data = req.body as CreateVitalRecordInput;
  const vital = await healthRecordsService.createVitalRecord(user.userId, data);
  return sendCreated(res, vital, 'Vital record saved successfully');
});

/**
 * Get vital record by ID
 * GET /api/v1/health/vitals/:vitalId
 */
export const getVitalRecord = asyncHandler(async (req: Request, res: Response) => {
  const { vitalId } = req.params;
  const user = (req as AuthenticatedRequest).user;
  const vital = await healthRecordsService.getVitalRecord(vitalId, user.userId);
  return sendSuccess(res, vital);
});

/**
 * List vital records
 * GET /api/v1/health/vitals
 */
export const listVitals = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as AuthenticatedRequest).user;
  const filters = {
    ...req.query as unknown as ListVitalsInput,
    user_id: user.userId,
  };
  const { page = 1, limit = 20 } = filters;
  const result = await healthRecordsService.listVitals(filters);
  return sendPaginated(
    res,
    result.vitals,
    calculatePagination(result.total, page, limit)
  );
});

/**
 * Delete vital record
 * DELETE /api/v1/health/vitals/:vitalId
 */
export const deleteVitalRecord = asyncHandler(async (req: Request, res: Response) => {
  const { vitalId } = req.params;
  const user = (req as AuthenticatedRequest).user;
  await healthRecordsService.deleteVitalRecord(vitalId, user.userId);
  return sendNoContent(res);
});

/**
 * Get vital trends
 * GET /api/v1/health/vitals/trends
 */
export const getVitalTrends = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as AuthenticatedRequest).user;
  const { family_member_id, days } = req.query;
  const trends = await healthRecordsService.getVitalTrends(
    user.userId,
    family_member_id as string | undefined,
    parseInt(days as string) || 30
  );
  return sendSuccess(res, trends);
});

// ============================================================================
// Medications & Reminders
// ============================================================================

/**
 * Create medication
 * POST /api/v1/health/medications
 */
export const createMedication = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as AuthenticatedRequest).user;
  const data = req.body as CreateMedicationInput;
  const medication = await healthRecordsService.createMedication(user.userId, data);
  return sendCreated(res, medication, 'Medication reminder created');
});

/**
 * Get medication by ID
 * GET /api/v1/health/medications/:medicationId
 */
export const getMedication = asyncHandler(async (req: Request, res: Response) => {
  const { medicationId } = req.params;
  const user = (req as AuthenticatedRequest).user;
  const medication = await healthRecordsService.getMedication(medicationId, user.userId);
  return sendSuccess(res, medication);
});

/**
 * List medications
 * GET /api/v1/health/medications
 */
export const listMedications = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as AuthenticatedRequest).user;
  const filters = {
    ...req.query as unknown as ListMedicationsInput,
    user_id: user.userId,
  };
  const result = await healthRecordsService.listMedications(filters);
  return sendPaginated(
    res,
    result.medications,
    calculatePagination(result.total, result.page, result.limit)
  );
});

/**
 * Update medication
 * PATCH /api/v1/health/medications/:medicationId
 */
export const updateMedication = asyncHandler(async (req: Request, res: Response) => {
  const { medicationId } = req.params;
  const user = (req as AuthenticatedRequest).user;
  const data = req.body as UpdateMedicationInput;
  const medication = await healthRecordsService.updateMedication(medicationId, user.userId, data);
  return sendSuccess(res, medication, MESSAGES.UPDATED);
});

/**
 * Delete medication
 * DELETE /api/v1/health/medications/:medicationId
 */
export const deleteMedication = asyncHandler(async (req: Request, res: Response) => {
  const { medicationId } = req.params;
  const user = (req as AuthenticatedRequest).user;
  await healthRecordsService.deleteMedication(medicationId, user.userId);
  return sendNoContent(res);
});

/**
 * Record medication action (taken/skipped/snoozed)
 * POST /api/v1/health/medications/:medicationId/actions
 */
export const recordMedicationAction = asyncHandler(async (req: Request, res: Response) => {
  const { medicationId } = req.params;
  const user = (req as AuthenticatedRequest).user;
  const { action, scheduled_time, taken_at, notes } = req.body;
  const result = await healthRecordsService.recordMedicationAction(
    medicationId,
    user.userId,
    { action, scheduled_time, taken_at, notes }
  );
  return sendSuccess(res, result, action === 'taken' ? 'Medication marked as taken' : 'Action recorded');
});

/**
 * Get upcoming reminders
 * GET /api/v1/health/reminders
 */
export const getUpcomingReminders = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as AuthenticatedRequest).user;
  const { family_member_id } = req.query;
  const reminders = await healthRecordsService.getUpcomingReminders(
    user.userId,
    family_member_id as string | undefined
  );
  return sendSuccess(res, reminders);
});

// ============================================================================
// Allergies
// ============================================================================

/**
 * Create allergy
 * POST /api/v1/health/allergies
 */
export const createAllergy = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as AuthenticatedRequest).user;
  const data = req.body as CreateAllergyInput;
  const allergy = await healthRecordsService.createAllergy(user.userId, data);
  return sendCreated(res, allergy, 'Allergy added successfully');
});

/**
 * Get allergy by ID
 * GET /api/v1/health/allergies/:allergyId
 */
export const getAllergy = asyncHandler(async (req: Request, res: Response) => {
  const { allergyId } = req.params;
  const user = (req as AuthenticatedRequest).user;
  const allergy = await healthRecordsService.getAllergy(allergyId, user.userId);
  return sendSuccess(res, allergy);
});

/**
 * List allergies
 * GET /api/v1/health/allergies
 */
export const listAllergies = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as AuthenticatedRequest).user;
  const { family_member_id } = req.query as unknown as ListAllergiesInput;
  const result = await healthRecordsService.listAllergies(user.userId, family_member_id);
  return sendSuccess(res, result);
});

/**
 * Update allergy
 * PATCH /api/v1/health/allergies/:allergyId
 */
export const updateAllergy = asyncHandler(async (req: Request, res: Response) => {
  const { allergyId } = req.params;
  const user = (req as AuthenticatedRequest).user;
  const data = req.body as UpdateAllergyInput;
  const allergy = await healthRecordsService.updateAllergy(allergyId, user.userId, data);
  return sendSuccess(res, allergy, MESSAGES.UPDATED);
});

/**
 * Delete allergy
 * DELETE /api/v1/health/allergies/:allergyId
 */
export const deleteAllergy = asyncHandler(async (req: Request, res: Response) => {
  const { allergyId } = req.params;
  const user = (req as AuthenticatedRequest).user;
  await healthRecordsService.deleteAllergy(allergyId, user.userId);
  return sendNoContent(res);
});

// ============================================================================
// Health Summary
// ============================================================================

/**
 * Get health summary for user or family member
 * GET /api/v1/health/summary
 */
export const getHealthSummary = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as AuthenticatedRequest).user;
  const { family_member_id } = req.query;
  const summary = await healthRecordsService.getHealthSummaryForMember(
    user.userId,
    family_member_id as string | undefined
  );
  return sendSuccess(res, summary);
});

/**
 * Get family health overview
 * GET /api/v1/health/family-summary/:memberId
 */
export const getFamilyHealthSummary = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as AuthenticatedRequest).user;
  const { memberId } = req.params;
  const summary = await healthRecordsService.getFamilyHealthSummary(user.userId, memberId);
  return sendSuccess(res, summary);
});


