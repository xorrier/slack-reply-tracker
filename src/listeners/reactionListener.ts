/**
 * Reaction Listener
 *
 * Handles the `reaction_added` Slack event.
 * When the tracked user reacts with ✅ on a message, mark that tracked item as DONE.
 */

import { App } from '@slack/bolt';
import * as itemService from '../services/itemService';
import { prisma } from '../prisma/client';
import { logger } from '../utils/logger';

const DONE_EMOJI = 'white_check_mark'; // The name Slack uses for ✅

export function registerReactionListener(app: App): void {
  app.event('reaction_added', async ({ event, context }) => {
    try {
      const reactingUser = event.user;
      logger.info(`[Event: reaction_added] Received reaction="${event.reaction}" by user=${reactingUser} on item.type=${event.item.type}`);

      // Only care about the ✅ reaction
      if (event.reaction !== DONE_EMOJI) return;

      const workspaceId = context.teamId;
      if (!workspaceId) return;

      // Check if the reacting user is registered in this workspace
      const userRecord = await prisma.user.findUnique({
        where: {
          id_workspaceId: {
            id: reactingUser,
            workspaceId,
          },
        },
      });

      if (!userRecord) {
        logger.debug(`[Event: reaction_added] Reacting user=${reactingUser} is not registered, skipping`);
        return;
      }

      // The reaction was on a message — mark that message's tracked item as DONE
      if (event.item.type === 'message') {
        logger.info(`[Event: reaction_added] Mark item DONE for user=${reactingUser} message_ts=${event.item.ts}`);
        await itemService.markDoneByMessage({
          workspaceId,
          userId: reactingUser,
          messageTz: event.item.ts,
        });
        logger.info(`User ${reactingUser} reacted ✅ on message ${event.item.ts} — marked DONE`);
      }
    } catch (err) {
      logger.error('Error in reactionListener', err);
    }
  });

  logger.info('Reaction listener registered');
}
