import { useState } from 'react';
import type { NewClientRecord } from '../types';

interface Props {
  record: NewClientRecord;
}

type GroupId = 'contract' | 'cms' | 'consent' | 'edi';

const DOCUMENTS: Array<{ id: GroupId; label: string }> = [
  { id: 'contract', label: '기장계약서' },
  { id: 'cms', label: 'CMS' },
  { id: 'consent', label: '수임동의' },
  { id: 'edi', label: 'EDI (국민·건강)' },
];

function blank(v?: string | number): boolean {
  return v === undefined || v === null || (typeof v === 'string' && v.trim() === '');
}

function clientMissing(record: NewClientRecord): string[] {
  const m: string[] = [];
  if (blank(record.representative)) m.push('대표자');
  if (blank(record.companyName)) m.push('업체명');
  if (blank(record.bizRegNumber)) m.push('사업자번호');
  if (blank(record.bizPhone)) m.push('전화번호');
  if (blank(record.bizAddress)) m.push('사업장주소');
  if (blank(record.bookkeepingFee)) m.push('기장료');
  if (blank(record.openDate)) m.push('개업일');
  if (blank(record.bankName)) m.push('은행명');
  if (blank(record.accountNumber)) m.push('계좌번호');
  if (record.entityType === '법인' && blank(record.corpRegNumber)) m.push('법인등록번호');
  return m;
}

async function triggerDownload(url: string, fallbackName: string) {
  const res = await fetch(url);
  if (!res.ok) {
    let err = '다운로드 실패';
    try {
      const j = await res.json();
      if (j?.missing) err = `누락: ${j.missing.join(', ')}`;
      else if (j?.error) err = j.error;
    } catch {
      // ignore body parse failure
    }
    throw new Error(err);
  }
  const blob = await res.blob();
  const cd = res.headers.get('Content-Disposition') || '';
  const m = cd.match(/filename="([^"]+)"/);
  const filename = m?.[1] ?? fallbackName;
  const objUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objUrl);
}

export function DocumentDownloadPanel({ record }: Props) {
  const [err, setErr] = useState<string | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const missing = clientMissing(record);
  const disabled = missing.length > 0;
  const title = disabled ? `누락: ${missing.join(', ')}` : '';

  async function onClick(groupId: GroupId, label: string) {
    setErr(null);
    setPendingKey(groupId);
    try {
      await triggerDownload(
        `/api/new-client/${record.id}/contract-download?group=${groupId}`,
        `${label}.pdf`,
      );
    } catch (e: any) {
      setErr(e.message ?? '다운로드 실패');
    } finally {
      setPendingKey(null);
    }
  }

  return (
    <div className="rounded border border-border bg-surface2/40 p-3 mb-3">
      <div className="text-xs text-muted mb-2">문서 다운로드</div>
      <table className="text-xs">
        <tbody>
          {DOCUMENTS.map((doc) => (
            <tr key={doc.id}>
              <td className="py-1 pr-3 font-medium text-white whitespace-nowrap">{doc.label}</td>
              <td className="py-1 pr-1.5">
                <button
                  type="button"
                  disabled={disabled || pendingKey !== null}
                  title={title}
                  onClick={() => onClick(doc.id, doc.label)}
                  className="px-2 py-0.5 rounded text-[11px] border border-border hover:bg-surface2 disabled:opacity-50"
                >
                  {pendingKey === doc.id ? '생성 중…' : 'PDF'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {err && <div className="mt-2 text-[10px] text-danger">{err}</div>}
      {disabled && (
        <div className="mt-2 text-[10px] text-muted">누락 항목: {missing.join(', ')}</div>
      )}
    </div>
  );
}
