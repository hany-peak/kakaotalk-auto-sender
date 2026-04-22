import * as XLSX from 'xlsx';

export type ThebillRow = Record<string, string | number | boolean | null>;

export function parse(xlsxPath: string): ThebillRow[] {
  const wb = XLSX.readFile(xlsxPath);
  const firstSheet = wb.SheetNames[0];
  if (!firstSheet) return [];
  const sheet = wb.Sheets[firstSheet];
  const rows = XLSX.utils.sheet_to_json<ThebillRow>(sheet, { defval: null });
  return rows.filter((r) => Object.values(r).some((v) => v !== null && v !== ''));
}
