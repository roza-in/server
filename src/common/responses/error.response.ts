import { Response } from 'express';
import { HTTP_STATUS } from '../../config/constants.js';

export const sendError = (
    res: Response,
    message: string,
    statusCode: number = HTTP_STATUS.INTERNAL_SERVER_ERROR,
    code: string = 'INTERNAL_ERROR',
    details?: unknown
): Response => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

    return res.status(statusCode).json({
        success: false,
        message,
        error: {
            code,
            details,
        },
        timestamp: new Date().toISOString(),
    });
};
