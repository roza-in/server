import { ApiError } from './ApiError.js';
import { HTTP_STATUS } from '../../config/constants.js';

export class ValidationError extends ApiError {
    public readonly errors: Array<{ field: string; message: string }>;

    constructor(
        errors: Array<{ field: string; message: string }>,
        message: string = 'Validation failed'
    ) {
        super(message, HTTP_STATUS.UNPROCESSABLE_ENTITY, 'VALIDATION_ERROR', true, { errors });
        this.errors = errors;
    }
}
