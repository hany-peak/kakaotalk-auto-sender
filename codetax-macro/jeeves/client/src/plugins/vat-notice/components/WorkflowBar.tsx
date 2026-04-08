import type { VatStep } from '../hooks/useVatWorkflow';

interface WorkflowBarProps {
  currentStep: VatStep;
  onJumpToKakao: () => void;
}

const steps = [
  { num: 1, title: '엑셀 업로드', sub: '조회 기준 설정' },
  { num: 2, title: '홈택스 로그인', sub: '공동인증서' },
  { num: 3, title: '수집 시작', sub: '부가가치세 예정고지 납부서 조회' },
  { num: 4, title: '수집 진행중', sub: '납부서 저장' },
  { num: 5, title: '카카오톡 전송하기', sub: '그룹카톡방 자동 전송' },
];

export function WorkflowBar({ currentStep, onJumpToKakao }: WorkflowBarProps) {
  return (
    <div className="flex gap-0 mb-6 overflow-x-auto">
      {steps.map((s, i) => {
        const isDone = s.num < currentStep;
        const isActive = s.num === currentStep;
        const isKakao = s.num === 5;

        return (
          <div key={s.num} className="flex items-center">
            {i > 0 && <div className="text-muted text-lg px-1">›</div>}
            <div
              onClick={isKakao ? onJumpToKakao : undefined}
              className={`flex items-center gap-2.5 px-4 py-2.5 rounded-lg transition-all ${
                isKakao ? 'cursor-pointer' : ''
              } ${
                isActive
                  ? 'bg-accent/15 border border-accent/30'
                  : isDone
                    ? 'bg-success/10 border border-success/20'
                    : 'bg-surface2 border border-border'
              }`}
            >
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  isActive
                    ? 'bg-accent text-white'
                    : isDone
                      ? 'bg-success text-white'
                      : 'bg-border text-muted'
                }`}
              >
                {isDone ? '✓' : s.num}
              </div>
              <div>
                <div className={`text-xs font-semibold ${isActive ? 'text-accent' : isDone ? 'text-success' : 'text-muted'}`}>
                  {s.title}
                </div>
                <div className="text-[10px] text-muted">{s.sub}</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
