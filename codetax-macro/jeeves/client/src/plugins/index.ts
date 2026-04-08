import type { MacroPagePlugin } from './types';

// Placeholder pages - will be replaced in Tasks 12-13
function PlaceholderPage() {
  return <div className="text-muted">Coming soon...</div>;
}

export const plugins: MacroPagePlugin[] = [
  {
    id: 'vat-notice',
    name: '부가가치세 예정고지',
    icon: '⚡',
    status: 'ready',
    description: 'Excel upload -> HomeTax auto-collection -> KakaoTalk send',
    Page: PlaceholderPage,
    badge: 'NEW',
  },
  {
    id: 'kakao-send',
    name: '카카오톡 전송',
    icon: '💬',
    status: 'ready',
    description: 'Send images and messages to KakaoTalk group chats',
    Page: PlaceholderPage,
  },
  {
    id: 'income-tax',
    name: '소득세 집계',
    icon: '📊',
    status: 'coming-soon',
    description: 'HomeTax income data aggregation',
    Page: PlaceholderPage,
  },
  {
    id: 'withholding-tax',
    name: '원천세 정리',
    icon: '🧾',
    status: 'coming-soon',
    description: 'Withholding tax auto-classification',
    Page: PlaceholderPage,
  },
  {
    id: 'biz-lookup',
    name: '사업자 조회',
    icon: '🔍',
    status: 'coming-soon',
    description: 'Batch business number verification',
    Page: PlaceholderPage,
  },
];
