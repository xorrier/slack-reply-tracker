import { App } from '@slack/bolt';
import { shouldTrack } from '../services/trackingService';
import * as itemService from '../services/itemService';
import { prisma } from '../prisma/client';
import { buildSlackLink } from '../utils/slackLink';
import { logger } from '../utils/logger';

/**
 * In-memory cache of thread_ts values per user per workspace where the user
 * has posted. This lets us detect "reply in a thread I participated in".
 *
 * Format: Map<`${workspaceId}:${userId}`, Set<thread_ts>>
 *
 * NOTE: This is cleared on restart. For a more robust solution in a future
 * version, you could persist participated threads to the DB.
 */
const participatedThreads = new Map<string, Set<string>>();

function getThreadKey(workspaceId: string, userId: string): string {
  return `${workspaceId}:${userId}`;
}

function recordParticipation(workspaceId: string, userId: string, threadTs: string): void {
  const key = getThreadKey(workspaceId, userId);
  const threads = participatedThreads.get(key) ?? new Set();
  threads.add(threadTs);
  participatedThreads.set(key, threads);
}

function hasParticipated(workspaceId: string, userId: string, threadTs: string): boolean {
  const key = getThreadKey(workspaceId, userId);
  return participatedThreads.get(key)?.has(threadTs) ?? false;
}

export function registerMessageListener(app: App): void {
  app.message(async ({ message, client, context }) => {
    try {
      // Only handle standard user messages (ignore bot messages, subtypes like channel_join, etc.)
      if (message.subtype !== undefined) return;
      if (!('text' in message) || !message.text) return;
      if (!('user' in message) || !message.user) return;

      // Ignore messages sent by bots (including this bot itself)
      if ('bot_id' in message) return;
      if (message.user === context.botUserId) return;

      const workspaceId = context.teamId;
      if (!workspaceId) return;

      const senderUserId = message.user;
      const messageText = message.text;
      const channelId = message.channel;
      const messageTs = message.ts;
      const threadTs = 'thread_ts' in message ? message.thread_ts : undefined;
      const channelType = message.channel_type ?? 'channel';

      logger.info(
        `[Event: message] Received message: user=${senderUserId}, channel=${channelId}, type=${channelType}, ts=${messageTs}`
      );

      // 1. Handle Direct Message to the bot (1-to-1 IM)
      if (channelType === 'im') {
        logger.info(`[Event: message] Processing DM to bot from user=${senderUserId}`);
        const userRecord = await prisma.user.findUnique({
          where: {
            id_workspaceId: {
              id: senderUserId,
              workspaceId,
            },
          },
        });

        if (!userRecord) {
          logger.info(`[User Register] Auto-registering user=${senderUserId} via DM`);
          await prisma.user.create({
            data: {
              id: senderUserId,
              workspaceId,
            },
          });

          logger.info(`[User Register] Successfully registered user=${senderUserId}, sending welcome DM`);
          await client.chat.postMessage({
            channel: channelId,
            text: `👋 *Welcome to Reply Tracker!* I have registered your user ID (\`${senderUserId}\`).\n\nI will now track messages in channels I have access to where you are mentioned, or where someone replies to threads you've participated in. Every morning at 9:00 AM, I'll send you a digest of your pending items here.\n\nUse \`/pause <id> <duration>\` to snooze items if you need more time to reply!`,
          });
        } else {
          logger.debug(`[Event: message] User=${senderUserId} is already registered`);
        }
        return; // DMs to the bot are not tracked as items for the sender to reply to
      }

      // 2. Fetch all registered users in this workspace
      const registeredUsers = await prisma.user.findMany({
        where: { workspaceId },
      });

      if (registeredUsers.length === 0) {
        logger.debug(`[Event: message] No registered users in workspace ${workspaceId}, skipping checks`);
        return;
      }

      logger.info(`[Event: message] Evaluating message for ${registeredUsers.length} registered user(s)`);

      // Get the team info for building the Slack link
      const teamInfo = await client.team.info({ team: workspaceId });
      const workspaceDomain = teamInfo.team?.domain ?? workspaceId;

      // 3. Process the message for each registered user
      for (const regUser of registeredUsers) {
        const trackedUserId = regUser.id;

        // If the sender is the registered user themselves
        if (senderUserId === trackedUserId) {
          if (threadTs) {
            logger.info(`[Event: message] User ${trackedUserId} replied in thread ${threadTs} — marking items DONE`);
            recordParticipation(workspaceId, trackedUserId, threadTs);
            await itemService.markThreadDone({
              workspaceId,
              userId: trackedUserId,
              threadTs,
            });
          }
          continue; // Don't track messages sent by the tracked user themselves
        }

        // Check if this message should be tracked for this registered user
        const userParticipatedThreads = new Set(
          [...(participatedThreads.get(getThreadKey(workspaceId, trackedUserId)) ?? [])]
        );

        logger.debug(`[Event: message] Checking track eligibility for user=${trackedUserId}`);
        const decision = shouldTrack({
          text: messageText,
          botUserId: trackedUserId,
          channelType,
          threadTs,
          participatedThreads: userParticipatedThreads,
        });

        if (decision.track) {
          logger.info(`[Event: message] Flagged message for user=${trackedUserId} (reason: ${decision.reason})`);
          const slackLink = buildSlackLink({
            workspaceDomain,
            channelId,
            messageTs,
            threadTs,
          });

          await itemService.trackIfNew({
            workspaceId,
            userId: trackedUserId,
            channelId,
            messageTz: messageTs,
            threadTs,
            authorId: senderUserId,
            messageText,
            slackLink,
            reason: decision.reason,
          });
        } else {
          logger.debug(`[Event: message] Message is not trackable for user=${trackedUserId}`);
        }
      }
    } catch (err) {
      logger.error('Error in messageListener', err);
    }
  });

  logger.info('Message listener registered');
}
