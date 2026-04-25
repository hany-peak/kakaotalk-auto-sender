import * as path from 'path';
import * as fs from 'fs';

const ENV_PATH = path.resolve(__dirname, '../../../.env');
if (fs.existsSync(ENV_PATH)) {
  require('dotenv').config({ path: ENV_PATH });
}

export interface PaymentReminderConfig {
  airtablePat: string;
  airtableBaseId: string;
  airtableTableId: string;
  bizNoField: string;
  amountField: string;
  statusField: string;
  nameField: string;
  bankAccount: string;
  slackBotToken: string;
  slackChannel: string;
}

export class PaymentReminderConfigError extends Error {
  constructor(public missing: string[]) {
    super(`payment-reminder: missing env vars: ${missing.join(', ')}`);
    this.name = 'PaymentReminderConfigError';
  }
}

export function loadConfig(): PaymentReminderConfig {
  const required = {
    airtablePat: process.env.AIRTABLE_FEE_PAT,
    airtableBaseId: process.env.AIRTABLE_FEE_BASE_ID,
    airtableTableId: process.env.AIRTABLE_FEE_TABLE_ID,
    bizNoField: process.env.AIRTABLE_FEE_BIZNO_FIELD ?? '사업자번호',
    amountField: process.env.AIRTABLE_FEE_AMOUNT_FIELD ?? '기장료',
    statusField: process.env.AIRTABLE_FEE_STATUS_FIELD ?? '출금상태',
    nameField: process.env.AIRTABLE_FEE_NAME_FIELD ?? '거래처명',
    bankAccount: process.env.PAYMENT_REMINDER_BANK_ACCOUNT ?? '카카오뱅크 / 3333367093297',
    slackBotToken: process.env.SLACK_BOT_TOKEN,
    slackChannel: process.env.SLACK_CHANNEL,
  };
  const missing = Object.entries(required)
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (missing.length > 0) throw new PaymentReminderConfigError(missing);
  return required as PaymentReminderConfig;
}
