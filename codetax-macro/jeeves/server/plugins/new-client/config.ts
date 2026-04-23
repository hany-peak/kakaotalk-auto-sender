import * as path from 'path';
import * as fs from 'fs';

const ENV_PATH = path.resolve(__dirname, '../../../.env');
if (fs.existsSync(ENV_PATH)) {
  require('dotenv').config({ path: ENV_PATH });
}

export interface NewClientConfig {
  slackBotToken: string | undefined;
  slackChannel: string | undefined;
  dataFile: string;
  airtableNewClientPat: string | undefined;
  airtableNewClientBaseId: string | undefined;
  airtableNewClientTableName: string;
  airtableNewClientViewName: string;
  dropbox: {
    appKey: string | undefined;
    appSecret: string | undefined;
    refreshToken: string | undefined;
    teamRootNsId: string | undefined;
  };
}

export function loadConfig(): NewClientConfig {
  return {
    slackBotToken: process.env.SLACK_BOT_TOKEN,
    slackChannel: process.env.SLACK_NEW_CLIENT_CHANNEL,
    dataFile: path.resolve(__dirname, '../../data/new-clients.json'),
    airtableNewClientPat: process.env.AIRTABLE_NEW_CLIENT_PAT,
    airtableNewClientBaseId: process.env.AIRTABLE_NEW_CLIENT_BASE_ID,
    airtableNewClientTableName: process.env.AIRTABLE_NEW_CLIENT_TABLE_NAME || '거래처',
    airtableNewClientViewName: process.env.AIRTABLE_NEW_CLIENT_VIEW || 'A. 수임체크리스트',
    dropbox: {
      appKey: process.env.DROPBOX_APP_KEY,
      appSecret: process.env.DROPBOX_APP_SECRET,
      refreshToken: process.env.DROPBOX_REFRESH_TOKEN,
      teamRootNsId: process.env.DROPBOX_TEAM_ROOT_NS_ID,
    },
  };
}
