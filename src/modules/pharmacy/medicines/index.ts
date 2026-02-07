/**
 * Medicine Module - Barrel Export
 */

export { medicineService } from './medicine.service.js';
import { medicineRepository } from '../../../database/repositories/medicine.repo.js';
export { medicineRoutes } from './medicine.routes.js';
export * from './medicine.types.js';
export * from './medicine.controller.js';

