import { logger } from '../../config/logger.js';
import { getRedisClient } from '../../config/redis.js';

const log = logger.child('EventBus');

// SC4: Instance identifier for cross-instance event relay
const INSTANCE_ID = process.env.HOSTNAME || `pid-${process.pid}`;
const EVENTS_RELAY_KEY = 'events:relay'; // Redis List for cross-instance events

// ============================================================================
// Domain Event Types — Typed payloads for all domain events
// ============================================================================

export interface DomainEvents {
    'appointment.created': {
        appointmentId: string;
        patientId: string;
        doctorId: string;
        hospitalId: string;
        consultationType: string;
        scheduledDate: string;
        scheduledStart: string;
    };
    'appointment.confirmed': {
        appointmentId: string;
        patientId: string;
        doctorId: string;
    };
    'appointment.cancelled': {
        appointmentId: string;
        patientId: string;
        doctorId: string;
        cancelledBy: string;
        reason?: string;
    };
    'appointment.completed': {
        appointmentId: string;
        patientId: string;
        doctorId: string;
        hospitalId: string;
    };
    'appointment.rescheduled': {
        appointmentId: string;
        patientId: string;
        doctorId: string;
        oldDate: string;
        newDate: string;
        newStart: string;
    };
    'appointment.no_show': {
        appointmentId: string;
        patientId: string;
        doctorId: string;
    };
    'payment.completed': {
        paymentId: string;
        appointmentId: string;
        amount: number;
        method: string;
        payerId: string;
    };
    'payment.failed': {
        paymentId: string;
        appointmentId?: string;
        reason: string;
    };
    'payment.refunded': {
        paymentId: string;
        refundId: string;
        amount: number;
        reason: string;
    };
    'consultation.started': {
        consultationId: string;
        appointmentId: string;
        doctorId: string;
        patientId: string;
    };
    'consultation.completed': {
        consultationId: string;
        appointmentId: string;
        doctorId: string;
        patientId: string;
        durationMinutes: number;
    };
    'prescription.created': {
        prescriptionId: string;
        consultationId: string;
        doctorId: string;
        patientId: string;
    };
    'doctor.verified': {
        doctorId: string;
        hospitalId: string;
    };
    'doctor.schedule_updated': {
        doctorId: string;
    };
    'hospital.verified': {
        hospitalId: string;
    };
    'hospital.updated': {
        hospitalId: string;
        slug?: string;
    };
    'user.registered': {
        userId: string;
        role: string;
        phone?: string;
        email?: string;
    };
    'user.login': {
        userId: string;
        ip?: string;
        userAgent?: string;
    };
}

export type DomainEventName = keyof DomainEvents;
type EventHandler<E extends DomainEventName> = (payload: DomainEvents[E]) => void | Promise<void>;

// ============================================================================
// Event Bus Implementation — In-process pub/sub for domain events
// ============================================================================

class DomainEventBus {
    private handlers = new Map<string, Array<{ name: string; handler: Function }>>();
    private asyncMode = true; // Fire-and-forget by default (handlers run async)
    private relayEnabled = false;
    private relayTimer: NodeJS.Timeout | null = null;

    /**
     * Subscribe a named handler to a domain event.
     * Handlers run asynchronously and errors are logged but don't propagate.
     */
    on<E extends DomainEventName>(event: E, handlerName: string, handler: EventHandler<E>): void {
        if (!this.handlers.has(event)) {
            this.handlers.set(event, []);
        }
        this.handlers.get(event)!.push({ name: handlerName, handler });
        log.debug(`Registered handler "${handlerName}" for event "${event}"`);
    }

    /**
     * Remove a named handler from a domain event.
     */
    off<E extends DomainEventName>(event: E, handlerName: string): void {
        const handlers = this.handlers.get(event);
        if (!handlers) return;
        const idx = handlers.findIndex(h => h.name === handlerName);
        if (idx >= 0) {
            handlers.splice(idx, 1);
            log.debug(`Removed handler "${handlerName}" from event "${event}"`);
        }
    }

    /**
     * Emit a domain event. Dispatches locally AND relays to Redis for other instances.
     */
    async emit<E extends DomainEventName>(event: E, payload: DomainEvents[E]): Promise<void> {
        // Dispatch locally
        await this.dispatchLocal(event, payload);

        // SC4: Relay to Redis so other instances pick it up
        if (this.relayEnabled) {
            this.relayToRedis(event, payload).catch(err => {
                log.error(`Failed to relay event "${event}" to Redis`, err);
            });
        }
    }

