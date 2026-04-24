import * as XLSX from 'xlsx';
import { Readable } from 'node:stream';
import JSZip from 'jszip';
import { google, drive_v3 } from 'googleapis';

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

let driveClientCache: drive_v3.Drive | null = null;

function getDriveClient(): drive_v3.Drive {
  if (driveClientCache) return driveClientCache;
  const raw = process.env.GOOGLE_SA_KEY;
  if (!raw || raw.trim() === '') {
    throw new Error('GOOGLE_SA_KEY 환경변수 없음 — 서비스 계정 JSON 전체를 한 줄로 넣어주세요.');
  }
  let credentials: Record<string, unknown>;
  try {
    credentials = JSON.parse(raw);
  } catch (e: any) {
    throw new Error(`GOOGLE_SA_KEY JSON 파싱 실패: ${e.message}`);
  }
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive.file'],
  });
  driveClientCache = google.drive({ version: 'v3', auth });
  return driveClientCache;
}

/**
 * workbook을 Google Drive에 Google Sheet로 업로드 → PDF export → 파일 삭제.
 * 수식 재계산/렌더링은 Google Sheets가 처리하므로 LibreOffice 불필요.
 * 실패 시 throw. 업로드 성공 후 export 실패해도 정리는 best-effort로 수행.
 */
export async function renderPdf(
  wb: XLSX.WorkBook,
  baseName: string,
): Promise<Buffer> {
  const xlsxBuf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx', cellStyles: true }) as Buffer;
  const drive = getDriveClient();

  const created = await drive.files.create({
    requestBody: {
      name: baseName,
      mimeType: 'application/vnd.google-apps.spreadsheet',
    },
    media: {
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      body: Readable.from(xlsxBuf),
    },
    fields: 'id',
  });
  const fileId = created.data.id;
  if (!fileId) throw new Error('Drive 업로드 응답에 파일 id 없음');

  try {
    const pdfRes = await drive.files.export(
      { fileId, mimeType: 'application/pdf' },
      { responseType: 'arraybuffer' },
    );
    return Buffer.from(pdfRes.data as ArrayBuffer);
  } finally {
    drive.files.delete({ fileId }).catch(() => {
      // best-effort cleanup; drive.file scope keeps blast radius minimal
    });
  }
}

export async function zipFiles(files: Array<{ name: string; data: Buffer }>): Promise<Buffer> {
  const zip = new JSZip();
  for (const f of files) zip.file(f.name, f.data);
  return await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}
