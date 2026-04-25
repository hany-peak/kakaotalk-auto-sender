import { useState } from 'react';
import type { MacroPagePlugin } from '../types';
import { ThebillSyncPage } from './ThebillSyncPage';

interface ModeConfig {
  pluginId: string;
  tabLabel: string;
  title: string;
  description: string;
}

const MODES: ModeConfig[] = [
  {
    pluginId: 'thebill-sync-withdrawal',
    tabLabel: '출금결과 동기화',
    title: '📊 출금결과 → 에어테이블 (매월 26일)',
    description:
      '더빌 [출금결과조회] 엑셀을 받아 수수료 테이블의 출금상태를 출금성공/자동재출금으로 갱신합니다.',
  },
  {
    pluginId: 'thebill-sync-reWithdrawal',
    tabLabel: '재출금결과 동기화',
    title: '📊 재출금결과 → 에어테이블 (25+8영업일)',
    description:
      '더빌 [회원상태/출금설정] 엑셀을 받아 수수료 테이블의 출금상태를 출금성공/출금실패로 갱신합니다.',
  },
];

function ThebillSyncCombinedPage() {
  const [activeId, setActiveId] = useState(MODES[0].pluginId);
  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex border-b border-border mb-6">
        {MODES.map((m) => {
          const active = m.pluginId === activeId;
          return (
            <button
              key={m.pluginId}
              onClick={() => setActiveId(m.pluginId)}
              className={
                'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ' +
                (active
                  ? 'border-accent text-accent'
                  : 'border-transparent text-muted hover:text-fg')
              }
            >
              {m.tabLabel}
            </button>
          );
        })}
      </div>
      {MODES.map(
        (m) =>
          m.pluginId === activeId && (
            <ThebillSyncPage
              key={m.pluginId}
              pluginId={m.pluginId}
              title={m.title}
              description={m.description}
            />
          ),
      )}
    </div>
  );
}

export const thebillSyncPlugin: MacroPagePlugin = {
  id: 'thebill-sync',
  name: '더빌 출금결과 동기화',
  icon: '📊',
  status: 'ready',
  description: '출금결과 / 재출금결과 두 모드를 한 페이지에서 관리',
  Page: ThebillSyncCombinedPage,
  category: 'scheduled',
};
