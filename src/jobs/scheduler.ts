import { logger } from '../config/logger.js';
import { getRedisClient } from '../config/redis.js';
import { features } from '../config/env.js';

// Import all job functions
import { cleanupExpiredOTPs } from './otp-cleanup.job.js';
import { sendAppointmentReminders } from './reminder.job.js';
import { markNoShows } from './no-show.job.js';
import { cleanupOldSlots } from './slot-cleanup.job.js';
import { generateSettlements } from './settlement.job.js';
import { dispatchNotifications } from './notification-dispatch.job.js';
import { runPaymentMaintenanceJobs } from './payment-expiry.job.js';
import { securityService } from '../config/security.js';

const log = logger.child('JobScheduler');

interface ScheduledJob {
  name: string;
  fn: () => Promise<void>;
  intervalMs: number;
  lastRun?: number;
}

/**
 * Acquire a distributed lock using Redis SET NX EX.
 * Returns true if lock was acquired, false otherwise.
 */
const acquireLock = async (jobName: string, ttlSeconds: number): Promise<boolean> => {
  const redis = getRedisClient();
  if (!redis) return true; // If no Redis, run locally (single-instance mode)

  try {
    const lockKey = `job:lock:${jobName}`;
    // SET NX returns 'OK' if set, null if key already exists
    const result = await redis.set(lockKey, Date.now().toString(), { nx: true, ex: ttlSeconds });
    return result === 'OK';
  } catch (error) {
    log.error(`Failed to acquire lock for ${jobName}`, error);
    return false;
  }
};

/**
 * Release a distributed lock
 */
const releaseLock = async (jobName: string): Promise<void> => {
  const redis = getRedisClient();
  if (!redis) return;

  try {
    await redis.del(`job:lock:${jobName}`);
  } catch (error) {
    log.error(`Failed to release lock for ${jobName}`, error);
  }
};

/**
 * Run a job with distributed locking to prevent concurrent execution across instances
 */
const runWithLock = async (job: ScheduledJob): Promise<void> => {
  const lockTTL = Math.ceil(job.intervalMs / 1000) + 30; // Lock TTL = interval + 30s buffer

  const acquired = await acquireLock(job.name, lockTTL);
  if (!acquired) {
    log.debug(`Skipping job ${job.name} — another instance holds the lock`);
    return;
  }

  try {
    log.info(`Running job: ${job.name}`);
    const start = Date.now();
    await job.fn();
    const duration = Date.now() - start;
    log.info(`Job ${job.name} completed in ${duration}ms`);
  } catch (error) {
    log.error(`Job ${job.name} failed`, error);
  } finally {
    await releaseLock(job.name);
  }
};

/**
 * Define all scheduled jobs with their intervals
 */
const jobs: ScheduledJob[] = [
  {
    name: 'otp-cleanup',
    fn: cleanupExpiredOTPs,
    intervalMs: 10 * 60 * 1000, // Every 10 minutes
  },
  {
    name: 'appointment-reminders',
    fn: sendAppointmentReminders,
    intervalMs: 5 * 60 * 1000, // Every 5 minutes
  },
  {
    name: 'no-show-check',
    fn: markNoShows,
    intervalMs: 15 * 60 * 1000, // Every 15 minutes
  },
  {
    name: 'slot-cleanup',
    fn: cleanupOldSlots,
    intervalMs: 30 * 60 * 1000, // Every 30 minutes
  },
  {
    name: 'settlement-generation',
    fn: generateSettlements,
    intervalMs: 60 * 60 * 1000, // Every 1 hour
  },
  {
    name: 'notification-dispatch',
    fn: dispatchNotifications,
    intervalMs: 1 * 60 * 1000, // Every 1 minute
  },
  {
    name: 'payment-expiry',
    fn: runPaymentMaintenanceJobs,
    intervalMs: 5 * 60 * 1000, // Every 5 minutes
  },
  {
    name: 'security-cleanup',
    fn: async () => { await securityService.runSecurityCleanup(); },
    intervalMs: 24 * 60 * 60 * 1000, // Every 24 hours
  },
];

const timers: NodeJS.Timeout[] = [];

/**
 * Start all scheduled jobs
 */
export const startJobScheduler = (): void => {
  log.info(`Starting job scheduler with ${jobs.length} jobs`);

  for (const job of jobs) {
    // Run each job immediately on startup (with lock), then on interval
    runWithLock(job).catch(err => log.error(`Initial run of ${job.name} failed`, err));

    const timer = setInterval(() => {
      runWithLock(job).catch(err => log.error(`Scheduled run of ${job.name} failed`, err));
    }, job.intervalMs);

    // Don't let timers prevent process exit
    timer.unref();
    timers.push(timer);

    log.info(`Scheduled job: ${job.name} (every ${Math.round(job.intervalMs / 1000)}s)`);
  }
};

/**
 * Stop all scheduled jobs (for graceful shutdown)
 */
export const stopJobScheduler = (): void => {
  log.info('Stopping job scheduler...');
  for (const timer of timers) {
    clearInterval(timer);
  }
  timers.length = 0;
  log.info('Job scheduler stopped');
};
