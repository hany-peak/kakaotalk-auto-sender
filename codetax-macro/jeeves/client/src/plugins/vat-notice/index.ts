import type { MacroPagePlugin } from '../types';
import { VatNoticePage } from './VatNoticePage';

export const vatNoticePlugin: MacroPagePlugin = {
  id: 'vat-notice',
  name: '부가가치세 예정고지',
  icon: '⚡',
  status: 'ready',
  description: 'Excel upload → HomeTax auto-collection → KakaoTalk send',
  Page: VatNoticePage,
  badge: 'NEW',
};
