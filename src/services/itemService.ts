/**
 * Item Service
 *
 * Business logic for creating, updating, and querying tracked items.
 * Calls itemRepository for DB access — no Prisma usage directly here.
 */

import { TrackedItem, TrackingReason } from '@prisma/client';
import * as repo from '../repositories/itemRepository';
import { logger } from '../utils/logger';

export type NewItemParams = {
  workspaceId: string;
  userId: string;
  channelId: string;
  messageTz: string;
  threadTs?: string;
  authorId: string;
  messageText: string;
  slackLink: string;
  reason: TrackingReason;
};

/**
 * Track a message if it hasn't been tracked already.
 * The unique constraint in the DB prevents duplicates, but we also check
 * here and log when a duplicate is skipped.
 */
export async function trackIfNew(params: NewItemParams): Promise<TrackedItem | null> {
  const item = await repo.upsertItem(params);
  if (item) {
    logger.info(
      `Tracked new item #${item.id} for user ${params.userId} in workspace ${params.workspaceId} (reason: ${params.reason})`
    );
  } else {
    logger.debug(`Skipped duplicate item for message ${params.messageTz}`);
  }
  return item;
}

/**
 * Mark an item as DONE by its numeric ID.
 * Validates the item belongs to the given workspace before updating.
 */
export async function markDone(id: number, workspaceId: string): Promise<TrackedItem | null> {
  const item = await repo.findItemById(id, workspaceId);
  if (!item) {
    logger.warn(`markDone: Item #${id} not found in workspace ${workspaceId}`);
    return null;
  }
  const updated = await repo.markItemDone(id);
  logger.info(`Item #${id} marked as DONE`);
  return updated;
}

/**
 * Mark a message as DONE based on its Slack timestamp.
 * Used when the user replies in a thread (auto-mark-done).
 */
export async function markDoneByMessage(params: {
  workspaceId: string;
  userId: string;
  messageTz: string;
}): Promise<void> {
  await repo.markItemDoneByMessage(params);
  logger.info(`Marked items DONE for user ${params.userId} on message ${params.messageTz}`);
}

/**
 * Snooze an item until a future date.
 * Validates the item exists in the workspace first.
 */
export async function snooze(
  id: number,
  workspaceId: string,
  until: Date
): Promise<TrackedItem | null> {
  const item = await repo.findItemById(id, workspaceId);
  if (!item) {
    logger.warn(`snooze: Item #${id} not found in workspace ${workspaceId}`);
    return null;
  }
  const updated = await repo.snoozeItem(id, until);
  logger.info(`Item #${id} snoozed until ${until.toISOString()}`);
  return updated;
}

/**
 * Get all pending items for a workspace (used by digest service).
 * Includes items whose snooze has expired.
 */
export async function getPendingItems(workspaceId: string): Promise<TrackedItem[]> {
  return repo.getPendingItems(workspaceId);
}

/**
 * Mark all items in a thread as DONE.
 * Called when the tracked user replies to the thread.
 */
export async function markThreadDone(params: {
  workspaceId: string;
  userId: string;
  threadTs: string;
}): Promise<void> {
  await repo.markThreadItemsDone(params);
  logger.info(`Marked thread ${params.threadTs} items DONE for user ${params.userId}`);
}

/**
 * Reset all snoozed items with expired snooze dates back to PENDING.
 * Called once at midnight by the cron scheduler.
 */
export async function reactivateExpiredSnoozes(): Promise<void> {
  const count = await repo.reactivateExpiredSnoozes();
  if (count > 0) {
    logger.info(`Reactivated ${count} expired snoozed item(s)`);
  }
}
