import type { MacroPlugin } from '../types';
import { registerThebillRoutes } from './routes';
import { run } from './pipeline';

export const thebillSyncPlugin: MacroPlugin = {
  id: 'thebill-sync',
  name: '매월 미납 금액 슬랙 자동 전송',
  icon: '📊',
  status: 'ready',
  registerRoutes: registerThebillRoutes,
  schedule: {
    defaultCron: '0 8 * * *',
    defaultEnabled: false,
    timezone: 'Asia/Seoul',
    run,
  },
};
