import type { MacroPagePlugin } from '../types';
import { ThebillSyncPage } from './ThebillSyncPage';

export const thebillSyncPlugin: MacroPagePlugin = {
  id: 'thebill-sync',
  name: '매월 미납 금액 슬랙 자동 전송',
  icon: '📊',
  status: 'ready',
  description: '매일 08:00 자동 실행 — 엑셀 다운로드 → Airtable → 슬랙',
  Page: ThebillSyncPage,
  category: 'scheduled',
};
