import type { MacroPlugin } from '../types';
import { registerNewClientRoutes } from './routes';

export const newClientPlugin: MacroPlugin = {
  id: 'new-client',
  name: '신규 수임처 등록',
  icon: '📋',
  status: 'ready',
  registerRoutes: registerNewClientRoutes,
};
