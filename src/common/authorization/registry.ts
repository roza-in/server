import { policyService } from './policy.service.js';
import { hospitalPolicy } from '../../modules/hospitals/hospital.policy.js';
import { doctorPolicy } from '../../modules/doctors/doctor.policy.js';

/**
 * Register all application policies
 */
export function registerPolicies(): void {
    policyService.register('hospital', hospitalPolicy);
    policyService.register('doctor', doctorPolicy);

    // Register other policies as they are implemented
    // policyService.register('appointment', appointmentPolicy);
}
