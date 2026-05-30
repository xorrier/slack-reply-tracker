import 'dotenv/config';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  slack: {
    clientId: requireEnv('SLACK_CLIENT_ID'),
    clientSecret: requireEnv('SLACK_CLIENT_SECRET'),
    signingSecret: requireEnv('SLACK_SIGNING_SECRET'),
    stateSecret: requireEnv('SLACK_STATE_SECRET'),
  },
  database: {
    url: requireEnv('DATABASE_URL'),
  },
  app: {
    url: requireEnv('APP_URL'),
    port: parseInt(process.env.PORT ?? '3000', 10),
  },
};
