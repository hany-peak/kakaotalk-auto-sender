import type { MacroPagePlugin } from './types';
import { vatNoticePlugin } from './vat-notice';
import { kakaoSendPlugin } from './kakao-send';
import { thebillWithdrawalPlugin, thebillReWithdrawalPlugin } from './thebill-sync';
import { newClientPlugin } from './new-client';
import { paymentReminderPlugin } from './payment-reminder';

function PlaceholderPage() {
  return <div className="text-muted">준비 중...</div>;
}

export const plugins: MacroPagePlugin[] = [
  vatNoticePlugin,
  kakaoSendPlugin,
  thebillWithdrawalPlugin,
  thebillReWithdrawalPlugin,
  newClientPlugin,
  paymentReminderPlugin,
  {
    id: 'income-tax',
    name: '소득세 집계',
    icon: '📊',
    status: 'coming-soon',
    description: '홈택스 소득 데이터 집계 및 정리',
    Page: PlaceholderPage,
  },
  {
    id: 'withholding-tax',
    name: '원천세 정리',
    icon: '🧾',
    status: 'coming-soon',
    description: '원천세 납부 내역 자동 분류',
    Page: PlaceholderPage,
  },
  {
    id: 'biz-lookup',
    name: '사업자 조회',
    icon: '🔍',
    status: 'coming-soon',
    description: '사업자번호 일괄 상태 확인',
    Page: PlaceholderPage,
  },
];
