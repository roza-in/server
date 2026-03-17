import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { roleGuard } from '../../middlewares/role.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import {
    createTicketSchema,
    listTicketsSchema,
    getMyTicketsSchema,
    getTicketSchema,
    replyTicketSchema,
    updateTicketSchema,
    resolveTicketSchema,
    closeTicketSchema,
    rateTicketSchema,
} from './support.validator.js';
import {
    createTicket,
    getMyTickets,
    listTickets,
    getTicket,
    replyToTicket,
    updateTicket,
    resolveTicket,
    closeTicket,
    getTicketStats,
    rateTicket,
} from './support.controller.js';

const router = Router();

router.use(authMiddleware);

/**
 * @route GET /api/v1/support/stats
 * @desc Get ticket statistics
 * @access Admin
 */
router.get('/stats', roleGuard('admin'), getTicketStats);

/**
 * @route GET /api/v1/support/my
 * @desc Get my support tickets
 * @access Authenticated
 */
router.get('/my', validate(getMyTicketsSchema), getMyTickets);

/**
 * @route POST /api/v1/support
 * @desc Create a support ticket
 * @access Authenticated
 */
router.post('/', validate(createTicketSchema), createTicket);

/**
 * @route GET /api/v1/support
 * @desc List all support tickets
 * @access Admin
 */
router.get('/', roleGuard('admin'), validate(listTicketsSchema), listTickets);

/**
 * @route GET /api/v1/support/:ticketId
 * @desc Get ticket by ID
 * @access Authenticated (own ticket) or Admin
 */
router.get('/:ticketId', validate(getTicketSchema), getTicket);

/**
 * @route POST /api/v1/support/:ticketId/reply
 * @desc Reply to ticket (add message)
 * @access Authenticated
 */
router.post('/:ticketId/reply', validate(replyTicketSchema), replyToTicket);

/**
 * @route POST /api/v1/support/:ticketId/rate
 * @desc Rate a resolved ticket (customer satisfaction)
 * @access Authenticated (own ticket)
 */
router.post('/:ticketId/rate', validate(rateTicketSchema), rateTicket);

/**
 * @route PATCH /api/v1/support/:ticketId
 * @desc Update ticket (status, priority, assignment)
 * @access Admin
 */
router.patch('/:ticketId', roleGuard('admin'), validate(updateTicketSchema), updateTicket);

/**
 * @route POST /api/v1/support/:ticketId/resolve
 * @desc Resolve ticket
 * @access Admin
 */
router.post('/:ticketId/resolve', roleGuard('admin'), validate(resolveTicketSchema), resolveTicket);

/**
 * @route POST /api/v1/support/:ticketId/close
 * @desc Close ticket
 * @access Admin
 */
router.post('/:ticketId/close', roleGuard('admin'), validate(closeTicketSchema), closeTicket);

export const supportRoutes = router;

export default router;
