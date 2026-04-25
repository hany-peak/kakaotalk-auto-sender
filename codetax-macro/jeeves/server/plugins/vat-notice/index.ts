import type { MacroPlugin } from '../types';
import { registerVatRoutes } from './routes';

export const vatNoticePlugin: MacroPlugin = {
  id: 'vat-notice',
  name: '부가가치세 예정고지',
  icon: '⚡',
  status: 'ready',
  registerRoutes: registerVatRoutes,
};
