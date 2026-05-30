/**
 * Digest Service
 *
 * Builds and sends the daily digest DM to each user with pending items.
 * Called by the cron scheduler every morning at 9:00 AM IST.
 */

import { TrackedItem } from '@prisma/client';
import { KnownBlock, WebClient } from '@slack/web-api';
import { prisma } from '../prisma/client';
import * as itemService from './itemService';
import { reasonLabel } from './trackingService';
import { logger } from '../utils/logger';

/**
 * Send the daily digest to all users in all installed workspaces.
 */
export async function sendDigestToAll(): Promise<void> {
  const workspaces = await prisma.workspace.findMany();
  logger.info(`Daily digest: processing ${workspaces.length} workspace(s)`);

  for (const workspace of workspaces) {
    try {
      await sendDigestForWorkspace(workspace.id, workspace.botToken);
    } catch (err) {
      logger.error(`Failed to send digest for workspace ${workspace.id}`, err);
      // Continue to the next workspace even if one fails
    }
  }
}

/**
 * Send the digest for a single workspace.
 * Groups pending items by user and sends one DM per user.
 */
async function sendDigestForWorkspace(workspaceId: string, botToken: string): Promise<void> {
  const client = new WebClient(botToken);
  const pendingItems = await itemService.getPendingItems(workspaceId);

  if (pendingItems.length === 0) {
    logger.info(`Workspace ${workspaceId}: no pending items, skipping digest`);
    return;
  }

  // Group items by userId
  const itemsByUser = groupByUser(pendingItems);

  for (const [userId, items] of itemsByUser.entries()) {
    try {
      const message = buildDigestMessage(items);

      // Open a DM channel and send the message
      const dmResult = await client.conversations.open({ users: userId });
      const channelId = dmResult.channel?.id;

      if (!channelId) {
        logger.warn(`Could not open DM channel for user ${userId}`);
        continue;
      }

      await client.chat.postMessage({
        channel: channelId,
        text: message.text,
        blocks: message.blocks,
      });

      logger.info(`Sent digest to user ${userId} in workspace ${workspaceId} (${items.length} item(s))`);
    } catch (err) {
      logger.error(`Failed to send digest to user ${userId} in workspace ${workspaceId}`, err);
    }
  }
}

/**
 * Group a flat list of tracked items into a Map of userId → items[].
 */
function groupByUser(items: TrackedItem[]): Map<string, TrackedItem[]> {
  const map = new Map<string, TrackedItem[]>();
  for (const item of items) {
    const list = map.get(item.userId) ?? [];
    list.push(item);
    map.set(item.userId, list);
  }
  return map;
}

/**
 * Build the Slack message payload for a user's digest.
 * Uses Slack Block Kit for a clean, readable layout.
 */
function buildDigestMessage(items: TrackedItem[]): {
  text: string;
  blocks: KnownBlock[];
} {
  const count = items.length;
  const plainText = `Good morning! You have ${count} pending item${count === 1 ? '' : 's'} that may need your attention.`;

  const blocks: KnownBlock[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: '🌅 Good Morning — Your Daily Digest',
        emoji: true,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `You have *${count} pending item${count === 1 ? '' : 's'}* that may need your attention:`,
      },
    },
    { type: 'divider' },
  ];

  items.forEach((item, index) => {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: [
          `*${index + 1}.* <${item.slackLink}|View message>`,
          `📍 *Reason:* ${reasonLabel(item.reason)}`,
          `💬 _"${truncate(item.messageText, 120)}"_`,
        ].join('\n'),
      },
    });
  });

  blocks.push(
    { type: 'divider' },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: 'React with ✅ on any message to mark it as done. Use `/pause <id> <duration>` to pause (e.g. `42 2d`).',
        },
      ],
    }
  );

  return { text: plainText, blocks };
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}
