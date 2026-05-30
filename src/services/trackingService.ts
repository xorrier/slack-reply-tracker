/**
 * Tracking Service
 *
 * Decides whether an incoming Slack message should be tracked and why.
 * This is the core "detection engine" of the bot.
 *
 * V1: Rule-based only (no AI).
 * The code is structured so an AI classifier can replace or supplement
 * the rule checks in the future by swapping out this module.
 */

import { TrackingReason } from '@prisma/client';

export type TrackingDecision =
  | { track: true; reason: TrackingReason }
  | { track: false };

/**
 * Action phrases that suggest someone needs input from the user.
 * All lowercase — comparison is case-insensitive.
 */
const ACTION_PHRASES = [
  'can you',
  'could you',
  'please check',
  'please review',
  'need your input',
  'what do you think',
];

/**
 * Determine if a message should be tracked and the reason for it.
 *
 * @param params.text          The raw message text
 * @param params.botUserId     The Slack user_id of the person we're tracking for
 * @param params.channelType   'im' for DMs, 'mpim' for group DMs, 'channel' for channels
 * @param params.threadTs      If set, the message is a thread reply
 * @param params.participatedThreads  Set of thread_ts values where botUserId has posted
 */
export function shouldTrack(params: {
  text: string;
  botUserId: string;
  channelType: string;
  threadTs?: string;
  participatedThreads?: Set<string>;
}): TrackingDecision {
  const { text, botUserId, channelType, threadTs, participatedThreads } = params;

  // Rule 1: Direct Message
  if (channelType === 'im' || channelType === 'mpim') {
    return { track: true, reason: TrackingReason.DIRECT_MESSAGE };
  }

  // Rule 2: Mentioned by @user_id
  if (text.includes(`<@${botUserId}>`)) {
    return { track: true, reason: TrackingReason.MENTIONED };
  }

  // Rule 3: Reply in a thread where the user has participated
  if (threadTs && participatedThreads?.has(threadTs)) {
    return { track: true, reason: TrackingReason.THREAD_REPLY };
  }

  // Rule 4: Action phrase detected (case-insensitive)
  const lowerText = text.toLowerCase();
  const matchedPhrase = ACTION_PHRASES.find((phrase) => lowerText.includes(phrase));
  if (matchedPhrase) {
    return { track: true, reason: TrackingReason.ACTION_PHRASE };
  }

  return { track: false };
}

/**
 * Returns a human-readable label for each tracking reason.
 * Used in the daily digest message.
 */
export function reasonLabel(reason: TrackingReason): string {
  const labels: Record<TrackingReason, string> = {
    [TrackingReason.MENTIONED]: 'You were mentioned',
    [TrackingReason.THREAD_REPLY]: 'Reply in your thread',
    [TrackingReason.DIRECT_MESSAGE]: 'Direct message',
    [TrackingReason.ACTION_PHRASE]: 'Action requested',
  };
  return labels[reason];
}
