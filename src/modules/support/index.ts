import { Request, Response } from 'express';
import { supportService } from './support.service.js';
import { sendSuccess, sendPaginated, calculatePagination } from '../../common/responses/index.js';
import { asyncHandler } from '../../middlewares/error.middleware.js';
import type { AuthenticatedRequest } from '../../types/request.js';

/**
 * Create support ticket
 */
export const createTicket = asyncHandler(async (req: Request, res: Response) => {
    const user = (req as AuthenticatedRequest).user;
    const ticket = await supportService.create(user.userId, req.body);
    return sendSuccess(res, ticket, 'Ticket created successfully', 201);
});

/**
 get my tickets
 */
export const getMyTickets = asyncHandler(async (req: Request, res: Response) => {
    const user = (req as AuthenticatedRequest).user;
    const { page, limit } = req.query as any;
    const result = await supportService.getUserTickets(user.userId, Number(page) || 1, Number(limit) || 20);
    const pagination = calculatePagination(result.total, result.page, result.limit);
    return sendPaginated(res, result.tickets, pagination);
});

/**
 * List all tickets
 */
export const listTickets = asyncHandler(async (req: Request, res: Response) => {
    const filters = req.query as any;
    const result = await supportService.list(filters);
    const pagination = calculatePagination(result.total, result.page, result.limit);
    return sendPaginated(res, result.tickets, pagination);
});

/**
 * Get ticket by ID
 */
export const getTicket = asyncHandler(async (req: Request, res: Response) => {
    const { ticketId } = req.params;
    const ticket = await supportService.getById(ticketId);
    return sendSuccess(res, ticket);
});

/**
 * Reply to ticket
 */
export const replyToTicket = asyncHandler(async (req: Request, res: Response) => {
    const { ticketId } = req.params;
    const user = (req as AuthenticatedRequest).user;
    const reply = await supportService.reply(ticketId, user.userId, req.body);
    return sendSuccess(res, reply, 'Reply added successfully', 201);
});

/**
 * Update ticket
 */
export const updateTicket = asyncHandler(async (req: Request, res: Response) => {
    const { ticketId } = req.params;
    const ticket = await supportService.update(ticketId, req.body);
    return sendSuccess(res, ticket, 'Ticket updated successfully');
});

/**
 * Resolve ticket
 */
export const resolveTicket = asyncHandler(async (req: Request, res: Response) => {
    const { ticketId } = req.params;
    const ticket = await supportService.resolve(ticketId, req.body);
    return sendSuccess(res, ticket, 'Ticket resolved successfully');
});

/**
 * Close ticket
 */
export const closeTicket = asyncHandler(async (req: Request, res: Response) => {
    const { ticketId } = req.params;
    const ticket = await supportService.close(ticketId);
    return sendSuccess(res, ticket, 'Ticket closed successfully');
});

/**
 * Get ticket stats
 */
export const getTicketStats = asyncHandler(async (_req: Request, res: Response) => {
    const stats = await supportService.getStats();
    return sendSuccess(res, stats);
});

export { supportService } from './support.service.js';
export * from './support.types.js';

