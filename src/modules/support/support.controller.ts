import { Request, Response } from 'express';
import { asyncHandler } from '../../middlewares/error.middleware.js';
import { sendSuccess, sendCreated, sendPaginated, calculatePagination } from '../../common/responses/index.js';
import type { AuthenticatedRequest } from '../../types/request.js';
import { supportService } from './support.service.js';
import type {
    CreateTicketInput,
    ReplyTicketInput,
    UpdateTicketInput,
    ResolveTicketInput,
    RateTicketInput,
} from './support.validator.js';

/**
 * Get ticket statistics (Admin)
 */
export const getTicketStats = asyncHandler(async (_req: Request, res: Response) => {
    const result = await supportService.getStats();
    return sendSuccess(res, result);
});

/**
 * Get my support tickets
 */
export const getMyTickets = asyncHandler(async (req: Request, res: Response) => {
    const user = (req as AuthenticatedRequest).user;
    const page = req.query.page ? parseInt(req.query.page as string) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;

    const result = await supportService.getUserTickets(user.userId, page, limit);
    return sendPaginated(res, result.tickets, calculatePagination(result.total, page, limit));
});

/**
 * Create a support ticket
 */
export const createTicket = asyncHandler(async (req: Request, res: Response) => {
    const user = (req as AuthenticatedRequest).user;
    const data = req.body as CreateTicketInput;
    const result = await supportService.create(user.userId, data);
    return sendCreated(res, result, 'Support ticket created successfully');
});

/**
 * List all support tickets (Admin)
 */
export const listTickets = asyncHandler(async (req: Request, res: Response) => {
    const filters = req.query as any;
    const page = filters.page ? parseInt(filters.page) : 1;
    const limit = filters.limit ? parseInt(filters.limit) : 20;

    const result = await supportService.list({ ...filters, page, limit });
    return sendPaginated(res, result.tickets, calculatePagination(result.total, page, limit));
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
 * Reply to ticket (add message)
 */
export const replyToTicket = asyncHandler(async (req: Request, res: Response) => {
    const { ticketId } = req.params;
    const user = (req as AuthenticatedRequest).user;
    const data = req.body as ReplyTicketInput;
    const result = await supportService.reply(ticketId, user.userId, user.role, data);
    return sendCreated(res, result, 'Reply added successfully');
});

/**
 * Update ticket (Admin: status, priority, assignment)
 */
export const updateTicket = asyncHandler(async (req: Request, res: Response) => {
    const { ticketId } = req.params;
    const user = (req as AuthenticatedRequest).user;
    const data = req.body as UpdateTicketInput;
    const result = await supportService.update(ticketId, user.userId, data);
    return sendSuccess(res, result, 'Ticket updated successfully');
});

/**
 * Resolve ticket (Admin)
 */
export const resolveTicket = asyncHandler(async (req: Request, res: Response) => {
    const { ticketId } = req.params;
    const user = (req as AuthenticatedRequest).user;
    const data = req.body as ResolveTicketInput;
    const result = await supportService.resolve(ticketId, user.userId, data);
    return sendSuccess(res, result, 'Ticket resolved successfully');
});

/**
 * Close ticket (Admin)
 */
export const closeTicket = asyncHandler(async (req: Request, res: Response) => {
    const { ticketId } = req.params;
    const result = await supportService.close(ticketId);
    return sendSuccess(res, result, 'Ticket closed successfully');
});

/**
 * Rate resolved ticket (Customer satisfaction)
 */
export const rateTicket = asyncHandler(async (req: Request, res: Response) => {
    const { ticketId } = req.params;
    const user = (req as AuthenticatedRequest).user;
    const data = req.body as RateTicketInput;
    const result = await supportService.rate(ticketId, user.userId, data);
    return sendSuccess(res, result, 'Thank you for your feedback');
});
