/**
 * app.ts — Application Entry Point
 *
 * Initializes the Slack Bolt app with OAuth support,
 * registers all listeners, and starts the HTTP server + cron scheduler.
 */

import './config'; // Validate env vars at startup
import { App, ExpressReceiver } from '@slack/bolt';
import { prisma } from './prisma/client';
import { config } from './config';
import { registerMessageListener } from './listeners/messageListener';
import { registerReactionListener } from './listeners/reactionListener';
import { registerActionListeners } from './listeners/actionListener';
import { startScheduler } from './scheduler/dailyCron';
import { logger } from './utils/logger';

/**
 * Custom OAuth state store using Prisma (stores state in memory for simplicity).
 * For production, this could be stored in the DB, but for a single-server deploy,
 * in-memory is fine.
 */
const stateStore = new Map<string, { state: string; createdAt: Date }>();

const receiver = new ExpressReceiver({
  signingSecret: config.slack.signingSecret,
  clientId: config.slack.clientId,
  clientSecret: config.slack.clientSecret,
  stateSecret: config.slack.stateSecret,
  scopes: [
    'channels:history',
    'groups:history',
    'im:history',
    'mpim:history',
    'chat:write',
    'reactions:read',
    'users:read',
    'team:read',
    'commands',
  ],
  installationStore: {
    /**
     * Called after a workspace successfully installs the bot.
     * We save the workspace ID and bot token to the DB.
     */
    storeInstallation: async (installation) => {
      const teamId = installation.team?.id;
      const teamName = installation.team?.name ?? 'Unknown';
      const botToken = installation.bot?.token;

      if (!teamId || !botToken) {
        throw new Error('Invalid installation — missing team ID or bot token');
      }

      await prisma.workspace.upsert({
        where: { id: teamId },
        update: { botToken, teamName },
        create: { id: teamId, teamName, botToken },
      });

      logger.info(`Workspace installed: ${teamName} (${teamId})`);
    },

    /**
     * Called on every incoming event to fetch the bot token for the workspace.
     */
    fetchInstallation: async (installQuery) => {
      const teamId = installQuery.teamId;

      if (!teamId) {
        throw new Error('Missing teamId in installQuery');
      }

      const workspace = await prisma.workspace.findUnique({ where: { id: teamId } });

      if (!workspace) {
        throw new Error(`Workspace ${teamId} not found — has the bot been installed?`);
      }

      // Return the minimal installation object Bolt needs
      return {
        team: { id: workspace.id, name: workspace.teamName },
        enterprise: undefined,
        bot: {
          token: workspace.botToken,
          scopes: [],
          id: '',
          userId: '',
        },
        user: { id: '', token: undefined, scopes: undefined },
        appId: undefined,
        authVersion: 'v2' as const,
      };
    },
  },
  installerOptions: {
    directInstall: true,
  },
});

const app = new App({ receiver });

// ─────────────────────────────────────────────────────────────
// NOTE: For multi-workspace, "trackedUserId" is the per-user Slack ID.
// In V1 we simplified: the bot tracks messages for ALL users in the workspace
// (anyone @mentioned, getting DMs, etc.) by detecting the message target from
// the event itself.
//
// The listeners receive the target userId from the Slack event (e.g. who was
// @mentioned, who the DM was sent to). The trackedUserId below is the BOT's
// own user ID, used to detect @mentions of the bot and filter out bot messages.
//
// For the personal single-user use case, set TRACKED_USER_ID to your own Slack user ID.
// For multi-workspace, the message listener extracts the target user from the event.
// ─────────────────────────────────────────────────────────────

// Register all event listeners
registerMessageListener(app);
registerReactionListener(app);
registerActionListeners(app);

// ─────────────────────────────────────────────────────────────
// "Add to Slack" landing page
// ─────────────────────────────────────────────────────────────
receiver.router.get('/', (_req, res) => {
  const installUrl = `${config.app.url}/slack/install`;
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Slack Reply Tracker</title>
      <style>
        body { font-family: sans-serif; max-width: 600px; margin: 80px auto; text-align: center; color: #1a1a2e; }
        h1 { font-size: 2rem; margin-bottom: 0.5rem; }
        p { color: #555; margin-bottom: 2rem; }
        a.add-btn {
          display: inline-block;
          background: #4A154B;
          color: #fff;
          padding: 14px 28px;
          border-radius: 8px;
          text-decoration: none;
          font-size: 1.1rem;
          font-weight: 600;
        }
        a.add-btn:hover { background: #611f69; }
      </style>
    </head>
    <body>
      <h1>🔔 Slack Reply Tracker</h1>
      <p>Never miss a message that needs your reply. Get a daily digest of everything that needs your attention.</p>
      <a class="add-btn" href="${installUrl}">Add to Slack</a>
    </body>
    </html>
  `);
});

// ─────────────────────────────────────────────────────────────
// Start the server
// ─────────────────────────────────────────────────────────────
(async () => {
  await app.start(config.app.port);
  logger.info(`⚡ Slack Reply Tracker running on port ${config.app.port}`);
  logger.info(`🌐 App URL: ${config.app.url}`);

  startScheduler();
})();
