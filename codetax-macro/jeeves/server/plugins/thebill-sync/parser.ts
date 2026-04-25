import * as XLSX from 'xlsx';

export interface ThebillRow {
  bizNo: string;
  memberName: string;
  representative: string;
  amount: number;
  status: string;
  drawDate: string;
}

export type StatusClass = 'success' | 'failure' | 'unknown';

const HEADER_CANDIDATES = {
  bizNo: ['사업자번호', '주민(사업자)번호', '주민번호', '식별번호'],
  memberName: ['회원명', '고객명', '업체명'],
  representative: ['대표자', '대표자명'],
  amount: ['금액', '청구금액', '출금액', '납부금액'],
  status: ['상태', '결과', '처리상태'],
  drawDate: ['출금일', '처리일', '결제일'],
};

function pickField(
  row: Record<string, unknown>,
  candidates: string[],
): unknown {
  for (const key of candidates) {
    if (key in row) return row[key];
  }
  return undefined;
}

export function normalizeBizNo(raw: string | number): string {
  return String(raw ?? '').replace(/[\s-]/g, '');
}

export function classifyStatus(raw: string): StatusClass {
  const s = (raw ?? '').trim();
  if (s.includes('성공') || s.includes('정상')) return 'success';
  // 더빌 status 패턴: "출금실패 ...", "미납", "출금불능" 모두 재출금 대상.
  if (s.includes('실패') || s.includes('미납') || s.includes('출금불능')) return 'failure';
  return 'unknown';
}

export function parse(xlsxPath: string): ThebillRow[] {
  const wb = XLSX.readFile(xlsxPath);
  const firstSheet = wb.SheetNames[0];
  if (!firstSheet) return [];
  const sheet = wb.Sheets[firstSheet];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });

  return raw
    .filter((r) => Object.values(r).some((v) => v !== null && v !== ''))
    .map((r) => ({
      bizNo: normalizeBizNo(pickField(r, HEADER_CANDIDATES.bizNo) as string | number),
      memberName: String(pickField(r, HEADER_CANDIDATES.memberName) ?? ''),
      representative: String(pickField(r, HEADER_CANDIDATES.representative) ?? ''),
      amount: Number(pickField(r, HEADER_CANDIDATES.amount) ?? 0),
      status: String(pickField(r, HEADER_CANDIDATES.status) ?? ''),
      drawDate: String(pickField(r, HEADER_CANDIDATES.drawDate) ?? ''),
    }))
    .filter((r) => r.bizNo);
}
