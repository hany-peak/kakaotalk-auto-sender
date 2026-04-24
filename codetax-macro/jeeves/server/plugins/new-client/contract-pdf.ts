import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, readFile, rm, access, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';

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
  // 시트를 제거하면 drawings/calcChain/defined names 참조가 깨져
  // LibreOffice 가 "source file could not be loaded" 로 거절한다.
  // 대신 이 그룹 시트 + 입력시트 외의 모든 시트를 hidden 처리 —
  // 워크북 구조는 온전히 유지하고, 렌더 시에는 visible 시트만 나간다.
  const visibleOutputs = new Set<string>(group.sheets);
  const prevWbMeta = wb.Workbook ?? {};
  const prevSheetMeta = prevWbMeta.Sheets ?? [];
  const nextSheetMeta = wb.SheetNames.map((name) => {
    const prev = prevSheetMeta.find((s) => s.name === name);
    const base = prev ? { ...prev } : { name };
    if (name === INPUT_SHEET || !visibleOutputs.has(name)) {
      return { ...base, Hidden: 1 as const };
    }
    // 명시적 Hidden=0 (Visible) — 이전 상태에 hidden 이 있었다면 덮어씀
    const { Hidden: _drop, ...rest } = base;
    return { ...rest, Hidden: 0 as const };
  });

  return {
    ...wb,
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
 * workbook을 임시 xlsx로 저장한 뒤 LibreOffice(soffice)로 PDF 변환 후 반환.
 * 실패/timeout/미설치 시 throw. soffice 출력 파일명은 macOS NFC/NFD
 * 차이로 기대 경로에 없을 수 있어 디렉토리 스캔으로 PDF를 찾는다.
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
