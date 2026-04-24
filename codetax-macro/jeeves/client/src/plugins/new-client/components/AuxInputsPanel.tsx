import { useAuxInputs } from '../hooks/useAuxInputs';
import type { NewClientRecord } from '../types';

interface Props {
  record: NewClientRecord;
  onRecordRefresh: (record: NewClientRecord) => void;
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';
type AuxFieldKey = 'openDate' | 'bankName' | 'accountNumber';

function statusLabel(s: SaveStatus): string {
  if (s === 'saving') return '저장 중…';
  if (s === 'saved') return '저장됨';
  if (s === 'error') return '저장 실패';
  return '';
}

export function AuxInputsPanel({ record, onRecordRefresh }: Props) {
  const { values, status, setField, commitField } = useAuxInputs(
    record.id,
    {
      openDate: record.openDate,
      bankName: record.bankName,
      accountNumber: record.accountNumber,
    },
    onRecordRefresh,
  );

  const field = (
    label: string,
    key: AuxFieldKey,
    type: 'date' | 'text',
  ) => (
    <div className="flex flex-col gap-0.5">
      <label className="text-[11px] text-muted">{label}</label>
      <div className="flex items-center gap-1.5">
        <input
          type={type}
          value={values[key]}
          onChange={(e) => setField(key, e.target.value)}
          onBlur={() => commitField(key)}
          className="px-2 py-1 rounded border border-border bg-surface text-xs text-white [color-scheme:dark]"
        />
        <span className={`text-[10px] ${status[key] === 'error' ? 'text-danger' : 'text-muted'}`}>
          {statusLabel(status[key])}
        </span>
      </div>
    </div>
  );

  return (
    <div className="rounded border border-border bg-surface2/40 p-3 mb-3">
      <div className="text-xs text-muted mb-2">거래처 보조 정보 (계약서/문서 생성용)</div>
      <div className="flex gap-4 flex-wrap">
        {field('개업 연월일', 'openDate', 'date')}
        {field('은행명', 'bankName', 'text')}
        {field('계좌번호', 'accountNumber', 'text')}
      </div>
    </div>
  );
}
