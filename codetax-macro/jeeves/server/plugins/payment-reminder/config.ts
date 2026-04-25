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
  // 빈 문자열이면 동적으로 [N월] 뷰 사용. 명시되면 그 뷰를 항상 사용
  // (기장↔신고대리 scope 변경된 거래처가 빠지지 않도록 scope-무관 뷰 필요).
  viewName: string;
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
  };
  const missing = Object.entries(required)
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (missing.length > 0) throw new PaymentReminderConfigError(missing);
  return {
    ...(required as Omit<PaymentReminderConfig, 'viewName'>),
    viewName: process.env.AIRTABLE_FEE_VIEW_NAME ?? '',
  };
}
