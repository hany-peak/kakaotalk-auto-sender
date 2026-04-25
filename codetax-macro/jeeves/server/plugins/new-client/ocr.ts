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
const ADDRESS_LABEL_PATTERNS = [
  // 한글 OCR 오인식에 관대한 fuzzy 매칭. 각 글자 사이에 공백/기타문자 1~3자 허용.
  /사\s*[업엽압]\s*장\s*[소스]\s*재\s*지/,
  /본\s*점\s*[소스]\s*재\s*지/,
  /[소스]\s*재\s*지/, // 최후 수단
];

const ADDRESS_END_KEYWORDS = /(?:상\s*호|법\s*인\s*명|성\s*명|대\s*표\s*자|업\s*태|종\s*목|개\s*업\s*[년연]?\s*월?\s*일|교\s*부\s*일|주\s*민\s*번\s*호|사\s*업\s*자\s*등\s*록\s*번\s*호|법\s*인\s*등\s*록\s*번\s*호|본\s*점\s*[소스]\s*재\s*지)/;

// 도/광역시/특별시/특별자치시 등으로 시작하는 주소 — fallback 탐색용.
const ADDRESS_STARTERS =
  /(?:서울특별시|부산광역시|대구광역시|인천광역시|광주광역시|대전광역시|울산광역시|세종특별자치시|경기도|강원[특별자치]*도|충청북도|충청남도|전라북도|전라남도|경상북도|경상남도|제주특별자치도|서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)/;

/**
 * 라벨 뒤의 주소 후보 문자열을 추출. 종결 키워드(상호/업태 등) 이전까지.
 */
function extractAfterLabel(text: string, label: RegExp): string | null {
  const labelMatch = text.match(label);
  if (!labelMatch || labelMatch.index === undefined) return null;
  const after = text.slice(labelMatch.index + labelMatch[0].length);
  // 콜론 있으면 건너뛰기
  const withoutColon = after.replace(/^\s*[:：]\s*/, '');
  // 종결 키워드 이전까지
  const endMatch = withoutColon.match(ADDRESS_END_KEYWORDS);
  const rawAddress = endMatch && endMatch.index !== undefined
    ? withoutColon.slice(0, endMatch.index)
    : withoutColon;
  const cleaned = rawAddress.trim();
  return cleaned.length >= 4 ? cleaned : null;
}

/**
 * 사업자등록증 OCR 텍스트에서 "사업장 소재지" 주소를 추출한다.
 * 여러 휴리스틱을 순서대로 시도:
 *  1) 같은 줄: "사업장 소재지 : <주소> 상호 ..."
 *  2) 다음 줄이 주소: "사업장 소재지\n<주소>"
 *  3) OCR이 라벨을 못 맞춘 경우 — 도/시로 시작하는 줄을 주소로 추정
 * 실패 시 null.
 */
export function parseBizAddress(ocrText: string): string | null {
  const lines = ocrText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  for (const label of ADDRESS_LABEL_PATTERNS) {
    // 각 줄을 먼저 본다 — 같은 줄에 라벨+주소
    for (let i = 0; i < lines.length; i++) {
      if (!label.test(lines[i])) continue;

      const sameLine = extractAfterLabel(lines[i], label);
      if (sameLine) return cleanAddress(sameLine);

      // 다음 줄이 주소
      if (i + 1 < lines.length) {
        const next = lines[i + 1];
        // 다음 줄이 다른 라벨이 아니라면 주소로 간주
        const looksLikeLabel = /^[가-힣\s]{1,10}\s*[:：]/.test(next);
        if (!looksLikeLabel && next.length >= 4) {
          return cleanAddress(next);
        }
      }
    }
  }

  // Fallback: 도/시로 시작하는 줄 — 사업자등록증에서 보통 사업장주소.
  for (const line of lines) {
    const stripped = line
      .replace(/^[^가-힣]*(?:사\s*[업엽]\s*장\s*[소스]?\s*재?\s*지|본\s*점\s*[소스]?\s*재?\s*지)\s*[:：]?\s*/, '')
      .trim();
    if (ADDRESS_STARTERS.test(stripped) && stripped.length >= 6) {
      return cleanAddress(stripped);
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
