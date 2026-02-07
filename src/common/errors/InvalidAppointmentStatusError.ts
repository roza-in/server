import { ApiError } from './ApiError.js';

export class InvalidAppointmentStatusError extends ApiError {
    constructor(currentStatus: string, allowedStatuses: string) {
        super(`Invalid appointment status: ${currentStatus}. Allowed statuses: ${allowedStatuses}`, 400, 'INVALID_STATUS');
    }
}
