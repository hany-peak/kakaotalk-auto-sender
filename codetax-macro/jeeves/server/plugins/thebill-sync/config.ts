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
  airtableFeePat: string;
  airtableFeeBaseId: string;
  airtableFeeTableId: string;
  airtableFeeBizNoField: string;
  airtableFeeAmountField: string;
  airtableFeeStatusField: string;
  airtableFeeNameField: string;
  // 빈 문자열이면 동적 [N월] 뷰. 명시되면 그 뷰를 항상 사용 (scope-무관 뷰 권장).
  airtableFeeViewName: string;
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
    airtableFeePat: process.env.AIRTABLE_FEE_PAT,
    airtableFeeBaseId: process.env.AIRTABLE_FEE_BASE_ID,
    airtableFeeTableId: process.env.AIRTABLE_FEE_TABLE_ID,
    airtableFeeBizNoField: process.env.AIRTABLE_FEE_BIZNO_FIELD ?? '사업자번호',
    airtableFeeAmountField: process.env.AIRTABLE_FEE_AMOUNT_FIELD ?? '기장료',
    airtableFeeStatusField: process.env.AIRTABLE_FEE_STATUS_FIELD ?? '출금상태',
    airtableFeeNameField: process.env.AIRTABLE_FEE_NAME_FIELD ?? '거래처명',
    slackBotToken: process.env.SLACK_BOT_TOKEN,
    slackChannel: process.env.SLACK_CHANNEL,
  };
  const missing = Object.entries(required)
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (missing.length > 0) throw new ThebillConfigError(missing);
  return {
    ...(required as Omit<ThebillConfig, 'airtableFeeViewName'>),
    airtableFeeViewName: process.env.AIRTABLE_FEE_VIEW_NAME ?? '',
  };
}

export const STATE_FILE = path.resolve(
  __dirname,
  '../../../logs/thebill-sync/state.json',
);
