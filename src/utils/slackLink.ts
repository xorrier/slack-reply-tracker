/**
 * Builds a deep link to a Slack message.
 *
 * Format: https://<workspace>.slack.com/archives/<channelId>/p<ts_without_dot>
 *
 * If threadTs is provided, it appends thread_ts query param so the link
 * opens directly to the reply within the thread.
 */
export function buildSlackLink(params: {
  workspaceDomain: string;
  channelId: string;
  messageTs: string;
  threadTs?: string;
}): string {
  const { workspaceDomain, channelId, messageTs, threadTs } = params;

  // Slack timestamps look like "1716000000.123456" — the link uses them without the dot
  const tsForUrl = messageTs.replace('.', '');

  let url = `https://${workspaceDomain}.slack.com/archives/${channelId}/p${tsForUrl}`;

  if (threadTs) {
    url += `?thread_ts=${threadTs}&cid=${channelId}`;
  }

  return url;
}
