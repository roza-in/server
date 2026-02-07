import { Response } from 'express';
import { ApiResponse, sendSuccess, sendCreated, sendNoContent, sendPaginated, PaginationMeta } from '../common/responses/index.js';
import { HTTP_STATUS } from '../config/constants.js';

/**
 * Base Controller - Standardizes API response handling
 */
export abstract class BaseController {
    /**
     * Send success response
     */
    protected ok<T>(res: Response, data?: T, message?: string): Response<ApiResponse<T>> {
        return sendSuccess(res, data, message);
    }

    /**
     * Send created response
     */
    protected created<T>(res: Response, data?: T, message?: string): Response<ApiResponse<T>> {
        return sendCreated(res, data, message);
    }

    /**
     * Send no content response
     */
    protected noContent(res: Response): Response {
        return sendNoContent(res);
    }

    /**
     * Send paginated response
     */
    protected paginate<T>(
        res: Response,
        data: T[],
        total: number,
        page: number,
        limit: number,
        message?: string
    ): Response<ApiResponse<T[]>> {
        const meta: PaginationMeta = {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        };
        return sendPaginated(res, data, meta, message);
    }
}
