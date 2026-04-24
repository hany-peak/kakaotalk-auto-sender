import { useState } from 'react';
import { useApi } from '../../../core/hooks/useApi';
import { useAuxInputs } from '../hooks/useAuxInputs';
import type { NewClientRecord } from '../types';

interface Props {
  record: NewClientRecord;
  onRecordRefresh: (record: NewClientRecord) => void;
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';
type AuxFieldKey = 'openDate' | 'bankName' | 'accountNumber' | 'bizAddress';

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
      bizAddress: record.bizAddress,
    },
    onRecordRefresh,
  );

  const field = (
    label: string,
    key: AuxFieldKey,
    type: 'date' | 'text',
    widthClass = '',
  ) => (
    <div className={`flex flex-col gap-0.5 ${widthClass}`}>
      <label className="text-[11px] text-muted">{label}</label>
      <div className="flex items-center gap-1.5">
        <input
          type={type}
          value={values[key]}
          onChange={(e) => setField(key, e.target.value)}
          onBlur={() => commitField(key)}
          className="px-2 py-1 rounded border border-border bg-surface text-xs text-white [color-scheme:dark] w-full"
        />
        <span className={`text-[10px] whitespace-nowrap ${status[key] === 'error' ? 'text-danger' : 'text-muted'}`}>
          {statusLabel(status[key])}
        </span>
      </div>
    </div>
  );

  return (
    <div className="rounded border border-border bg-surface2/40 p-3 mb-3">
      <div className="text-xs text-muted mb-2">거래처 보조 정보 (계약서/문서 생성용)</div>
      <div className="flex gap-4 flex-wrap mb-2">
        {field('개업 연월일', 'openDate', 'date')}
        {field('은행명', 'bankName', 'text')}
        {field('계좌번호', 'accountNumber', 'text')}
      </div>
      <div className="flex items-end gap-2">
        <div className="flex-1 min-w-0">
          {field('사업장 소재지', 'bizAddress', 'text', 'w-full')}
        </div>
        <OcrFromDropboxButton record={record} onRecordRefresh={onRecordRefresh} />
      </div>
    </div>
  );
}

function OcrFromDropboxButton({ record, onRecordRefresh }: Props) {
  const { post } = useApi();
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'info' | 'error'; text: string } | null>(null);

  async function onClick() {
    setPending(true);
    setMsg(null);
    try {
      const res = await post<{ address: string; file: string; wrote: boolean; record: NewClientRecord }>(
        `/new-client/${record.id}/ocr-bizaddress`,
      );
      onRecordRefresh(res.record);
      setMsg({
        kind: 'info',
        text: res.wrote
          ? `✓ ${res.file} 에서 추출 → Airtable 저장`
          : `✓ ${res.file} 에서 추출 (Airtable 값 유지)`,
      });
    } catch (e: any) {
      setMsg({ kind: 'error', text: e.message ?? '실패' });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-0.5">
      <button
        type="button"
        disabled={pending}
        onClick={onClick}
        className="px-2 py-1 rounded text-[11px] border border-border hover:bg-surface2 disabled:opacity-50 whitespace-nowrap"
      >
        {pending ? '추출 중…' : '드롭박스 사업자등록증에서 읽기'}
      </button>
      {msg && (
        <span className={`text-[10px] ${msg.kind === 'error' ? 'text-danger' : 'text-muted'}`}>
          {msg.text}
        </span>
      )}
    </div>
  );
}
