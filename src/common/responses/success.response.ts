import { Response } from 'express';
import { HTTP_STATUS, MESSAGES } from '../../config/constants.js';

export interface ApiResponse<T = unknown> {
    success: boolean;
    message: string;
    data?: T;
    meta?: {
        page?: number;
        limit?: number;
        total?: number;
        totalPages?: number;
    };
    timestamp: string;
}

export interface PaginationMeta {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

export const calculatePagination = (
    total: number,
    page: number,
    limit: number
): PaginationMeta => ({
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
});

export const sendSuccess = <T>(
    res: Response,
    data?: T,
    message: string = MESSAGES.SUCCESS,
    statusCode: number = HTTP_STATUS.OK,
    meta?: PaginationMeta
): Response<ApiResponse<T>> => {
    const response: ApiResponse<T> = {
        success: true,
        message,
        data,
        timestamp: new Date().toISOString(),
    };

    if (meta) {
        response.meta = meta;
    }

    return res.status(statusCode).json(response);
};

export const sendCreated = <T>(
    res: Response,
    data?: T,
    message: string = MESSAGES.CREATED
): Response<ApiResponse<T>> => {
    return sendSuccess(res, data, message, HTTP_STATUS.CREATED);
};

export const sendNoContent = (res: Response): Response => {
    return res.status(HTTP_STATUS.NO_CONTENT).send();
};

export const sendPaginated = <T>(
    res: Response,
    data: T[],
    pagination: PaginationMeta,
    message: string = MESSAGES.SUCCESS
): Response<ApiResponse<T[]>> => {
    return sendSuccess(res, data, message, HTTP_STATUS.OK, pagination);
};
