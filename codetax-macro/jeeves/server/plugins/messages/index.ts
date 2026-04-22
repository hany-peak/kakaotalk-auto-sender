import type { MacroPlugin } from '../types';
import { registerMessageRoutes } from './routes';

export const messagesPlugin: MacroPlugin = {
  id: 'messages',
  name: 'Message Templates',
  icon: '📝',
  status: 'ready',
  registerRoutes: registerMessageRoutes,
};
