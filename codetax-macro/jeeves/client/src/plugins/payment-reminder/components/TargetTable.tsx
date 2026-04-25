interface Target {
  recordId: string;
  name: string;
  bizNo: string;
  amount: number;
}

interface Props {
  targets: Target[];
  selected: Set<string>;
  onToggle: (recordId: string) => void;
  onToggleAll: (checked: boolean) => void;
}

export function TargetTable({ targets, selected, onToggle, onToggleAll }: Props) {
  const allChecked = targets.length > 0 && targets.every((t) => selected.has(t.recordId));
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-muted border-b border-border">
          <tr>
            <th className="text-left py-2 w-8">
              <input
                type="checkbox"
                checked={allChecked}
                onChange={(e) => onToggleAll(e.target.checked)}
              />
            </th>
            <th className="text-left">거래처</th>
            <th className="text-left">사업자번호</th>
            <th className="text-right">기장료</th>
          </tr>
        </thead>
        <tbody>
          {targets.map((t) => (
            <tr key={t.recordId} className="border-b border-border/50">
              <td className="py-2">
                <input
                  type="checkbox"
                  checked={selected.has(t.recordId)}
                  onChange={() => onToggle(t.recordId)}
                />
              </td>
              <td>{t.name}</td>
              <td>{t.bizNo}</td>
              <td className="text-right">{t.amount.toLocaleString('ko-KR')}원</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
