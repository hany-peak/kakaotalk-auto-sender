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

interface DriveContext {
  drive: drive_v3.Drive;
  oauth2: InstanceType<typeof google.auth.OAuth2>;
}
let driveContextCache: DriveContext | null = null;

function getDriveContext(): DriveContext {
  if (driveContextCache) return driveContextCache;
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      'Google OAuth env 미설정 — GOOGLE_OAUTH_CLIENT_ID/SECRET/REFRESH_TOKEN 필요. ' +
        'scripts/reauth-google.mjs 실행으로 얻을 수 있습니다.',
    );
  }
  const oauth2 = new google.auth.OAuth2(clientId, clientSecret);
  oauth2.setCredentials({ refresh_token: refreshToken });
  const drive = google.drive({ version: 'v3', auth: oauth2 });
  driveContextCache = { drive, oauth2 };
  return driveContextCache;
}

/**
 * Google Sheets PDF export URL 파라미터. 템플릿의 레이아웃을 최대한 보존.
 * 참조: https://developers.google.com/sheets/api/samples/sheetdata (undocumented but stable)
 *   format=pdf         PDF 출력
 *   size=A4            A4 용지 (0=Letter, 1=Tabloid, 2=Legal, ..., 7=A4)
 *   portrait=true      세로
 *   fitw=true          너비 맞추기 (내용이 잘리지 않게)
 *   gridlines=false    격자 숨김
 *   printtitle=false   스프레드시트 이름 상단 출력 안 함
 *   sheetnames=false   시트 이름 출력 안 함
 *   pagenumbers=false  페이지 번호 안 찍음
 *   fzr=false          고정 행 반복 안 함
 *   top_margin/bottom_margin/left_margin/right_margin = 0.5 (인치)
 *   horizontal_alignment=CENTER  가로 가운데 정렬
 */
/**
 * 템플릿 sheet.xlsx 각 시트의 pageSetup(A4, portrait, 여백 0.25/0.75,
 * 시트별 67~97% 스케일)을 가능한 한 보존. Google Sheets export URL 이
 * 시트별 스케일까지 직접 지정하진 못하지만, fit-to-width(=자동 축소) 로
 * 넘기면 각 시트가 자기 폭에 맞춰 축소되어 원본과 거의 같아진다.
 */
function buildExportUrl(fileId: string): string {
  const params = new URLSearchParams({
    format: 'pdf',
    size: 'A4',
    portrait: 'true',
    fitw: 'true',
    gridlines: 'false',
    printtitle: 'false',
    sheetnames: 'false',
    pagenumbers: 'false',
    fzr: 'false',
    top_margin: '0.75',
    bottom_margin: '0.75',
    left_margin: '0.25',
    right_margin: '0.25',
  });
  return `https://docs.google.com/spreadsheets/d/${fileId}/export?${params}`;
}

/**
 * workbook을 Google Drive에 Google Sheet로 업로드 → PDF export → 파일 삭제.
 * Sheets export URL에 레이아웃 파라미터를 명시해 템플릿 디자인을 보존.
 */
export async function renderPdf(
  wb: XLSX.WorkBook,
  baseName: string,
): Promise<Buffer> {
  const xlsxBuf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx', cellStyles: true }) as Buffer;
  const { drive, oauth2 } = getDriveContext();

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
    const tokenResp = await oauth2.getAccessToken();
    const accessToken = tokenResp.token;
    if (!accessToken) throw new Error('access token 획득 실패');
    const res = await fetch(buildExportUrl(fileId), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Sheets export 실패 ${res.status}: ${body.slice(0, 300)}`);
    }
    const ab = await res.arrayBuffer();
    return Buffer.from(ab);
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
