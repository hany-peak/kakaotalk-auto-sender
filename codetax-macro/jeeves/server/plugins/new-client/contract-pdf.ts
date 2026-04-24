import * as XLSX from 'xlsx';
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, readFile, rm, access, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import JSZip from 'jszip';

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

const MAC_SOFFICE = '/Applications/LibreOffice.app/Contents/MacOS/soffice';

export async function resolveSofficePath(): Promise<string> {
  const env = process.env.NEW_CLIENT_SOFFICE_PATH;
  if (env && env.trim() !== '') return env;
  try {
    await access(MAC_SOFFICE);
    return MAC_SOFFICE;
  } catch {
    return 'soffice';
  }
}

/**
 * workbook을 임시 xlsx로 저장한 뒤 soffice 로 PDF 변환 → PDF Buffer 반환.
 * 실패/timeout/미설치 시 throw.
 */
export async function renderPdf(
  wb: XLSX.WorkBook,
  baseName: string,
  timeoutMs = 60_000,
): Promise<Buffer> {
  const dir = await mkdtemp(path.join(tmpdir(), 'jeeves-contract-'));
  try {
    const xlsxPath = path.join(dir, `${baseName}.xlsx`);
    const xlsxBuf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx', cellStyles: true }) as Buffer;
    await writeFile(xlsxPath, xlsxBuf);

    const sofficePath = await resolveSofficePath();

    await new Promise<void>((resolve, reject) => {
      const proc = spawn(
        sofficePath,
        ['--headless', '--convert-to', 'pdf', '--outdir', dir, xlsxPath],
        { stdio: ['ignore', 'pipe', 'pipe'] },
      );
      let stderr = '';
      proc.stderr.on('data', (d) => { stderr += d.toString(); });
      const timer = setTimeout(() => {
        proc.kill('SIGKILL');
        reject(new Error(`soffice timeout after ${timeoutMs}ms`));
      }, timeoutMs);
      proc.on('error', (err) => {
        clearTimeout(timer);
        reject(new Error(`soffice spawn failed: ${err.message} (경로: ${sofficePath})`));
      });
      proc.on('exit', (code) => {
        clearTimeout(timer);
        if (code === 0) resolve();
        else reject(new Error(`soffice exit ${code}: ${stderr.slice(0, 500)}`));
      });
    });

    // LibreOffice 출력 파일명은 입력명과 같되, macOS 정규화(NFC/NFD) 차이로
    // 우리 기대 경로에 없을 수 있다. 디렉토리에서 .pdf 를 직접 찾아 읽는다.
    const files = await readdir(dir);
    const pdfName = files.find((f) => f.toLowerCase().endsWith('.pdf'));
    if (!pdfName) {
      throw new Error(`soffice 변환 후 PDF 파일 없음. dir=${dir} files=${files.join(',')}`);
    }
    return await readFile(path.join(dir, pdfName));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export async function zipFiles(files: Array<{ name: string; data: Buffer }>): Promise<Buffer> {
  const zip = new JSZip();
  for (const f of files) zip.file(f.name, f.data);
  return await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}
