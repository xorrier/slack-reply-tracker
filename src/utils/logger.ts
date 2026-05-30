/**
 * Simple logger that adds timestamps and log levels to console output.
 * Swap this out for a library like pino if you need structured logging later.
 */
function formatMessage(level: string, message: string): string {
  const ts = new Date().toISOString();
  return `[${ts}] [${level}] ${message}`;
}

export const logger = {
  info: (message: string, ...args: unknown[]) =>
    console.log(formatMessage('INFO', message), ...args),

  warn: (message: string, ...args: unknown[]) =>
    console.warn(formatMessage('WARN', message), ...args),

  error: (message: string, ...args: unknown[]) =>
    console.error(formatMessage('ERROR', message), ...args),

  debug: (message: string, ...args: unknown[]) => {
    if (process.env.DEBUG) {
      console.debug(formatMessage('DEBUG', message), ...args);
    }
  },
};
