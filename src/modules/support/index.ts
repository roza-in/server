// Re-export types
export type {
    TicketStatus,
    TicketPriority,
    TicketCategory,
    SupportTicketDTO,
    TicketMessageDTO,
    SupportTicketDetailDTO,
    TicketFilters,
} from './support.types.js';

// Export validators
export {
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

// Export service
export { supportService } from './support.service.js';

// Export routes
export { supportRoutes } from './support.routes.js';

// Export controller functions
export {
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
