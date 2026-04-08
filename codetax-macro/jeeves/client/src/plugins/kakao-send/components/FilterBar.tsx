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
      <span className="text-xs text-muted whitespace-nowrap">Filter:</span>
      <input
        type="text"
        placeholder="Search..."
        value={props.textFilter}
        onChange={(e) => props.onTextChange(e.target.value)}
        className="bg-surface2 border border-border rounded-lg text-text py-[7px] px-3 text-[13px] outline-none w-40"
      />
      <select value={props.imageFilter} onChange={(e) => props.onImageChange(e.target.value)} className={selectClass}>
        <option value="">Verify: All</option>
        <option value="ok">✅ Match</option>
        <option value="warn">⚠️ Warning</option>
      </select>
      <select value={props.noteFilter} onChange={(e) => props.onNoteChange(e.target.value)} className={selectClass}>
        <option value="">Notes: All</option>
        <option value="__none__">— None</option>
        {props.noteOptions.map((n) => (
          <option key={n} value={n}>{n}</option>
        ))}
      </select>
      <select value={props.statusFilter} onChange={(e) => props.onStatusChange(e.target.value)} className={selectClass}>
        <option value="">Status: All</option>
        <option value="done">Done</option>
        <option value="sending">Sending</option>
        <option value="failed">Failed</option>
        <option value="skipped">Skipped</option>
        <option value="pending">Pending</option>
      </select>
      <span className="text-xs text-muted whitespace-nowrap ml-4">Sort:</span>
      <select value={props.sortValue} onChange={(e) => props.onSortChange(e.target.value)} className={selectClass}>
        <option value="default">Default (done last)</option>
        <option value="status-asc">Status asc</option>
        <option value="status-desc">Status desc</option>
      </select>
      <span className="text-xs text-muted whitespace-nowrap">{props.shownCount} / {props.totalCount}</span>
    </div>
  );
}
