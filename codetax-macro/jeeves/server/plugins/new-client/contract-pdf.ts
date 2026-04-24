import * as XLSX from 'xlsx';

export interface BundleGroup {
  id: 'contract' | 'cms' | 'consent' | 'edi';
  filename: string;
  sheets: string[];
}

const INPUT_SHEET = '입력시트';

export const BUNDLE_GROUPS: BundleGroup[] = [
  { id: 'contract', filename: '기장계약서',
    sheets: ['기장계약서표지 ', '기장계약서 1 ', '기장계약서 2 '] },
  { id: 'cms', filename: 'CMS', sheets: ['CMS '] },
  { id: 'consent', filename: '수임동의', sheets: ['수임동의'] },
  { id: 'edi', filename: 'EDI', sheets: ['국민 EDI', '건강 EDI '] },
];

/**
 * 해당 그룹에 속하지 않는 시트를 제거한 workbook 복제본을 반환한다.
 * 입력시트는 수식 참조용으로 남기되 hidden 상태로 전환한다.
 */
export function splitForBundle(wb: XLSX.WorkBook, group: BundleGroup): XLSX.WorkBook {
  const keep = new Set<string>([INPUT_SHEET, ...group.sheets]);
  const nextSheetNames = wb.SheetNames.filter((n) => keep.has(n));
  const nextSheets: Record<string, XLSX.WorkSheet> = {};
  for (const n of nextSheetNames) nextSheets[n] = wb.Sheets[n];

  const prevWbMeta = wb.Workbook ?? {};
  const prevSheetMeta = prevWbMeta.Sheets ?? [];
  const nextSheetMeta = nextSheetNames.map((name) => {
    const prev = prevSheetMeta.find((s) => s.name === name);
    const base = prev ? { ...prev } : { name };
    if (name === INPUT_SHEET) return { ...base, Hidden: 1 as const };
    return base;
  });

  return {
    ...wb,
    SheetNames: nextSheetNames,
    Sheets: nextSheets,
    Workbook: { ...prevWbMeta, Sheets: nextSheetMeta },
  };
}

export function sanitizeFilename(s: string): string {
  return s.replace(/\s+/g, '_').replace(/[\/\\:*?"<>|]/g, '');
}
