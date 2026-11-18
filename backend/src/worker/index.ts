import cron from 'node-cron';
import { env } from '../config/env';
import { pool } from '../config/db';
import { processEmailBatch } from './emailWorker';

// Simple in-process lock so a slow SMTP run never overlaps with the next cron tick.
let isRunning = false;
let isShuttingDown = false;

async function runTick(): Promise<void> {
  if (isShuttingDown) return;

  if (isRunning) {
    console.log('[Worker] Previous batch is still running, skipping this tick.');
    return;
  }

  isRunning = true;
  try {
    const result = await processEmailBatch();
    if (result.processed > 0) {
      console.log(
        `[Worker] Batch finished: processed=${result.processed}, sent=${result.sent}, failed=${result.failed}`
      );
    } else {
      console.log('[Worker] Queue is empty. Waiting for next tick...');
    }
  } catch (error) {
    console.error('[Worker] Batch failed unexpectedly:', error);
  } finally {
    isRunning = false;
  }
}

console.log(
  `[Worker] Starting email worker (schedule="${env.worker.cronSchedule}", batchSize=${env.worker.batchSize}, maxRetries=${env.worker.maxRetries})`
);

// Run once immediately on boot so you don't wait 60 seconds during local testing
void runTick();

// Schedule recurring runs (default: every minute)
const task = cron.schedule(env.worker.cronSchedule, () => {
  void runTick();
});

/**
 * Graceful shutdown on SIGTERM/SIGINT:
 * stops scheduling new ticks, waits briefly if a batch is mid-flight, then closes MySQL pool.
 */
async function shutdown(signal: string): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`[Worker] Received ${signal}. Stopping scheduler...`);
  task.stop();

  // Wait for an active batch to finish before closing DB connections
  while (isRunning) {
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  try {
    await pool.end();
    console.log('[Worker] MySQL pool closed. Exiting.');
    process.exit(0);
  } catch (error) {
    console.error('[Worker] Error closing MySQL pool:', error);
    process.exit(1);
  }
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
