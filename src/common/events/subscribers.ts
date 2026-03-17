import { eventBus } from './event-bus.js';
import { logger } from '../../config/logger.js';
import { cacheInvalidate, CacheKeys } from '../../config/redis.js';

const log = logger.child('EventSubscribers');

/**
 * Register all domain event subscribers.
 * Call once during server startup.
 *
 * Subscribers handle side-effects (cache invalidation, audit logging, analytics)
 * without coupling them to the core service logic.
 */
export const registerEventSubscribers = (): void => {
    // =========================================================================
    // Cache Invalidation Subscribers
    // =========================================================================

    eventBus.on('doctor.schedule_updated', 'invalidate-availability-cache', async (payload) => {
        await cacheInvalidate(CacheKeys.doctorAvailability(payload.doctorId));
        log.debug(`Invalidated availability cache for doctor ${payload.doctorId}`);
    });

    eventBus.on('hospital.updated', 'invalidate-hospital-cache', async (payload) => {
        await cacheInvalidate(CacheKeys.hospitalProfile(payload.hospitalId));
        if (payload.slug) {
            await cacheInvalidate(CacheKeys.hospitalBySlug(payload.slug));
        }
        log.debug(`Invalidated hospital cache for ${payload.hospitalId}`);
    });

    // =========================================================================
    // Audit / Analytics Subscribers (extensible)
    // =========================================================================

    eventBus.on('appointment.created', 'log-appointment-created', (payload) => {
        log.info(`Appointment created: ${payload.appointmentId} for patient ${payload.patientId} with doctor ${payload.doctorId}`);
    });

    eventBus.on('payment.completed', 'log-payment-completed', (payload) => {
        log.info(`Payment completed: ${payload.paymentId} amount=${payload.amount} method=${payload.method}`);
    });

    eventBus.on('user.registered', 'log-user-registered', (payload) => {
        log.info(`User registered: ${payload.userId} role=${payload.role}`);
    });

    log.info(`Domain event subscribers registered (${Object.keys(eventBus.listEvents()).length} events)`);
};
