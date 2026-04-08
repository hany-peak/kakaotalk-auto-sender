interface FilterBarProps {
  textFilter: string;
  onTextChange: (v: string) => void;
  imageFilter: string;
  onImageChange: (v: string) => void;
  statusFilter: string;
  onStatusChange: (v: string) => void;
  noteFilter: string;
  onNoteChange: (v: string) => void;
  noteOptions: string[];
  sortValue: string;
  onSortChange: (v: string) => void;
  shownCount: number;
  totalCount: number;
}

export function FilterBar(props: FilterBarProps) {
  const selectClass = 'bg-surface2 border border-border rounded-lg text-text py-[7px] px-2.5 text-[13px] outline-none';

  return (
    <div className="flex gap-2 flex-nowrap items-center mb-2.5">
      <span className="text-xs text-muted whitespace-nowrap">필터:</span>
      <input
        type="text"
        placeholder="검색..."
        value={props.textFilter}
        onChange={(e) => props.onTextChange(e.target.value)}
        className="bg-surface2 border border-border rounded-lg text-text py-[7px] px-3 text-[13px] outline-none w-40"
      />
      <select value={props.imageFilter} onChange={(e) => props.onImageChange(e.target.value)} className={selectClass}>
        <option value="">검증 전체</option>
        <option value="ok">✅ 일치</option>
        <option value="warn">⚠️ 주의</option>
      </select>
      <select value={props.noteFilter} onChange={(e) => props.onNoteChange(e.target.value)} className={selectClass}>
        <option value="">특이사항 전체</option>
        <option value="__none__">— 없음</option>
        {props.noteOptions.map((n) => (
          <option key={n} value={n}>{n}</option>
        ))}
      </select>
      <select value={props.statusFilter} onChange={(e) => props.onStatusChange(e.target.value)} className={selectClass}>
        <option value="">상태 전체</option>
        <option value="done">완료</option>
        <option value="sending">전송 중</option>
        <option value="failed">실패</option>
        <option value="skipped">건너뜀</option>
        <option value="pending">대기중</option>
      </select>
      <span className="text-xs text-muted whitespace-nowrap ml-4">정렬:</span>
      <select value={props.sortValue} onChange={(e) => props.onSortChange(e.target.value)} className={selectClass}>
        <option value="default">기본 (완료 하단)</option>
        <option value="status-asc">상태 오름차순</option>
        <option value="status-desc">상태 내림차순</option>
      </select>
      <span className="text-xs text-muted whitespace-nowrap">{props.shownCount} / {props.totalCount}</span>
    </div>
  );
}
