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
}

export function loadConfig(): NewClientConfig {
  return {
    slackBotToken: process.env.SLACK_BOT_TOKEN,
    slackChannel: process.env.SLACK_NEW_CLIENT_CHANNEL,
    dataFile: path.resolve(__dirname, '../../data/new-clients.json'),
  };
}