    /**
     * Dispatch event to local handlers only (used by emit and by relay consumer).
     */
    private async dispatchLocal<E extends DomainEventName>(event: E, payload: DomainEvents[E]): Promise<void> {
        const handlers = this.handlers.get(event);
        if (!handlers || handlers.length === 0) {
            log.debug(`No handlers for event "${event}"`);
            return;
        }

        log.info(`Emitting "${event}" to ${handlers.length} handler(s)`);

        if (this.asyncMode) {
            // Fire-and-forget: don't block the caller
            for (const { name, handler } of handlers) {
                Promise.resolve()
                    .then(() => handler(payload))
                    .catch((err) => {
                        log.error(`Handler "${name}" failed for event "${event}"`, err);
                    });
            }
        } else {
            // Await all handlers (useful for testing)
            const results = await Promise.allSettled(
                handlers.map(({ name, handler }) =>
                    Promise.resolve(handler(payload)).catch((err) => {
                        log.error(`Handler "${name}" failed for event "${event}"`, err);
                        throw err;
                    })
                )
            );
            const failed = results.filter(r => r.status === 'rejected').length;
            if (failed > 0) {
                log.warn(`${failed}/${handlers.length} handlers failed for event "${event}"`);
            }
        }
    }

    // =========================================================================
    // SC4: Redis List Relay — cross-instance event propagation
    // =========================================================================

    /**
     * Push event to Redis list so other instances can consume it.
     */
    private async relayToRedis<E extends DomainEventName>(event: E, payload: DomainEvents[E]): Promise<void> {
        const client = getRedisClient();
        if (!client) return;

        const message = JSON.stringify({
            event,
            payload,
            sourceInstance: INSTANCE_ID,
            ts: Date.now(),
        });

        await client.lpush(EVENTS_RELAY_KEY, message);
        // Auto-expire the list to prevent unbounded growth (5 min)
        await client.expire(EVENTS_RELAY_KEY, 300);
    }

    /**
     * Poll Redis list for events emitted by other instances.
     */
    private async pollRedisRelay(): Promise<void> {
        const client = getRedisClient();
        if (!client) return;

        try {
            // Pop up to 50 events per poll cycle
            const batchSize = 50;
            for (let i = 0; i < batchSize; i++) {
                const raw = await client.rpop(EVENTS_RELAY_KEY);
                if (!raw) break; // No more events

                const msg = typeof raw === 'string' ? JSON.parse(raw) : raw;

                // Skip events from this instance (already dispatched locally)
                if (msg.sourceInstance === INSTANCE_ID) continue;

                // Dispatch to local handlers
                const event = msg.event as DomainEventName;
                if (this.handlers.has(event)) {
                    log.debug(`Relay: received "${event}" from instance ${msg.sourceInstance}`);
                    await this.dispatchLocal(event, msg.payload);
                }
            }
        } catch (err) {
            log.error('Event relay poll error', err);
        }
    }

    /**
     * Start the cross-instance event relay (call once at server startup).
     * Polls Redis every 2 seconds for events emitted by other instances.
     */
    startRelay(): void {
        const client = getRedisClient();
        if (!client) {
            log.info('Event relay skipped — Redis unavailable');
            return;
        }

        if (this.relayTimer) return;

        this.relayEnabled = true;
        this.relayTimer = setInterval(() => {
            this.pollRedisRelay().catch(err => log.error('Relay poll failed', err));
        }, 2000);
        this.relayTimer.unref();
        log.info(`Event relay started (instance: ${INSTANCE_ID})`);
    }

    /**
     * Stop the cross-instance event relay (call on shutdown).
     */
    stopRelay(): void {
        this.relayEnabled = false;
        if (this.relayTimer) {
            clearInterval(this.relayTimer);
            this.relayTimer = null;
        }
    }

    /**
     * Set sync mode (await all handlers). Useful for testing.
     */
    setSyncMode(sync: boolean): void {
        this.asyncMode = !sync;
    }

    /**
     * Clear all handlers (for testing/cleanup)
     */
    clear(): void {
        this.handlers.clear();
    }

    /**
     * List registered events and handler counts (for debugging)
     */
    listEvents(): Record<string, number> {
        const result: Record<string, number> = {};
        for (const [event, handlers] of this.handlers) {
            result[event] = handlers.length;
        }
        return result;
    }
}

/** Singleton domain event bus */
export const eventBus = new DomainEventBus();
