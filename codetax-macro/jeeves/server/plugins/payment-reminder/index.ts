import type { MacroPlugin } from '../types';
import { registerPaymentReminderRoutes } from './routes';

export const paymentReminderPlugin: MacroPlugin = {
  id: 'payment-reminder',
  name: '미수업체 입금요청 카톡 (익월 10일)',
  icon: '💬',
  status: 'ready',
  registerRoutes: registerPaymentReminderRoutes,
  // 의도적으로 schedule 미설정 — 사람 검토 필수, 수동 트리거만
};
