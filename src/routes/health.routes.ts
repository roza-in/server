import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import {
  // Family Members
  createFamilyMember,
  getFamilyMember,
  listFamilyMembers,
  updateFamilyMember,
  deleteFamilyMember,
  // Documents
  uploadDocument,
  getDocument,
  listDocuments,
  updateDocument,
  deleteDocument,
  // Vitals
  createVitalRecord,
  getVitalRecord,
  listVitals,
  deleteVitalRecord,
  getVitalTrends,
  // Medications
  createMedication,
  getMedication,
  listMedications,
  updateMedication,
  deleteMedication,
  recordMedicationAction,
  getUpcomingReminders,
  // Allergies
  createAllergy,
  getAllergy,
  listAllergies,
  updateAllergy,
  deleteAllergy,
  // Summary
  getHealthSummary,
  getFamilyHealthSummary,
} from '../modules/health-records/health-records.controller.js';
import {
  createFamilyMemberSchema,
  updateFamilyMemberSchema,
  getFamilyMemberSchema,
  deleteFamilyMemberSchema,
  uploadDocumentSchema,
  updateDocumentSchema,
  listDocumentsSchema,
  createVitalRecordSchema,
  listVitalsSchema,
  createMedicationSchema,
  updateMedicationSchema,
  listMedicationsSchema,
  recordReminderActionSchema,
  createAllergySchema,
  updateAllergySchema,
  listAllergiesSchema,
  getHealthSummarySchema,
} from '../modules/health-records/health-records.validator.js';

const router = Router();

// ============================================================================
// Family Members
// ============================================================================

/**
 * @route POST /api/v1/health/family-members
 * @desc Add a family member
 * @access Private
 */
router.post(
  '/family-members',
  authenticate,
  validate(createFamilyMemberSchema),
  createFamilyMember
);

/**
 * @route GET /api/v1/health/family-members
 * @desc List all family members
 * @access Private
 */
router.get('/family-members', authenticate, listFamilyMembers);

/**
 * @route GET /api/v1/health/family-members/:memberId
 * @desc Get family member details
 * @access Private
 */
router.get(
  '/family-members/:memberId',
  authenticate,
  validate(getFamilyMemberSchema),
  getFamilyMember
);

/**
 * @route PATCH /api/v1/health/family-members/:memberId
 * @desc Update family member
 * @access Private
 */
router.patch(
  '/family-members/:memberId',
  authenticate,
  validate(updateFamilyMemberSchema),
  updateFamilyMember
);

/**
 * @route DELETE /api/v1/health/family-members/:memberId
 * @desc Delete family member
 * @access Private
 */
router.delete(
  '/family-members/:memberId',
  authenticate,
  validate(deleteFamilyMemberSchema),
  deleteFamilyMember
);

// ============================================================================
// Health Documents
// ============================================================================

/**
 * @route POST /api/v1/health/documents
 * @desc Upload health document
 * @access Private
 */
router.post(
  '/documents',
  authenticate,
  validate(uploadDocumentSchema),
  uploadDocument
);

/**
 * @route GET /api/v1/health/documents
 * @desc List health documents
 * @access Private
 */
router.get(
  '/documents',
  authenticate,
  validate(listDocumentsSchema),
  listDocuments
);

/**
 * @route GET /api/v1/health/documents/:documentId
 * @desc Get document details
 * @access Private
 */
router.get('/documents/:documentId', authenticate, getDocument);

/**
 * @route PATCH /api/v1/health/documents/:documentId
 * @desc Update document
 * @access Private
 */
router.patch(
  '/documents/:documentId',
  authenticate,
  validate(updateDocumentSchema),
  updateDocument
);

/**
 * @route DELETE /api/v1/health/documents/:documentId
 * @desc Delete document
 * @access Private
 */
router.delete('/documents/:documentId', authenticate, deleteDocument);

// ============================================================================
// Vital Records
// ============================================================================

/**
 * @route POST /api/v1/health/vitals
 * @desc Record vital signs
 * @access Private
 */
router.post(
  '/vitals',
  authenticate,
  validate(createVitalRecordSchema),
  createVitalRecord
);

