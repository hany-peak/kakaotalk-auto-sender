import type { MacroPagePlugin } from './types';
import { vatNoticePlugin } from './vat-notice';
import { kakaoSendPlugin } from './kakao-send';

function PlaceholderPage() {
  return <div className="text-muted">Coming soon...</div>;
}

export const plugins: MacroPagePlugin[] = [
  vatNoticePlugin,
  kakaoSendPlugin,
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
