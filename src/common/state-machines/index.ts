import type { AppointmentStatus, PaymentStatus, ConsultationStatus } from '../../types/database.types.js';
import { BadRequestError } from '../errors/index.js';

// ============================================================================
// Generic State Machine
// ============================================================================

interface StateTransition<S extends string> {
    from: S;
    to: S;
    guard?: () => boolean;
}

class StateMachine<S extends string> {
    private transitions: Map<S, Set<S>> = new Map();
    private name: string;

    constructor(name: string, transitions: Array<{ from: S; to: S }>) {
        this.name = name;
        for (const { from, to } of transitions) {
            if (!this.transitions.has(from)) {
                this.transitions.set(from, new Set());
            }
            this.transitions.get(from)!.add(to);
        }
    }

    /** Check if a transition is allowed */
    canTransition(from: S, to: S): boolean {
        const allowed = this.transitions.get(from);
        return allowed ? allowed.has(to) : false;
    }

    /** Assert that a transition is valid — throws if not */
    assertTransition(from: S, to: S): void {
        if (!this.canTransition(from, to)) {
            const allowedStates = this.getAllowedTransitions(from);
            throw new BadRequestError(
                `Invalid ${this.name} transition: "${from}" → "${to}". ` +
                `Allowed transitions from "${from}": [${allowedStates.join(', ')}]`
            );
        }
    }

    /** Get all valid next states from a given state */
    getAllowedTransitions(from: S): S[] {
        const allowed = this.transitions.get(from);
        return allowed ? Array.from(allowed) : [];
    }

    /** Check if a state is terminal (no outgoing transitions) */
    isTerminal(state: S): boolean {
        return this.getAllowedTransitions(state).length === 0;
    }
}

// ============================================================================
// Appointment State Machine
// ============================================================================

/**
 * Appointment lifecycle:
 *
 *   pending_payment → confirmed → checked_in → in_progress → completed
 *                   ↘ cancelled   ↘ no_show      ↘ cancelled
 *                   ↘ rescheduled
 *   confirmed → rescheduled → confirmed
 *   pending_payment → cancelled
 *
 * Terminal states: completed, cancelled, no_show
 */
export const appointmentStateMachine = new StateMachine<AppointmentStatus>(
    'appointment',
    [
        // Happy path
        { from: 'pending_payment', to: 'confirmed' },
        { from: 'confirmed', to: 'checked_in' },
        { from: 'checked_in', to: 'in_progress' },
        { from: 'in_progress', to: 'completed' },

        // Cancellation (allowed from most non-terminal states)
        { from: 'pending_payment', to: 'cancelled' },
        { from: 'confirmed', to: 'cancelled' },
        { from: 'checked_in', to: 'cancelled' },

        // Rescheduling
        { from: 'confirmed', to: 'rescheduled' },
        { from: 'rescheduled', to: 'confirmed' },
        { from: 'rescheduled', to: 'cancelled' },

        // No-show
        { from: 'confirmed', to: 'no_show' },
        { from: 'checked_in', to: 'no_show' },

        // Payment expiry
        { from: 'pending_payment', to: 'cancelled' },
    ]
);

// ============================================================================
// Payment State Machine
// ============================================================================

/**
 * Payment lifecycle:
 *
 *   pending → processing → completed → refunded
 *                        → failed       → partially_refunded
 *   pending → expired
 *   completed → disputed
 *
 * Terminal states: refunded, failed, expired
 */
export const paymentStateMachine = new StateMachine<PaymentStatus>(
    'payment',
    [
        // Happy path
        { from: 'pending', to: 'processing' },
        { from: 'processing', to: 'completed' },

        // Failure
        { from: 'processing', to: 'failed' },
        { from: 'pending', to: 'failed' },

        // Expiry
        { from: 'pending', to: 'expired' },

        // Refund
        { from: 'completed', to: 'refunded' },
        { from: 'completed', to: 'partially_refunded' },
        { from: 'partially_refunded', to: 'refunded' },

        // Dispute
        { from: 'completed', to: 'disputed' },
        { from: 'disputed', to: 'refunded' },
        { from: 'disputed', to: 'completed' }, // Dispute resolved in merchant's favor
    ]
);

// ============================================================================
// Consultation State Machine
// ============================================================================

/**
 * Consultation lifecycle:
 *
 *   scheduled → waiting → in_progress → completed
 *                        → paused → in_progress
 *   Any non-terminal → cancelled / failed
 */
export const consultationStateMachine = new StateMachine<ConsultationStatus>(
    'consultation',
    [
        // Happy path
        { from: 'scheduled', to: 'waiting' },
        { from: 'waiting', to: 'in_progress' },
        { from: 'in_progress', to: 'completed' },

        // Pause/Resume
        { from: 'in_progress', to: 'paused' },
        { from: 'paused', to: 'in_progress' },

        // Cancellation
        { from: 'scheduled', to: 'cancelled' },
        { from: 'waiting', to: 'cancelled' },
        { from: 'in_progress', to: 'cancelled' },
        { from: 'paused', to: 'cancelled' },

        // Failure
        { from: 'scheduled', to: 'failed' },
        { from: 'waiting', to: 'failed' },
        { from: 'in_progress', to: 'failed' },
    ]
);

// ============================================================================
// Convenience Validators
// ============================================================================

/** Assert appointment status transition and return the new status */
export const validateAppointmentTransition = (
    currentStatus: AppointmentStatus,
    newStatus: AppointmentStatus,
): AppointmentStatus => {
    appointmentStateMachine.assertTransition(currentStatus, newStatus);
    return newStatus;
};

/** Assert payment status transition and return the new status */
export const validatePaymentTransition = (
    currentStatus: PaymentStatus,
    newStatus: PaymentStatus,
): PaymentStatus => {
    paymentStateMachine.assertTransition(currentStatus, newStatus);
    return newStatus;
};

/** Assert consultation status transition and return the new status */
export const validateConsultationTransition = (
    currentStatus: ConsultationStatus,
    newStatus: ConsultationStatus,
): ConsultationStatus => {
    consultationStateMachine.assertTransition(currentStatus, newStatus);
    return newStatus;
};
