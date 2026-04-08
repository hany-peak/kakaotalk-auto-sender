import type { VatStep } from '../hooks/useVatWorkflow';

interface WorkflowBarProps {
  currentStep: VatStep;
  onJumpToKakao: () => void;
}

const steps = [
  { num: 1, title: 'Excel Upload', sub: 'Set query criteria' },
  { num: 2, title: 'HomeTax Login', sub: 'Certificate auth' },
  { num: 3, title: 'Start Collection', sub: 'VAT notice query' },
  { num: 4, title: 'In Progress', sub: 'Saving notices' },
  { num: 5, title: 'KakaoTalk Send', sub: 'Group chat auto-send' },
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
