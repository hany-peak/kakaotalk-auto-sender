interface ProgressBarProps {
  current: number;
  total: number;
  success: number;
  failed: number;
}

export function ProgressBar({ current, total, success, failed }: ProgressBarProps) {
  const pct = total ? Math.round((current / total) * 100) : 0;

  return (
    <div>
      <div className="bg-surface2 rounded-lg h-2.5 mb-4 overflow-hidden">
        <div
          className="h-full bg-accent rounded-lg transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex gap-5">
        <Stat value={total} label="전체" />
        <Stat value={success} label="완료" className="text-success" />
        <Stat value={failed} label="실패" className="text-danger" />
        <Stat value={current} label="처리 중" className="text-accent" />
      </div>
    </div>
  );
}

function Stat({ value, label, className = '' }: { value: number; label: string; className?: string }) {
  return (
    <div className="text-center">
      <div className={`text-lg font-bold ${className}`}>{value}</div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  );
}
