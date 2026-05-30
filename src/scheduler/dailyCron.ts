/**
 * Daily Cron Scheduler
 *
 * Two jobs:
 * 1. 9:00 AM IST — Send the daily digest to all users in all workspaces
 * 2. 12:00 AM IST (midnight) — Reactivate expired snoozed items
 */

import cron from 'node-cron';
import { sendDigestToAll } from '../services/digestService';
import { reactivateExpiredSnoozes } from '../services/itemService';
import { logger } from '../utils/logger';

export function startScheduler(): void {
  // Daily digest at 9:00 AM IST
  // Cron runs in server local time. TZ=Asia/Kolkata is set in .env
  cron.schedule(
    '0 9 * * *',
    async () => {
      logger.info('Cron: starting daily digest job');
      try {
        await sendDigestToAll();
        logger.info('Cron: daily digest job completed');
      } catch (err) {
        logger.error('Cron: daily digest job failed', err);
      }
    },
    { timezone: 'Asia/Kolkata' }
  );

  // Midnight snooze reactivation
  cron.schedule(
    '0 0 * * *',
    async () => {
      logger.info('Cron: running snooze reactivation');
      try {
        await reactivateExpiredSnoozes();
      } catch (err) {
        logger.error('Cron: snooze reactivation failed', err);
      }
    },
    { timezone: 'Asia/Kolkata' }
  );

  logger.info('Scheduler started — digest at 9:00 AM IST, snooze reset at midnight IST');
}
