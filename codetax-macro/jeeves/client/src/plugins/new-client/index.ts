import type { MacroPagePlugin } from '../types';
import { NewClientPage } from './NewClientPage';

export const newClientPlugin: MacroPagePlugin = {
  id: 'new-client',
  name: '신규 수임처 등록',
  icon: '📋',
  status: 'ready',
  description: '양식 입력 → 로컬 저장 + Slack 알림',
  Page: NewClientPage,
  category: 'macro',
};
