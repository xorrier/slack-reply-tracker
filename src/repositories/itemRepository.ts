import { ItemStatus, TrackedItem, TrackingReason } from '@prisma/client';
import { prisma } from '../prisma/client';

export type CreateItemInput = {
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
 * Insert a new tracked item.
 * If an item with the same (workspaceId, userId, messageTz) already exists,
 * do nothing — this prevents duplicate tracking.
 */
export async function upsertItem(input: CreateItemInput): Promise<TrackedItem | null> {
  const existing = await prisma.trackedItem.findUnique({
    where: {
      workspaceId_userId_messageTz: {
        workspaceId: input.workspaceId,
        userId: input.userId,
        messageTz: input.messageTz,
      },
    },
  });

  if (existing) return null; // Already tracked, skip

  return prisma.trackedItem.create({ data: input });
}

/**
 * Fetch all PENDING items for a workspace.
 * Excludes DONE items and SNOOZED items where snoozed_until is still in the future.
 */
export async function getPendingItems(workspaceId: string): Promise<TrackedItem[]> {
  return prisma.trackedItem.findMany({
    where: {
      workspaceId,
      OR: [
        { status: ItemStatus.PENDING },
        {
          status: ItemStatus.SNOOZED,
          snoozedUntil: { lte: new Date() }, // Snooze has expired
        },
      ],
    },
    orderBy: { createdAt: 'asc' },
  });
}

/**
 * Mark a tracked item as DONE by its ID.
 */
export async function markItemDone(id: number): Promise<TrackedItem> {
  return prisma.trackedItem.update({
    where: { id },
    data: { status: ItemStatus.DONE },
  });
}

/**
 * Mark a tracked item as DONE by workspace + user + message timestamp.
 * Used when we detect the user replied in the same thread.
 */
export async function markItemDoneByMessage(params: {
  workspaceId: string;
  userId: string;
  messageTz: string;
}): Promise<void> {
  await prisma.trackedItem.updateMany({
    where: {
      workspaceId: params.workspaceId,
      userId: params.userId,
      messageTz: params.messageTz,
      status: { not: ItemStatus.DONE },
    },
    data: { status: ItemStatus.DONE },
  });
}

/**
 * Mark all tracked items in a thread as DONE.
 * This is triggered when the tracked user replies to the thread.
 */
export async function markThreadItemsDone(params: {
  workspaceId: string;
  userId: string;
  threadTs: string;
}): Promise<void> {
  await prisma.trackedItem.updateMany({
    where: {
      workspaceId: params.workspaceId,
      userId: params.userId,
      OR: [
        { messageTz: params.threadTs },
        { threadTs: params.threadTs },
      ],
      status: { not: ItemStatus.DONE },
    },
    data: { status: ItemStatus.DONE },
  });
}

/**
 * Mark all tracked items in a specific channel/chat as DONE for a user.
 * Triggered when the user is active (posts a message) in that channel/chat.
 */
export async function markChannelItemsDone(params: {
  workspaceId: string;
  userId: string;
  channelId: string;
}): Promise<void> {
  await prisma.trackedItem.updateMany({
    where: {
      workspaceId: params.workspaceId,
      userId: params.userId,
      channelId: params.channelId,
      status: { not: ItemStatus.DONE },
    },
    data: { status: ItemStatus.DONE },
  });
}

/**
 * Snooze a tracked item until a future date/time.
 */
export async function snoozeItem(id: number, until: Date): Promise<TrackedItem> {
  return prisma.trackedItem.update({
    where: { id },
    data: {
      status: ItemStatus.SNOOZED,
      snoozedUntil: until,
    },
  });
}

/**
 * Reset all snoozed items whose snooze period has expired back to PENDING.
 * Called once at midnight by the cron scheduler.
 */
export async function reactivateExpiredSnoozes(): Promise<number> {
  const result = await prisma.trackedItem.updateMany({
    where: {
      status: ItemStatus.SNOOZED,
      snoozedUntil: { lte: new Date() },
    },
    data: { status: ItemStatus.PENDING, snoozedUntil: null },
  });
  return result.count;
}

/**
 * Find a tracked item by its ID, scoped to a specific workspace (safety check).
 */
export async function findItemById(id: number, workspaceId: string): Promise<TrackedItem | null> {
  return prisma.trackedItem.findFirst({ where: { id, workspaceId } });
}
