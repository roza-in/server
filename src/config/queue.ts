import { getRedisClient } from './redis.js';
import { logger } from './logger.js';

const log = logger.child('Queue');

// ============================================================================
// SC6: Lightweight Redis-backed Job Queue
//
// Uses Upstash Redis Lists (LPUSH/RPOP) for job persistence and retry logic.
// Can be swapped for BullMQ when a standard Redis (ioredis) connection is
// available. This abstraction provides:
//   - Named queues for different job types
//   - Configurable retry with exponential backoff
//   - Dead letter queue for failed jobs
//   - Concurrency control via polling
// ============================================================================

/** Queue names used across the application */
export const QueueNames = {
    NOTIFICATION: 'queue:notification',
    SETTLEMENT: 'queue:settlement',
    REPORT: 'queue:report',
    WEBHOOK_RETRY: 'queue:webhook-retry',
} as const;

export type QueueName = (typeof QueueNames)[keyof typeof QueueNames];

/** Shape of a queued job */
export interface QueueJob<T = unknown> {
    id: string;
    queue: QueueName;
    data: T;
    attempts: number;
    maxAttempts: number;
    createdAt: number;
    runAfter: number; // Timestamp — supports delayed/backoff retries
}

/** Options for enqueuing a job */
export interface EnqueueOptions {
    /** Max retry attempts (default: 3) */
    maxAttempts?: number;
    /** Delay before first execution in ms (default: 0) */
    delayMs?: number;
}

/**
 * Enqueue a job into a named queue.
 * Returns the job ID, or null if Redis is unavailable.
 */
export const enqueueJob = async <T>(
    queue: QueueName,
    data: T,
    options: EnqueueOptions = {},
): Promise<string | null> => {
    const client = getRedisClient();
    if (!client) {
        log.warn(`Queue unavailable (no Redis) — job for ${queue} will not be enqueued`);
        return null;
    }

    const job: QueueJob<T> = {
        id: `${queue}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
        queue,
        data,
        attempts: 0,
        maxAttempts: options.maxAttempts ?? 3,
        createdAt: Date.now(),
        runAfter: Date.now() + (options.delayMs ?? 0),
    };

    try {
        await client.lpush(queue, JSON.stringify(job));
        log.debug(`Enqueued job ${job.id}`);
        return job.id;
    } catch (error) {
        log.error(`Failed to enqueue job to ${queue}`, error);
        return null;
    }
};

/**
 * Process handler type — return true on success, false to retry.
 */
export type JobProcessor<T = unknown> = (job: QueueJob<T>) => Promise<boolean>;

/**
 * Dequeue and process one job from a queue.
 * Returns true if a job was processed, false if queue is empty.
 */
export const processOneJob = async <T>(
    queue: QueueName,
    processor: JobProcessor<T>,
): Promise<boolean> => {
    const client = getRedisClient();
    if (!client) return false;

    try {
        const raw = await client.rpop(queue);
        if (!raw) return false;

        const job: QueueJob<T> = typeof raw === 'string' ? JSON.parse(raw) : raw as QueueJob<T>;

        // Check if job should be delayed
        if (job.runAfter > Date.now()) {
            // Re-enqueue — it's not ready yet
            await client.lpush(queue, JSON.stringify(job));
            return false;
        }

        job.attempts++;

        try {
            const success = await processor(job);

            if (!success && job.attempts < job.maxAttempts) {
                // Exponential backoff: 2^attempts * 1000ms (2s, 4s, 8s, ...)
                const backoffMs = Math.pow(2, job.attempts) * 1000;
                job.runAfter = Date.now() + backoffMs;
                await client.lpush(queue, JSON.stringify(job));
                log.warn(`Job ${job.id} failed (attempt ${job.attempts}/${job.maxAttempts}), retrying in ${backoffMs}ms`);
            } else if (!success) {
                // Send to dead letter queue
                const dlqKey = `${queue}:dlq`;
                await client.lpush(dlqKey, JSON.stringify({ ...job, failedAt: Date.now() }));
                log.error(`Job ${job.id} exhausted all ${job.maxAttempts} attempts — moved to DLQ`);
            } else {
                log.debug(`Job ${job.id} completed successfully`);
            }

            return true;
        } catch (processingError) {
            // Processor threw — treat as failure
            if (job.attempts < job.maxAttempts) {
                const backoffMs = Math.pow(2, job.attempts) * 1000;
                job.runAfter = Date.now() + backoffMs;
                await client.lpush(queue, JSON.stringify(job));
                log.error(`Job ${job.id} threw (attempt ${job.attempts}/${job.maxAttempts}), retrying in ${backoffMs}ms`, processingError);
            } else {
                const dlqKey = `${queue}:dlq`;
                await client.lpush(dlqKey, JSON.stringify({ ...job, failedAt: Date.now(), error: String(processingError) }));
                log.error(`Job ${job.id} exhausted retries after throw — moved to DLQ`, processingError);
            }
            return true;
        }
    } catch (error) {
        log.error(`Failed to dequeue from ${queue}`, error);
        return false;
    }
};

/**
 * Process multiple jobs from a queue (up to `batchSize`).
 * Returns count of jobs processed.
 */
export const processBatch = async <T>(
    queue: QueueName,
    processor: JobProcessor<T>,
    batchSize: number = 10,
): Promise<number> => {
    let processed = 0;
    for (let i = 0; i < batchSize; i++) {
        const didProcess = await processOneJob(queue, processor);
        if (!didProcess) break;
        processed++;
    }
    return processed;
};

/**
 * Get the length of a queue (for monitoring).
 */
export const getQueueLength = async (queue: QueueName): Promise<number> => {
    const client = getRedisClient();
    if (!client) return 0;

    try {
        return await client.llen(queue);
    } catch {
        return 0;
    }
};

/**
 * Get lengths of all queues (for admin dashboard / metrics).
 */
export const getAllQueueLengths = async (): Promise<Record<string, number>> => {
    const results: Record<string, number> = {};
    for (const [name, key] of Object.entries(QueueNames)) {
        results[name] = await getQueueLength(key);
        results[`${name}_DLQ`] = await getQueueLength(`${key}:dlq` as QueueName);
    }
    return results;
};
