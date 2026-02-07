import { env } from '../../../config/env.js';
import { logger } from '../../../config/logger.js';
import { BadRequestError, InternalServerError } from '../../../common/errors/ApiError.js';
import { circuitBreakers, CircuitOpenError } from '../../../config/circuit-breaker.js';

export class RazorpayClient {
    private static readonly baseUrl = 'https://api.razorpay.com/v1';
    private static readonly log = logger.child('RazorpayClient');
    private static readonly circuitBreaker = circuitBreakers.razorpay;

    private static get authHeader() {
        return Buffer.from(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`).toString('base64');
    }

    static async request<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
        const url = `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

        // Wrap the request in circuit breaker
        return this.circuitBreaker.execute(async () => {
            // SECURITY: Add timeout to prevent hanging requests
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30_000); // 30 second timeout

            try {
                const response = await fetch(url, {
                    ...options,
                    signal: controller.signal,
                    headers: {
                        'Authorization': `Basic ${this.authHeader}`,
                        'Content-Type': 'application/json',
                        ...options.headers,
                    }
                });

                if (!response.ok) {
                    const error: any = await response.json().catch(() => ({}));
                    this.log.error(`Razorpay API Error [${endpoint}]:`, error);

                    // 5xx errors should count towards circuit breaker failures
                    if (response.status >= 500) {
                        throw new InternalServerError(error.error?.description || 'Razorpay service unavailable');
                    }

                    // 4xx errors are client errors, don't trip the circuit
                    throw new BadRequestError(error.error?.description || 'Razorpay API request failed');
                }

                return response.json() as Promise<T>;
            } catch (error) {
                // Handle timeout abort
                if (error instanceof Error && error.name === 'AbortError') {
                    this.log.error(`Razorpay API timeout [${endpoint}]`);
                    throw new InternalServerError('Payment service request timed out. Please try again.');
                }
                throw error;
            } finally {
                clearTimeout(timeoutId);
            }
        }).catch((error) => {
            // Handle circuit open error with user-friendly message
            if (error instanceof CircuitOpenError) {
                this.log.warn('Razorpay circuit open - failing fast');
                throw new InternalServerError('Payment service temporarily unavailable. Please try again shortly.');
            }
            throw error;
        });
    }

    /**
     * Get circuit breaker status (for health checks)
     */
    static getCircuitStatus() {
        return this.circuitBreaker.getStatus();
    }
}

