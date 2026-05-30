/**
 * Action Listener — /pause slash command
 *
 * Usage: /pause <item_id> <duration>
 * Examples:
 *   /pause 42 2h   → pause item 42 for 2 hours
 *   /pause 42 1d   → pause item 42 for 1 day
 *   /pause 42 3d   → pause item 42 for 3 days
 *   /pause 42 1w   → pause item 42 for 1 week
 */

import { App } from '@slack/bolt';
import * as itemService from '../services/itemService';
import { prisma } from '../prisma/client';
import { logger } from '../utils/logger';

/**
 * Parse a duration string like "2h", "1d", "3d", "1w" into a future Date.
 * Returns null if the format is invalid.
 */
function parseDuration(input: string): Date | null {
  const match = input.trim().match(/^(\d+)([hdw])$/i);
  if (!match) return null;

  const amount = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();

  const now = Date.now();
  const MS = { h: 3600000, d: 86400000, w: 604800000 };

  const multiplier = MS[unit as keyof typeof MS];
  return new Date(now + amount * multiplier);
}

export function registerActionListeners(app: App): void {
  app.command('/pause', async ({ command, ack, respond, context }) => {
    await ack();

    try {
      const workspaceId = context.teamId;
      if (!workspaceId) return;

      const executingUser = command.user_id;

      // Check if the user is registered in this workspace
      let userRecord = await prisma.user.findUnique({
        where: {
          id_workspaceId: {
            id: executingUser,
            workspaceId,
          },
        },
      });

      if (!userRecord) {
        // Register them on the fly!
        await prisma.user.create({
          data: {
            id: executingUser,
            workspaceId,
          },
        });
        await respond({
          text: `👋 *Welcome to Reply Tracker!* I have registered you and will now track your mentions and thread replies.\nSnoozing your item...`,
          response_type: 'ephemeral',
        });
      }

      const parts = command.text.trim().split(/\s+/);
      if (parts.length !== 2) {
        await respond({
          text: '❌ Usage: `/pause <item_id> <duration>` — e.g. `/pause 42 2d`\nValid units: `h` (hours), `d` (days), `w` (weeks)',
          response_type: 'ephemeral',
        });
        return;
      }

      const [idStr, durationStr] = parts;
      const id = parseInt(idStr, 10);

      if (isNaN(id)) {
        await respond({ text: '❌ Item ID must be a number.', response_type: 'ephemeral' });
        return;
      }

      const until = parseDuration(durationStr);
      if (!until) {
        await respond({
          text: '❌ Invalid duration. Use format like `2h`, `1d`, `3d`, `1w`.',
          response_type: 'ephemeral',
        });
        return;
      }

      const item = await itemService.snooze(id, workspaceId, until);
      if (!item) {
        await respond({
          text: `❌ Item #${id} not found.`,
          response_type: 'ephemeral',
        });
        return;
      }

      const untilStr = until.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
      await respond({
        text: `⏰ Item #${id} snoozed until *${untilStr}*.`,
        response_type: 'ephemeral',
      });

      logger.info(`Item #${id} paused until ${until.toISOString()} by user ${command.user_id}`);
    } catch (err) {
      logger.error('Error in /snooze command', err);
      await respond({ text: '❌ Something went wrong. Please try again.', response_type: 'ephemeral' });
    }
  });

  logger.info('Action listeners registered (/pause)');
}
