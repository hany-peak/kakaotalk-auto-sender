import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';

const TESSERACT_DEFAULT = 'tesseract';

export function resolveTesseractPath(): string {
  const env = process.env.NEW_CLIENT_TESSERACT_PATH;
  return env && env.trim() !== '' ? env : TESSERACT_DEFAULT;
}

/**
 * 입력 이미지 버퍼를 tesseract(kor+eng)로 OCR해 raw 텍스트 반환.
 * 실패/timeout 시 throw.
 */
export async function ocrImage(
  image: Buffer,
  ext: string,
  timeoutMs = 60_000,
): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'jeeves-ocr-'));
  try {
    const safeExt = /^(jpe?g|png|pdf|tiff?|bmp)$/i.test(ext) ? ext.toLowerCase() : 'bin';
    const inPath = path.join(dir, `input.${safeExt}`);
    await writeFile(inPath, image);

    const bin = resolveTesseractPath();
    return await new Promise<string>((resolve, reject) => {
      // `<out> -` → stdout 으로 결과 반환
      const proc = spawn(bin, [inPath, '-', '-l', 'kor+eng', '--psm', '6'], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let stdout = '';
      let stderr = '';
      proc.stdout.on('data', (d) => { stdout += d.toString('utf-8'); });
      proc.stderr.on('data', (d) => { stderr += d.toString('utf-8'); });
      const timer = setTimeout(() => {
        proc.kill('SIGKILL');
        reject(new Error(`tesseract timeout after ${timeoutMs}ms`));
      }, timeoutMs);
      proc.on('error', (err) => {
        clearTimeout(timer);
        reject(new Error(`tesseract spawn failed: ${err.message} (경로: ${bin})`));
      });
      proc.on('exit', (code) => {
        clearTimeout(timer);
        if (code === 0) resolve(stdout);
        else reject(new Error(`tesseract exit ${code}: ${stderr.slice(0, 500)}`));
      });
    });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/**
 * 사업자등록증 OCR 텍스트에서 "사업장 소재지" 주소를 추출한다.
 * 일반적인 포맷:
 *   사업장 소재지 : 서울특별시 강남구 ...
 *   또는
 *   사업장소재지
 *   서울특별시 강남구 ...
 * 추출 실패 시 null.
 */
export function parseBizAddress(ocrText: string): string | null {
  const normalized = ocrText.replace(/\s+/g, ' ').trim();

  // Pattern 1: "사업장 소재지 : <주소>" — 같은 줄. 다음 키워드(상호/성명/법인명 등)까지.
  const inlineMatch = normalized.match(
    /사\s*업\s*장\s*소?\s*재?\s*지\s*[:：]?\s*([^\n]{4,120}?)(?=\s+(?:상\s*호|법\s*인\s*명|성\s*명|대\s*표\s*자|업\s*태|종\s*목|개\s*업\s*년?\s*월\s*일|교\s*부\s*일|주\s*민\s*번\s*호|사\s*업\s*자\s*등\s*록\s*번\s*호|법\s*인\s*등\s*록\s*번\s*호|본\s*점\s*소\s*재\s*지)|\s*$)/,
  );
  if (inlineMatch && inlineMatch[1]) {
    return cleanAddress(inlineMatch[1]);
  }

  // Pattern 2: 줄 단위로 본다 — "사업장 소재지" 다음 줄이 주소인 케이스.
  const lines = ocrText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  for (let i = 0; i < lines.length; i++) {
    if (/사\s*업\s*장\s*소?\s*재?\s*지/.test(lines[i])) {
      // 같은 줄에 : 뒤로 내용이 있으면 그걸.
      const sameLine = lines[i].split(/[:：]/).slice(1).join(':').trim();
      if (sameLine && sameLine.length >= 4) return cleanAddress(sameLine);
      // 아니면 다음 줄.
      if (i + 1 < lines.length) return cleanAddress(lines[i + 1]);
    }
  }
  return null;
}

function cleanAddress(s: string): string {
  return s
    .replace(/[()（）\[\]【】]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
