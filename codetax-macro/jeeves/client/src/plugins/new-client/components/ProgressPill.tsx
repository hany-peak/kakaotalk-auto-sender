interface Props {
  done: number;
  total: number;
}

export function ProgressPill({ done, total }: Props) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div className="inline-flex items-center gap-2 min-w-[140px]">
      <div className="flex-1 bg-surface2 rounded-full h-2 overflow-hidden">
        <div
          className="h-full bg-accent transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-muted tabular-nums whitespace-nowrap">
        {done}/{total}
      </span>
    </div>
  );
}
