import * as path from 'path';
import * as fs from 'fs';

const ENV_PATH = path.resolve(__dirname, '../../../.env');
if (fs.existsSync(ENV_PATH)) {
  require('dotenv').config({ path: ENV_PATH });
}

export interface ThebillConfig {
  cmsLoginUrl: string;
  cmsUsername: string;
  cmsPassword: string;
  airtablePat: string;
  airtableBaseId: string;
  airtableTableName: string;
  airtableKeyField: string;
  slackBotToken: string;
  slackChannel: string;
}

export class ThebillConfigError extends Error {
  constructor(public missing: string[]) {
    super(`thebill-sync: missing env vars: ${missing.join(', ')}`);
    this.name = 'ThebillConfigError';
  }
}

export function loadConfig(): ThebillConfig {
  const required = {
    cmsLoginUrl: process.env.THEBILL_CMS_LOGIN_URL,
    cmsUsername: process.env.THEBILL_CMS_USERNAME,
    cmsPassword: process.env.THEBILL_CMS_PASSWORD,
    airtablePat: process.env.AIRTABLE_PAT,
    airtableBaseId: process.env.AIRTABLE_BASE_ID,
    airtableTableName: process.env.AIRTABLE_TABLE_NAME,
    airtableKeyField: process.env.AIRTABLE_KEY_FIELD,
    slackBotToken: process.env.SLACK_BOT_TOKEN,
    slackChannel: process.env.SLACK_CHANNEL,
  };
  const missing = Object.entries(required)
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (missing.length > 0) throw new ThebillConfigError(missing);
  return required as ThebillConfig;
}

export const STATE_FILE = path.resolve(
  __dirname,
  '../../../logs/thebill-sync/state.json',
);
