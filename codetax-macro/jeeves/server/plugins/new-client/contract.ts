import type { NewClientRecord } from './types';

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
