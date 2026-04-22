import { ProgressPill } from './ProgressPill';
import type { NewClientListItem } from '../types';

interface Props {
  items: NewClientListItem[];
  onSelect: (id: string) => void;
}

function formatKst(iso: string | undefined): string {
  if (!iso) return '-';
  const d = new Date(iso);
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return `${kst.getUTCFullYear()}-${String(kst.getUTCMonth() + 1).padStart(2, '0')}-${String(kst.getUTCDate()).padStart(2, '0')} ${String(kst.getUTCHours()).padStart(2, '0')}:${String(kst.getUTCMinutes()).padStart(2, '0')}`;
}

export function ClientListTable({ items, onSelect }: Props) {
  if (items.length === 0) {
    return <div className="text-muted text-sm">등록된 거래처가 없습니다.</div>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-muted text-left">
            <th className="py-2 pr-4">업체명</th>
            <th className="py-2 pr-4">대표자</th>
            <th className="py-2 pr-4">업종</th>
            <th className="py-2 pr-4">업무착수일</th>
            <th className="py-2 pr-4">진행률</th>
            <th className="py-2 pr-4">마지막 갱신</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr
              key={item.id}
              onClick={() => onSelect(item.id)}
              className="border-b border-border hover:bg-surface2 cursor-pointer"
            >
              <td className="py-2 pr-4 font-medium">{item.companyName}</td>
              <td className="py-2 pr-4">{item.representative}</td>
              <td className="py-2 pr-4">{item.industry}</td>
              <td className="py-2 pr-4">{item.startDate}</td>
              <td className="py-2 pr-4">
                <ProgressPill done={item.progress.done} total={item.progress.total} />
              </td>
              <td className="py-2 pr-4 text-muted">{formatKst(item.checklistUpdatedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
