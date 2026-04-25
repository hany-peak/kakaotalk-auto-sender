import type { MacroPlugin } from '../types';
import { registerThebillRoutes } from './routes';
import { run } from './pipeline';

export const thebillWithdrawalPlugin: MacroPlugin = {
  id: 'thebill-sync-withdrawal',
  name: '더빌 출금결과 → 에어테이블 (매월 26일)',
  icon: '📊',
  status: 'ready',
  registerRoutes: registerThebillRoutes,
  schedule: {
    defaultCron: '0 9 26 * *',
    defaultEnabled: false,
    timezone: 'Asia/Seoul',
    run: (ctx) => run(ctx, { mode: 'withdrawal' }),
  },
};

export const thebillReWithdrawalPlugin: MacroPlugin = {
  id: 'thebill-sync-reWithdrawal',
  name: '더빌 재출금결과 → 에어테이블 (25+8영업일)',
  icon: '📊',
  status: 'ready',
  registerRoutes: registerThebillRoutes,
  schedule: {
    defaultCron: '0 9 * * *',
    defaultEnabled: false,
    timezone: 'Asia/Seoul',
    run: (ctx) => run(ctx, { mode: 'reWithdrawal' }),
  },
};