/**
 * @route GET /api/v1/health/vitals
 * @desc List vital records
 * @access Private
 */
router.get(
  '/vitals',
  authenticate,
  validate(listVitalsSchema),
  listVitals
);

/**
 * @route GET /api/v1/health/vitals/trends
 * @desc Get vital trends
 * @access Private
 */
router.get('/vitals/trends', authenticate, getVitalTrends);

/**
 * @route GET /api/v1/health/vitals/:vitalId
 * @desc Get vital record details
 * @access Private
 */
router.get('/vitals/:vitalId', authenticate, getVitalRecord);

/**
 * @route DELETE /api/v1/health/vitals/:vitalId
 * @desc Delete vital record
 * @access Private
 */
router.delete('/vitals/:vitalId', authenticate, deleteVitalRecord);

// ============================================================================
// Medications & Reminders
// ============================================================================

/**
 * @route POST /api/v1/health/medications
 * @desc Add medication with reminders
 * @access Private
 */
router.post(
  '/medications',
  authenticate,
  validate(createMedicationSchema),
  createMedication
);

/**
 * @route GET /api/v1/health/medications
 * @desc List medications
 * @access Private
 */
router.get(
  '/medications',
  authenticate,
  validate(listMedicationsSchema),
  listMedications
);

/**
 * @route GET /api/v1/health/reminders
 * @desc Get upcoming medication reminders
 * @access Private
 */
router.get('/reminders', authenticate, getUpcomingReminders);

/**
 * @route GET /api/v1/health/medications/:medicationId
 * @desc Get medication details
 * @access Private
 */
router.get('/medications/:medicationId', authenticate, getMedication);

/**
 * @route PATCH /api/v1/health/medications/:medicationId
 * @desc Update medication
 * @access Private
 */
router.patch(
  '/medications/:medicationId',
  authenticate,
  validate(updateMedicationSchema),
  updateMedication
);

/**
 * @route DELETE /api/v1/health/medications/:medicationId
 * @desc Stop/delete medication
 * @access Private
 */
router.delete('/medications/:medicationId', authenticate, deleteMedication);

/**
 * @route POST /api/v1/health/medications/:medicationId/actions
 * @desc Record medication action (taken/skipped)
 * @access Private
 */
router.post(
  '/medications/:medicationId/actions',
  authenticate,
  validate(recordReminderActionSchema),
  recordMedicationAction
);

// ============================================================================
// Allergies
// ============================================================================

/**
 * @route POST /api/v1/health/allergies
 * @desc Add allergy
 * @access Private
 */
router.post(
  '/allergies',
  authenticate,
  validate(createAllergySchema),
  createAllergy
);

/**
 * @route GET /api/v1/health/allergies
 * @desc List allergies
 * @access Private
 */
router.get(
  '/allergies',
  authenticate,
  validate(listAllergiesSchema),
  listAllergies
);

/**
 * @route GET /api/v1/health/allergies/:allergyId
 * @desc Get allergy details
 * @access Private
 */
router.get('/allergies/:allergyId', authenticate, getAllergy);

/**
 * @route PATCH /api/v1/health/allergies/:allergyId
 * @desc Update allergy
 * @access Private
 */
router.patch(
  '/allergies/:allergyId',
  authenticate,
  validate(updateAllergySchema),
  updateAllergy
);

/**
 * @route DELETE /api/v1/health/allergies/:allergyId
 * @desc Delete allergy
 * @access Private
 */
router.delete('/allergies/:allergyId', authenticate, deleteAllergy);

// ============================================================================
// Health Summary
// ============================================================================

/**
 * @route GET /api/v1/health/summary
 * @desc Get health summary (optionally for family member)
 * @access Private
 */
router.get(
  '/summary',
  authenticate,
  validate(getHealthSummarySchema),
  getHealthSummary
);

/**
 * @route GET /api/v1/health/family-summary/:memberId
 * @desc Get family member health summary
 * @access Private
 */
router.get('/family-summary/:memberId', authenticate, getFamilyHealthSummary);

export default router;
