import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { roleGuard } from '../../middlewares/role.middleware.js';
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
router.get('/my', getMyTickets);

/**
 * @route POST /api/v1/support
 * @desc Create a support ticket
 * @access Authenticated
 */
router.post('/', createTicket);

/**
 * @route GET /api/v1/support
 * @desc List all support tickets
 * @access Admin
 */
router.get('/', roleGuard('admin'), listTickets);

/**
 * @route GET /api/v1/support/:ticketId
 * @desc Get ticket by ID
 * @access Authenticated (own ticket) or Admin
 */
router.get('/:ticketId', getTicket);

/**
 * @route POST /api/v1/support/:ticketId/reply
 * @desc Reply to ticket
 * @access Authenticated
 */
router.post('/:ticketId/reply', replyToTicket);

/**
 * @route PATCH /api/v1/support/:ticketId
 * @desc Update ticket (status, priority, assignment)
 * @access Admin
 */
router.patch('/:ticketId', roleGuard('admin'), updateTicket);

/**
 * @route POST /api/v1/support/:ticketId/resolve
 * @desc Resolve ticket
 * @access Admin
 */
router.post('/:ticketId/resolve', roleGuard('admin'), resolveTicket);

/**
 * @route POST /api/v1/support/:ticketId/close
 * @desc Close ticket
 * @access Admin
 */
router.post('/:ticketId/close', roleGuard('admin'), closeTicket);

export const supportRoutes = router;

export default router;

