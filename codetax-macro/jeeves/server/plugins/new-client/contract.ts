import type { NewClientRecord } from './types';

export interface InputSheetValues {
  C3: string;  C4: string;  C5: string;  C6: string;
  C7: string;  C8: string;  C9: string;  C10: string;
  C11: string; C12: string; C13: number | string; C14: string;
}

function stripHyphens(s: string | undefined): string {
  return (s ?? '').replace(/-/g, '');
}

function corpOrIndividualName(r: NewClientRecord): string {
  return r.entityType === '법인' ? r.companyName : r.representative;
}

export function buildInputSheetValues(
  record: NewClientRecord,
  rrn: string | null,
): InputSheetValues {
  const nameC4 = corpOrIndividualName(record);
  return {
    C3: record.representative ?? '',
    C4: nameC4,
    C5: nameC4,
    C6: rrn ?? '',
    C7: record.companyName ?? '',
    C8: stripHyphens(record.bizRegNumber),
    C9: record.entityType === '법인' ? stripHyphens(record.corpRegNumber) : '',
    C10: record.bizPhone ?? '',
    C11: record.bankName ?? '',
    C12: record.accountNumber ?? '',
    C13: record.bookkeepingFee ?? '',
    C14: record.bizAddress ?? '',
  };
}

function isBlank(v: unknown): boolean {
  if (v === undefined || v === null) return true;
  if (typeof v === 'string' && v.trim() === '') return true;
  return false;
}

export function missingRequired(record: NewClientRecord, rrn: string | null): string[] {
  const missing: string[] = [];
  if (isBlank(record.representative)) missing.push('대표자');
  if (isBlank(record.companyName)) missing.push('업체명');
  if (isBlank(record.bizRegNumber)) missing.push('사업자번호');
  if (isBlank(record.bizPhone)) missing.push('전화번호');
  if (isBlank(record.bizAddress)) missing.push('사업장주소');
  if (isBlank(record.bookkeepingFee)) missing.push('기장료');
  if (isBlank(record.openDate)) missing.push('개업일');
  if (isBlank(record.bankName)) missing.push('은행명');
  if (isBlank(record.accountNumber)) missing.push('계좌번호');
  if (isBlank(rrn)) missing.push('대표자주민번호');
  if (record.entityType === '법인' && isBlank(record.corpRegNumber)) {
    missing.push('법인등록번호');
  }
  return missing;
}
