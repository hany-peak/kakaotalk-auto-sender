interface SimpleTarget {
  name: string;
  bizNo: string;
  groupName: string;
  status: string;
}

interface SimpleTargetTableProps {
  targets: SimpleTarget[];
  checkedKeys: Set<string>;
  onToggle: (key: string) => void;
  onToggleAll: (checked: boolean) => void;
  allChecked: boolean;
  onGroupNameChange: (key: string, value: string) => void;
  statusMap: Record<string, string>;
}

const statusStyles: Record<string, { bg: string; color: string; label: string }> = {
  done: { bg: 'bg-success/20', color: 'text-success', label: '완료' },
  sending: { bg: 'bg-accent/20', color: 'text-accent', label: '전송중' },
  failed: { bg: 'bg-danger/20', color: 'text-danger', label: '실패' },
  skipped: { bg: 'bg-yellow-400/20', color: 'text-yellow-400', label: '건너뜀' },
};

export function SimpleTargetTable(props: SimpleTargetTableProps) {
  return (
    <div className="overflow-y-auto" style={{ maxHeight: '60vh' }}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left">
            <th className="w-9 text-center p-2">
              <input
                type="checkbox"
                checked={props.allChecked}
                onChange={(e) => props.onToggleAll(e.target.checked)}
                className="w-[15px] h-[15px] cursor-pointer accent-accent"
              />
            </th>
            <th className="p-2">사업자명</th>
            <th className="p-2">사업자번호</th>
            <th className="p-2">그룹 카톡방 검색어</th>
            <th className="p-2">전송 여부</th>
          </tr>
        </thead>
        <tbody>
          {props.targets.map((t) => {
            const key = t.bizNo.replace(/-/g, '');
            const liveStatus = props.statusMap[key] || t.status;
            const style = statusStyles[liveStatus] || { bg: 'bg-muted/15', color: 'text-muted', label: '대기중' };

            return (
              <tr
                key={key}
                className={`border-b border-border/50 hover:bg-surface2/50 ${liveStatus === 'done' ? 'bg-success/[0.04]' : ''}`}
              >
                <td className="text-center p-2">
                  <input
                    type="checkbox"
                    checked={props.checkedKeys.has(key)}
                    onChange={() => props.onToggle(key)}
                    className="w-[15px] h-[15px] cursor-pointer accent-accent"
                  />
                </td>
                <td className="p-2">{t.name}</td>
                <td className="p-2 font-mono text-xs">{t.bizNo}</td>
                <td className="p-2">
                  <input
                    value={t.groupName}
                    onChange={(e) => props.onGroupNameChange(key, e.target.value)}
                    className="bg-surface2 border border-border rounded-md text-text px-2.5 py-1 text-[13px] w-full outline-none"
                  />
                </td>
                <td className="p-2">
                  <span className={`${style.bg} ${style.color} text-[11px] px-2 py-0.5 rounded-full`}>
                    {style.label}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
