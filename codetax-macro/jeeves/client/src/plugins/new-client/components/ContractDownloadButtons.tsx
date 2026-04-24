import { useState } from 'react';
import type { NewClientRecord } from '../types';

interface Props {
  record: NewClientRecord;
}

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

export function ContractDownloadButtons({ record }: Props) {
  const [err, setErr] = useState<string | null>(null);
  const [pending, setPending] = useState<'xlsx' | 'pdf' | null>(null);
  const missing = clientMissing(record);
  const disabled = missing.length > 0;
  const title = disabled ? `누락: ${missing.join(', ')}` : '';

  async function onClick(format: 'xlsx' | 'pdf-zip') {
    setErr(null);
    setPending(format === 'xlsx' ? 'xlsx' : 'pdf');
    try {
      await triggerDownload(
        `/api/new-client/${record.id}/contract-download?format=${format}`,
        format === 'xlsx' ? '기장계약서세트.xlsx' : '기장계약서묶음.zip',
      );
    } catch (e: any) {
      setErr(e.message ?? '다운로드 실패');
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
      <button
        type="button"
        disabled={disabled || pending !== null}
        title={title}
        onClick={() => onClick('xlsx')}
        className="px-2 py-0.5 rounded text-[11px] border border-border hover:bg-surface2 disabled:opacity-50"
      >
        {pending === 'xlsx' ? '생성 중…' : '엑셀 다운로드'}
      </button>
      <button
        type="button"
        disabled={disabled || pending !== null}
        title={title}
        onClick={() => onClick('pdf-zip')}
        className="px-2 py-0.5 rounded text-[11px] border border-border hover:bg-surface2 disabled:opacity-50"
      >
        {pending === 'pdf' ? '생성 중…' : 'PDF 묶음'}
      </button>
      {err && <span className="text-[10px] text-danger">{err}</span>}
    </div>
  );
}
