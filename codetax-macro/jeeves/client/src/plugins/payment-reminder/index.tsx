import type { MacroPagePlugin } from '../types';
import { PaymentReminderPage } from './PaymentReminderPage';

export const paymentReminderPlugin: MacroPagePlugin = {
  id: 'payment-reminder',
  name: '미수업체 입금요청 카톡',
  icon: '💬',
  status: 'ready',
  description: '익월 10일 — Airtable 수수료 테이블에서 출금실패 거래처에 카톡 입금요청 발송',
  Page: PaymentReminderPage,
  category: 'send',
};
