import type { MacroPagePlugin } from '../types';
import { ThebillSyncPage } from './ThebillSyncPage';

export const thebillWithdrawalPlugin: MacroPagePlugin = {
  id: 'thebill-sync-withdrawal',
  name: '출금결과 동기화',
  icon: '📊',
  status: 'ready',
  description: '더빌 [출금결과조회] 엑셀을 받아 수수료 테이블의 출금상태를 출금성공/자동재출금으로 갱신합니다.',
  Page: () => (
    <ThebillSyncPage
      pluginId="thebill-sync-withdrawal"
      title="📊 출금결과 → 에어테이블 (매월 26일)"
      description="더빌 [출금결과조회] 엑셀을 받아 수수료 테이블의 출금상태를 출금성공/자동재출금으로 갱신합니다."
    />
  ),
  category: 'scheduled',
};

export const thebillReWithdrawalPlugin: MacroPagePlugin = {
  id: 'thebill-sync-reWithdrawal',
  name: '재출금결과 동기화',
  icon: '📊',
  status: 'ready',
  description: '더빌 [회원상태/출금설정] 엑셀을 받아 수수료 테이블의 출금상태를 출금성공/출금실패로 갱신합니다.',
  Page: () => (
    <ThebillSyncPage
      pluginId="thebill-sync-reWithdrawal"
      title="📊 재출금결과 → 에어테이블 (25+8영업일)"
      description="더빌 [회원상태/출금설정] 엑셀을 받아 수수료 테이블의 출금상태를 출금성공/출금실패로 갱신합니다."
    />
  ),
  category: 'scheduled',
};
