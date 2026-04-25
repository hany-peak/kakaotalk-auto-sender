import { CHECKLIST_ITEMS } from '../types';
import { ChecklistItemRow } from './ChecklistItemRow';
import type {
  ChecklistItemKey,
  ChecklistItemState,
  ChecklistState,
  ChecklistUpdateInput,
  NewClientRecord,
} from '../types';

interface Props {
  checklist: ChecklistState;
  pendingKey: ChecklistItemKey | null;
  clientId: string | null;
  record: NewClientRecord;
  onUpdate: (itemKey: ChecklistItemKey, payload: ChecklistUpdateInput) => Promise<void>;
  onDropboxStateUpdate?: (next: ChecklistItemState) => void;
}

export function ChecklistTable({ checklist, pendingKey, clientId, record, onUpdate, onDropboxStateUpdate }: Props) {
  const sorted = [...CHECKLIST_ITEMS].sort((a, b) => (a.step ?? 99) - (b.step ?? 99));
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-muted text-left">
            <th className="py-2 pr-3">STEP</th>
            <th className="py-2 pr-3">항목</th>
            <th className="py-2 pr-3">설명</th>
            <th className="py-2 pr-3">상태</th>
            <th className="py-2 pr-3">메모</th>
            <th className="py-2 pr-3">갱신</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((def) => (
            <ChecklistItemRow
              key={def.key}
              def={def}
              state={checklist[def.key]}
              pending={pendingKey === def.key}
              clientId={clientId}
              record={record}
              onUpdate={(payload) => onUpdate(def.key, payload)}
              onDropboxUpdate={def.key === 'dropboxFolder' ? onDropboxStateUpdate : undefined}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
