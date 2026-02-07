import { Request, Response } from 'express';
import { asyncHandler } from '../../middlewares/error.middleware.js';
import { sendSuccess, sendCreated, sendPaginated, calculatePagination } from '../../common/responses/index.js';
import { AuthenticatedRequest } from "../../types/request.js";
import { supportService } from './support.service.js';

/**
 * Get ticket statistics
 */
export const getTicketStats = asyncHandler(async (req: Request, res: Response) => {
    // Service takes no args
    const result = await supportService.getStats();
    return sendSuccess(res, result);
});

/**
 * Get my support tickets
 */
export const getMyTickets = asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as unknown as AuthenticatedRequest;
    const user = authReq.user;
    const filters = req.query as any;
    const page = filters.page ? parseInt(filters.page) : 1;
    const limit = filters.limit ? parseInt(filters.limit) : 20;

    const result = await supportService.getUserTickets(user.userId, page, limit);

    return sendPaginated(
        res,
        result.tickets,
        calculatePagination(result.total, page, limit)
    );
});

/**
 * Create a support ticket
 */
export const createTicket = asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as unknown as AuthenticatedRequest;
    const user = authReq.user;
    const data = req.body;

    const result = await supportService.create(user.userId, data);
    return sendCreated(res, result, 'Support ticket created successfully');
});

/**
 * List all support tickets
 */
export const listTickets = asyncHandler(async (req: Request, res: Response) => {
    const filters = req.query as any;
    const page = filters.page ? parseInt(filters.page) : 1;
    const limit = filters.limit ? parseInt(filters.limit) : 20;

    const result = await supportService.list({
        ...filters,
        page,
        limit
    });

    return sendPaginated(
        res,
        result.tickets,
        calculatePagination(result.total, page, limit)
    );
});

/**
 * Get ticket by ID
 */
export const getTicket = asyncHandler(async (req: Request, res: Response) => {
    const { ticketId } = req.params;
    const result = await supportService.getById(ticketId);
    return sendSuccess(res, result);
});

/**
 * Reply to ticket
 */
export const replyToTicket = asyncHandler(async (req: Request, res: Response) => {
    const { ticketId } = req.params;
    const { message, attachments } = req.body;
    const authReq = req as unknown as AuthenticatedRequest;
    const user = authReq.user;

    const result = await supportService.reply(ticketId, user.userId, {
        message,
        attachments
    });
    return sendSuccess(res, result, 'Reply added successfully');
});

/**
 * Update ticket (status, priority, assignment)
 */
export const updateTicket = asyncHandler(async (req: Request, res: Response) => {
    const { ticketId } = req.params;
    const data = req.body; // status, priority, assignedTo
    const result = await supportService.update(ticketId, data);
    return sendSuccess(res, result, 'Ticket updated successfully');
});

/**
 * Resolve ticket
 */
export const resolveTicket = asyncHandler(async (req: Request, res: Response) => {
    const { ticketId } = req.params;
    const { resolutionNotes } = req.body;

    // Check service method signature: resolve(ticketId, input)
    const result = await supportService.resolve(ticketId, { resolution: resolutionNotes });
    return sendSuccess(res, result, 'Ticket resolved successfully');
});

/**
 * Close ticket
 */
export const closeTicket = asyncHandler(async (req: Request, res: Response) => {
    const { ticketId } = req.params;
    // Service method takes ticketId
    const result = await supportService.close(ticketId);
    return sendSuccess(res, result, 'Ticket closed successfully');
});
