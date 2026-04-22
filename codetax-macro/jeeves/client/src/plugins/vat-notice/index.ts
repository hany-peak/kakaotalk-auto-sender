import type { MacroPagePlugin } from '../types';
import { VatNoticePage } from './VatNoticePage';

export const vatNoticePlugin: MacroPagePlugin = {
  id: 'vat-notice',
  name: '부가가치세 예정고지',
  icon: '⚡',
  status: 'ready',
  description: '엑셀 업로드 → 홈택스 자동 수집 → 카카오톡 전송',
  Page: VatNoticePage,
  badge: 'NEW',
};
