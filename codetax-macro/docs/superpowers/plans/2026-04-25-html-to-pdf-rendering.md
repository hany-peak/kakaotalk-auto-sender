# HTML → PDF 계약서 렌더링 전환 — 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `new-client` 플러그인의 PDF 출력을 xlsx + soffice 변환에서 React JSX + Playwright `page.pdf()` 로 전면 교체한다.

**Architecture:** 서버 부팅 시 Playwright Chromium 1회 런치하여 모듈 스코프에 보관. 각 양식은 React JSX 컴포넌트로 작성하고 `react-dom/server` 의 `renderToStaticMarkup` 으로 HTML 직렬화 → 헤드리스 페이지에 주입 → `page.pdf()` 로 Buffer 반환. 다중 페이지 양식은 `pdf-lib` 로 병합. **xlsx 다운로드는 폐기하고 PDF 전용으로 단순화** (`fillXlsx`, `format=xlsx` 분기, 클라이언트 xlsx 버튼 모두 제거) 후 soffice 코드 일체 제거.

**Tech Stack:** TypeScript, React 18, react-dom/server, Playwright(이미 설치), pdf-lib, jszip(이미 설치), node:test.

**Spec:** `docs/superpowers/specs/2026-04-25-html-to-pdf-rendering-design.md`

---

## File Structure

**신규 디렉터리/파일** (모두 `jeeves/server/plugins/new-client/pdf/` 하위):
- `renderer.ts` — Playwright 싱글톤, `renderTemplate(component, props): Promise<Buffer>`
- `bundles.ts` — `BUNDLE_GROUPS`, `mergePdfs()`, `zipFiles()`, `sanitizeFilename()`, `assembleBundle()`
- `preview-routes.ts` — `GET /api/new-client/preview/:bundle?recordId=...` (NODE_ENV !== production)
- `templates/shared/PageFrame.tsx` — `<html><head>` + `@page` CSS 래퍼
- `templates/shared/fonts.css` — `@font-face` (HCR Batang, Pretendard)
- `templates/shared/Stamp.tsx` — `(인)` 도장 표시
- `templates/shared/SignatureBlock.tsx` — 대표자/일자/서명란 공통 블록
- `templates/CMS.tsx`
- `templates/Consent.tsx`
- `templates/EdiKb.tsx`
- `templates/EdiNhis.tsx`
- `templates/ContractCover.tsx`
- `templates/ContractMain1.tsx`
- `templates/ContractMain2.tsx`
- `fonts/HCR-Batang.ttf`, `HCR-Batang-Bold.ttf`, `Pretendard-Regular.otf`, `Pretendard-Bold.otf`, `LICENSE`
- 각 템플릿 단위 테스트: `pdf/templates/<Name>.test.ts`
- 통합 테스트: `pdf/bundles.test.ts`, `pdf/renderer.test.ts`

**수정 파일**:
- `jeeves/server/package.json` — `react`, `react-dom`, `@types/react`, `@types/react-dom`, `pdf-lib` 추가
- `jeeves/server/tsconfig.json` — `"jsx": "react-jsx"`
- `jeeves/server/index.ts` — 부팅 시 `initPdfRenderer()`, 종료 시 `closePdfRenderer()`
- `jeeves/server/plugins/new-client/routes.ts` — `contract-pdf` import 제거, `pdf/bundles` 사용, `format` 쿼리 제거 (PDF 전용), preview 라우트 등록 (dev only)
- `jeeves/server/plugins/new-client/contract.ts` — `fillXlsx` 함수 제거. `buildInputSheetValues` / `missingRequired` 만 유지 (React 템플릿 props 빌드용)
- `jeeves/client/src/plugins/new-client/components/DocumentDownloadPanel.tsx` — xlsx 다운로드 버튼 제거, PDF 버튼만 유지

**삭제**:
- `jeeves/server/plugins/new-client/contract-pdf.ts`
- `jeeves/server/plugins/new-client/contract-pdf.test.ts`

**유지(변경 없음)**:
- `jeeves/server/plugins/new-client/references/sheet.xlsx` (시각 비교 기준 자료)

---

## Conventions

**테스트**: `node:test` + `assert/strict`. 실행: `npm test --prefix jeeves/server` (모든 `*.test.ts`) 또는 `cd jeeves/server && npx tsx --test plugins/new-client/pdf/<file>.test.ts`.

**커밋 메시지 prefix**: `feat(new-client):`, `refactor(new-client):`, `test(new-client):`, `chore(new-client):` 기존 컨벤션 유지.

**경로**: 절대 경로 표기 시 항상 `jeeves/server/plugins/new-client/...`. `__dirname` 은 `tsx` 런타임에서 정상 작동.

---

## Task 1: 의존성 추가 및 JSX 활성화

**Files:**
- Modify: `jeeves/server/package.json`
- Modify: `jeeves/server/tsconfig.json`

- [ ] **Step 1: 의존성 설치**

```bash
cd jeeves/server && npm install react@18 react-dom@18 pdf-lib && npm install --save-dev @types/react@18 @types/react-dom@18
```

- [ ] **Step 2: tsconfig.json 에 JSX 옵션 추가**

`jeeves/server/tsconfig.json` 의 `compilerOptions` 에 `"jsx": "react-jsx"` 추가.

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    ...
  }
}
```

- [ ] **Step 3: 빌드 통과 확인**

Run: `cd jeeves/server && npx tsc --noEmit`
Expected: 에러 없음 (기존 .ts 들에는 JSX가 없으므로 영향 없음)

- [ ] **Step 4: 기존 테스트 통과 확인**

Run: `cd jeeves/server && npm test`
Expected: 기존 테스트 모두 통과

- [ ] **Step 5: 커밋**

```bash
git add jeeves/server/package.json jeeves/server/package-lock.json jeeves/server/tsconfig.json
git commit -m "chore(new-client): add react/react-dom/pdf-lib + enable JSX"
```

---

## Task 2: 한글 폰트 번들

**Files:**
- Create: `jeeves/server/plugins/new-client/pdf/fonts/HCR-Batang.ttf`
- Create: `jeeves/server/plugins/new-client/pdf/fonts/HCR-Batang-Bold.ttf`
- Create: `jeeves/server/plugins/new-client/pdf/fonts/Pretendard-Regular.otf`
- Create: `jeeves/server/plugins/new-client/pdf/fonts/Pretendard-Bold.otf`
- Create: `jeeves/server/plugins/new-client/pdf/fonts/LICENSE.md`

- [ ] **Step 1: 디렉터리 생성**

```bash
mkdir -p jeeves/server/plugins/new-client/pdf/fonts
```

- [ ] **Step 2: 함초롬 폰트 다운로드**

한컴 무료 배포 페이지(https://hancom.com/cs_center/csDownload.do)에서 함초롬바탕 Regular/Bold .ttf 두 개를 받아 위 경로에 저장. 파일명은 `HCR-Batang.ttf`, `HCR-Batang-Bold.ttf` 로 통일.

대안: 시스템에 이미 설치돼 있다면 (macOS 한컴 오피스 사용자) `~/Library/Fonts` 또는 `/Library/Fonts` 에서 복사.

- [ ] **Step 3: Pretendard 폰트 다운로드**

```bash
cd jeeves/server/plugins/new-client/pdf/fonts && \
  curl -L -o Pretendard-Regular.otf https://github.com/orioncactus/pretendard/raw/main/packages/pretendard/dist/public/static/Pretendard-Regular.otf && \
  curl -L -o Pretendard-Bold.otf https://github.com/orioncactus/pretendard/raw/main/packages/pretendard/dist/public/static/Pretendard-Bold.otf
```

- [ ] **Step 4: LICENSE.md 작성**

```markdown
# Bundled Fonts — Licenses

## HCR Batang (함초롬바탕)
- Source: Hancom Inc. (한컴) — free distribution per Hancom 무료 라이선스
- Use: 본문 직렬체

## Pretendard
- Source: https://github.com/orioncactus/pretendard
- License: SIL Open Font License 1.1
- Use: 맑은 고딕 대체 (산세리프)
```

- [ ] **Step 5: 파일 존재/크기 확인**

Run: `ls -la jeeves/server/plugins/new-client/pdf/fonts/`
Expected: 4개 폰트 파일이 각 100KB 이상, LICENSE.md 1개

- [ ] **Step 6: 커밋**

```bash
git add jeeves/server/plugins/new-client/pdf/fonts/
git commit -m "chore(new-client): bundle Korean fonts (HCR Batang + Pretendard)"
```

---

## Task 3: 렌더러 — Playwright 싱글톤 + 스모크 테스트

**Files:**
- Create: `jeeves/server/plugins/new-client/pdf/renderer.ts`
- Test: `jeeves/server/plugins/new-client/pdf/renderer.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

`jeeves/server/plugins/new-client/pdf/renderer.test.ts`:

```typescript
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { renderHtml, closePdfRenderer } from './renderer';

after(async () => { await closePdfRenderer(); });

test('renderHtml: 단순 HTML → PDF Buffer (PDF 헤더 검증)', async () => {
  const html = '<!doctype html><html><body><h1>안녕하세요</h1></body></html>';
  const buf = await renderHtml(html);
  assert.ok(buf.length > 1000, `PDF too small: ${buf.length}`);
  assert.equal(buf.slice(0, 4).toString(), '%PDF', 'PDF magic bytes 누락');
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `cd jeeves/server && npx tsx --test plugins/new-client/pdf/renderer.test.ts`
Expected: FAIL — `Cannot find module './renderer'`

- [ ] **Step 3: 렌더러 구현**

`jeeves/server/plugins/new-client/pdf/renderer.ts`:

```typescript
import { chromium, type Browser, type LaunchOptions } from 'playwright';
import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

let browserPromise: Promise<Browser> | null = null;

function launch(options?: LaunchOptions): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = chromium.launch({ headless: true, ...options });
  }
  return browserPromise;
}

export async function initPdfRenderer(): Promise<void> {
  await launch();
}

export async function closePdfRenderer(): Promise<void> {
  if (!browserPromise) return;
  const browser = await browserPromise;
  browserPromise = null;
  await browser.close();
}

/**
 * HTML 문서 1페이지를 PDF Buffer 로 렌더한다.
 * 페이지 크기/마진은 HTML 의 @page CSS 가 결정한다.
 */
export async function renderHtml(html: string): Promise<Buffer> {
  const browser = await launch();
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await page.setContent(html, { waitUntil: 'load' });
    await page.evaluate(async () => { await (document as any).fonts.ready; });
    const pdf = await page.pdf({ printBackground: true, preferCSSPageSize: true });
    return pdf;
  } finally {
    await context.close();
  }
}

/**
 * React 컴포넌트를 HTML 로 직렬화한 뒤 PDF 로 렌더한다.
 * 컴포넌트는 자체적으로 <html>...</html> 전체 문서를 반환해야 한다 (PageFrame 사용).
 */
export async function renderReact(element: ReactElement): Promise<Buffer> {
  const body = renderToStaticMarkup(element);
  const html = body.startsWith('<!doctype') || body.startsWith('<!DOCTYPE')
    ? body
    : `<!doctype html>${body}`;
  return renderHtml(html);
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd jeeves/server && npx tsx --test plugins/new-client/pdf/renderer.test.ts`
Expected: PASS (첫 실행 시 Chromium 다운로드 필요할 수 있음 → `npm run install:browser`)

만약 `Executable doesn't exist` 에러: `cd jeeves/server && npx playwright install chromium` 후 재실행.

- [ ] **Step 5: 커밋**

```bash
git add jeeves/server/plugins/new-client/pdf/renderer.ts jeeves/server/plugins/new-client/pdf/renderer.test.ts
git commit -m "feat(new-client): Playwright PDF renderer singleton"
```

---

## Task 4: 공통 컴포넌트 — PageFrame + 폰트 CSS

**Files:**
- Create: `jeeves/server/plugins/new-client/pdf/templates/shared/fonts.css`
- Create: `jeeves/server/plugins/new-client/pdf/templates/shared/PageFrame.tsx`
- Test: `jeeves/server/plugins/new-client/pdf/templates/shared/PageFrame.test.ts`

- [ ] **Step 1: fonts.css 작성**

`jeeves/server/plugins/new-client/pdf/templates/shared/fonts.css` — 폰트 파일을 file:// URL 로 참조 (Playwright 가 fetch 가능):

```css
@font-face {
  font-family: 'HCR Batang';
  src: url('FONT_URL_HCR_REG') format('truetype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'HCR Batang';
  src: url('FONT_URL_HCR_BOLD') format('truetype');
  font-weight: 700;
  font-style: normal;
}
@font-face {
  font-family: 'Pretendard';
  src: url('FONT_URL_PRE_REG') format('opentype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'Pretendard';
  src: url('FONT_URL_PRE_BOLD') format('opentype');
  font-weight: 700;
  font-style: normal;
}

html, body { font-family: 'HCR Batang', serif; color: #000; }
.font-sans { font-family: 'Pretendard', sans-serif; }
```

`FONT_URL_*` 는 PageFrame 이 런타임에 절대 file:// 경로로 치환한다.

- [ ] **Step 2: PageFrame.tsx 구현**

`jeeves/server/plugins/new-client/pdf/templates/shared/PageFrame.tsx`:

```typescript
import * as React from 'react';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';

const FONTS_DIR = path.join(__dirname, '..', '..', 'fonts');
const CSS_PATH = path.join(__dirname, 'fonts.css');

function fontUrl(filename: string): string {
  return `file://${path.join(FONTS_DIR, filename)}`;
}

let cachedCss: string | null = null;
function loadFontsCss(): string {
  if (cachedCss) return cachedCss;
  cachedCss = readFileSync(CSS_PATH, 'utf-8')
    .replace('FONT_URL_HCR_REG', fontUrl('HCR-Batang.ttf'))
    .replace('FONT_URL_HCR_BOLD', fontUrl('HCR-Batang-Bold.ttf'))
    .replace('FONT_URL_PRE_REG', fontUrl('Pretendard-Regular.otf'))
    .replace('FONT_URL_PRE_BOLD', fontUrl('Pretendard-Bold.otf'));
  return cachedCss;
}

export interface PageFrameProps {
  /** A4 기준 페이지 마진. 기본 15mm/12mm. */
  margin?: { top: string; right: string; bottom: string; left: string };
  /** 페이지 크기. 기본 A4. */
  size?: 'A4' | 'A3' | 'Letter';
  children: React.ReactNode;
}

const DEFAULT_MARGIN = { top: '15mm', right: '12mm', bottom: '15mm', left: '12mm' };

export function PageFrame({ margin = DEFAULT_MARGIN, size = 'A4', children }: PageFrameProps) {
  const pageCss = `@page { size: ${size}; margin: ${margin.top} ${margin.right} ${margin.bottom} ${margin.left}; }`;
  const fontsCss = loadFontsCss();
  return (
    <html lang="ko">
      <head>
        <meta charSet="utf-8" />
        <style dangerouslySetInnerHTML={{ __html: pageCss + '\n' + fontsCss }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 3: 테스트 작성**

`jeeves/server/plugins/new-client/pdf/templates/shared/PageFrame.test.ts`:

```typescript
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import * as React from 'react';
import { renderReact, closePdfRenderer } from '../../renderer';
import { PageFrame } from './PageFrame';

after(async () => { await closePdfRenderer(); });

test('PageFrame: 한글 본문이 PDF 로 렌더되고 폰트 임베드 수행', async () => {
  const buf = await renderReact(
    React.createElement(PageFrame, null, React.createElement('h1', null, '계약서 테스트 — 한글'))
  );
  assert.equal(buf.slice(0, 4).toString(), '%PDF');
  assert.ok(buf.length > 5000, `PDF unexpectedly small: ${buf.length}`);
});
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd jeeves/server && npx tsx --test plugins/new-client/pdf/templates/shared/PageFrame.test.ts`
Expected: PASS

- [ ] **Step 5: 시각 검증 (수동)**

테스트 실행 디렉토리에 임시 PDF 출력 후 직접 확인:

```bash
cd jeeves/server && npx tsx -e "
import * as React from 'react';
import { renderReact, closePdfRenderer } from './plugins/new-client/pdf/renderer';
import { PageFrame } from './plugins/new-client/pdf/templates/shared/PageFrame';
import { writeFileSync } from 'node:fs';
const main = async () => {
  const buf = await renderReact(
    React.createElement(PageFrame, null, React.createElement('h1', null, '안녕하세요 — 함초롬바탕'))
  );
  writeFileSync('/tmp/pageframe-test.pdf', buf);
  console.log('wrote /tmp/pageframe-test.pdf');
  await closePdfRenderer();
};
main();
"
open /tmp/pageframe-test.pdf
```

확인: A4 1장, 한글이 함초롬바탕(직렬체)으로 렌더, 마진 정상.

- [ ] **Step 6: 커밋**

```bash
git add jeeves/server/plugins/new-client/pdf/templates/shared/
git commit -m "feat(new-client): PageFrame component with @page CSS + Korean fonts"
```

---

## Task 5: 공통 컴포넌트 — Stamp + SignatureBlock

**Files:**
- Create: `jeeves/server/plugins/new-client/pdf/templates/shared/Stamp.tsx`
- Create: `jeeves/server/plugins/new-client/pdf/templates/shared/SignatureBlock.tsx`

- [ ] **Step 1: Stamp.tsx 구현**

`jeeves/server/plugins/new-client/pdf/templates/shared/Stamp.tsx`:

```typescript
import * as React from 'react';

/** 인감 자리: 텍스트 (인) — 인쇄 후 실제 도장 찍는 자리. */
export function Stamp({ size = '11pt' }: { size?: string }) {
  return (
    <span style={{ fontSize: size, fontWeight: 700, marginLeft: '4mm' }}>(인)</span>
  );
}
```

- [ ] **Step 2: SignatureBlock.tsx 구현**

`jeeves/server/plugins/new-client/pdf/templates/shared/SignatureBlock.tsx`:

```typescript
import * as React from 'react';
import { Stamp } from './Stamp';

export interface SignatureBlockProps {
  /** 표시 라벨 (예: '갑', '을', '계약자'). */
  role: string;
  /** 회사명 또는 개인 성명. */
  name: string;
  /** 사업자등록번호 (개인은 주민번호 등 가능). null/undefined 면 행 자체 생략. */
  regNo?: string;
  /** 주소. */
  address?: string;
  /** 대표자 성명. 표시 안 할 거면 omit. */
  representative?: string;
  /** 서명일자. ISO yyyy-mm-dd 또는 표시 그대로의 문자열. null 이면 표시 안 함. */
  date?: string;
}

const cellLabelStyle: React.CSSProperties = {
  width: '22mm', verticalAlign: 'top', padding: '1mm 2mm', fontWeight: 700,
};
const cellValueStyle: React.CSSProperties = { padding: '1mm 2mm', verticalAlign: 'top' };

export function SignatureBlock(props: SignatureBlockProps) {
  return (
    <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '10.5pt', marginTop: '4mm' }}>
      <tbody>
        <tr>
          <td style={cellLabelStyle}>{props.role}</td>
          <td style={cellValueStyle}>
            {props.name}
            {props.representative ? ` / 대표자 ${props.representative}` : ''}
            <Stamp />
          </td>
        </tr>
        {props.regNo && (
          <tr>
            <td style={cellLabelStyle}>사업자번호</td>
            <td style={cellValueStyle}>{props.regNo}</td>
          </tr>
        )}
        {props.address && (
          <tr>
            <td style={cellLabelStyle}>주소</td>
            <td style={cellValueStyle}>{props.address}</td>
          </tr>
        )}
        {props.date && (
          <tr>
            <td style={cellLabelStyle}>일자</td>
            <td style={cellValueStyle}>{props.date}</td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 3: 컴파일 확인 (이 시점엔 단독 테스트 없음 — 템플릿이 호출할 것)**

Run: `cd jeeves/server && npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 4: 커밋**

```bash
git add jeeves/server/plugins/new-client/pdf/templates/shared/Stamp.tsx \
        jeeves/server/plugins/new-client/pdf/templates/shared/SignatureBlock.tsx
git commit -m "feat(new-client): Stamp + SignatureBlock shared components"
```

---

## Task 6 (반복 프로토콜): 양식 1장 포팅 — CMS

각 양식 포팅은 동일 프로토콜을 따른다. CMS 가 가장 단순하므로 첫 양식이자 프로토콜 사례로 상세 기술. Task 7~12 는 동일 프로토콜을 따르며 입력 props 와 시각 참조만 다르다.

**Files:**
- Create: `jeeves/server/plugins/new-client/pdf/templates/CMS.tsx`
- Test: `jeeves/server/plugins/new-client/pdf/templates/CMS.test.ts`

**시각 참조 (필수)**: 작업 시작 전 기존 엔진으로 CMS 양식 PDF 한 장을 떠놓고 옆에 띄워 비교한다.

- [ ] **Step 1: 시각 참조 PDF 추출**

이미 데이터가 있는 임의의 거래처 1건으로 기존 엔진 PDF 출력:

```bash
# 서버가 떠 있어야 함. 없으면 npm run dev --prefix jeeves/server
RECORD_ID="rec..."  # Airtable record id, 클라이언트에서 확인
curl -o /tmp/old-cms.pdf "http://localhost:3001/api/new-client/$RECORD_ID/contract-download?format=pdf&group=cms"
open /tmp/old-cms.pdf
```

기존 출력의 페이지 마진 (mm), 본문 폰트 사이즈, 표 컬럼 너비, 셀 정렬을 메모한다.

- [ ] **Step 2: 입력 데이터 형태 확인**

`buildInputSheetValues` 결과(`InputSheetValues`) + `NewClientRecord` 가 템플릿 입력. CMS 양식이 사용하는 필드만 추려서 props 인터페이스 작성.

CMS 양식의 데이터 의존: 회사명, 사업자번호, 대표자, 은행명, 계좌번호, 일자.

- [ ] **Step 3: 실패 테스트 작성**

`jeeves/server/plugins/new-client/pdf/templates/CMS.test.ts`:

```typescript
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import * as React from 'react';
import { renderReact, closePdfRenderer } from '../renderer';
import { CMS, type CmsProps } from './CMS';

after(async () => { await closePdfRenderer(); });

const sample: CmsProps = {
  companyName: '주식회사 코드택스',
  bizRegNumber: '1234567890',
  representative: '홍길동',
  bankName: '국민은행',
  accountNumber: '123-45-678901',
  date: '2026-04-25',
};

test('CMS: 샘플 데이터로 PDF 1장 렌더', async () => {
  const buf = await renderReact(React.createElement(CMS, sample));
  assert.equal(buf.slice(0, 4).toString(), '%PDF');
  assert.ok(buf.length > 3000);
});
```

- [ ] **Step 4: 테스트가 실패하는지 확인**

Run: `cd jeeves/server && npx tsx --test plugins/new-client/pdf/templates/CMS.test.ts`
Expected: FAIL — `Cannot find module './CMS'`

- [ ] **Step 5: 템플릿 구현 (1차 — 구조만)**

`jeeves/server/plugins/new-client/pdf/templates/CMS.tsx`:

```typescript
import * as React from 'react';
import { PageFrame } from './shared/PageFrame';
import { SignatureBlock } from './shared/SignatureBlock';

export interface CmsProps {
  companyName: string;
  bizRegNumber: string;
  representative: string;
  bankName: string;
  accountNumber: string;
  /** 표시용 일자 (예: '2026년 04월 25일' 또는 ISO). */
  date: string;
}

export function CMS(props: CmsProps) {
  return (
    <PageFrame margin={{ top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' }}>
      <h1 style={{ textAlign: 'center', fontSize: '18pt', marginBottom: '8mm' }}>
        CMS 출금이체 동의서
      </h1>
      <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '11pt' }}>
        <tbody>
          <tr>
            <td style={cellLabel}>회사명</td><td style={cellValue}>{props.companyName}</td>
            <td style={cellLabel}>사업자번호</td><td style={cellValue}>{props.bizRegNumber}</td>
          </tr>
          <tr>
            <td style={cellLabel}>대표자</td><td style={cellValue}>{props.representative}</td>
            <td style={cellLabel}>일자</td><td style={cellValue}>{props.date}</td>
          </tr>
          <tr>
            <td style={cellLabel}>은행</td><td style={cellValue}>{props.bankName}</td>
            <td style={cellLabel}>계좌번호</td><td style={cellValue}>{props.accountNumber}</td>
          </tr>
        </tbody>
      </table>
      <p style={{ marginTop: '8mm', fontSize: '11pt', lineHeight: 1.7 }}>
        본인은 위 계좌에서 매월 기장료가 자동 출금되는 것에 동의합니다.
      </p>
      <SignatureBlock role="신청인" name={props.companyName} representative={props.representative} date={props.date} />
    </PageFrame>
  );
}

const cellLabel: React.CSSProperties = {
  border: '1px solid #000', padding: '2mm 3mm', backgroundColor: '#f0f0f0', width: '20%', fontWeight: 700,
};
const cellValue: React.CSSProperties = { border: '1px solid #000', padding: '2mm 3mm', width: '30%' };
```

- [ ] **Step 6: 테스트 통과 확인**

Run: `cd jeeves/server && npx tsx --test plugins/new-client/pdf/templates/CMS.test.ts`
Expected: PASS

- [ ] **Step 7: 시각 비교 + 미세조정**

```bash
cd jeeves/server && npx tsx -e "
import * as React from 'react';
import { renderReact, closePdfRenderer } from './plugins/new-client/pdf/renderer';
import { CMS } from './plugins/new-client/pdf/templates/CMS';
import { writeFileSync } from 'node:fs';
const main = async () => {
  const buf = await renderReact(React.createElement(CMS, {
    companyName: '주식회사 코드택스', bizRegNumber: '1234567890',
    representative: '홍길동', bankName: '국민은행', accountNumber: '123-45-678901',
    date: '2026년 04월 25일',
  }));
  writeFileSync('/tmp/new-cms.pdf', buf);
  await closePdfRenderer();
};
main();
"
open /tmp/old-cms.pdf /tmp/new-cms.pdf
```

옆에 띄워 비교 후 차이 항목 (폰트 크기, 마진, 표 너비, 행 간격, 문구) 수정. 실제 양식 문구가 위 샘플과 다르면 정확한 문구로 교체. 시각적으로 만족할 때까지 컴포넌트 수정 → 재실행 반복.

- [ ] **Step 8: 커밋**

```bash
git add jeeves/server/plugins/new-client/pdf/templates/CMS.tsx \
        jeeves/server/plugins/new-client/pdf/templates/CMS.test.ts
git commit -m "feat(new-client): CMS PDF template (HTML)"
```

---

## Task 7: 수임동의 (Consent) 양식 포팅

**Files:**
- Create: `jeeves/server/plugins/new-client/pdf/templates/Consent.tsx`
- Test: `jeeves/server/plugins/new-client/pdf/templates/Consent.test.ts`

수임동의 양식 = 세무대리인 수임 동의서. 공통 데이터 + 세무대리인(코드택스) 명의 + 위임자(거래처).

- [ ] **Step 1: 시각 참조 PDF**

```bash
RECORD_ID="rec..."
curl -o /tmp/old-consent.pdf "http://localhost:3001/api/new-client/$RECORD_ID/contract-download?format=pdf&group=consent"
open /tmp/old-consent.pdf
```

마진/폰트/표 구조 메모.

- [ ] **Step 2: props 정의 및 실패 테스트**

`Consent.test.ts`:

```typescript
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import * as React from 'react';
import { renderReact, closePdfRenderer } from '../renderer';
import { Consent, type ConsentProps } from './Consent';

after(async () => { await closePdfRenderer(); });

const sample: ConsentProps = {
  companyName: '주식회사 코드택스',
  bizRegNumber: '1234567890',
  representative: '홍길동',
  representativeRrn: '8001011234567',
  bizAddress: '서울시 강남구 테헤란로 1',
  date: '2026년 04월 25일',
};

test('Consent: 샘플 데이터로 PDF 렌더', async () => {
  const buf = await renderReact(React.createElement(Consent, sample));
  assert.equal(buf.slice(0, 4).toString(), '%PDF');
  assert.ok(buf.length > 3000);
});
```

Run: `cd jeeves/server && npx tsx --test plugins/new-client/pdf/templates/Consent.test.ts`
Expected: FAIL

- [ ] **Step 3: 템플릿 구현**

`Consent.tsx` 골격 (실제 문구는 `/tmp/old-consent.pdf` 와 일치하도록 교체):

```typescript
import * as React from 'react';
import { PageFrame } from './shared/PageFrame';
import { SignatureBlock } from './shared/SignatureBlock';

export interface ConsentProps {
  companyName: string;
  bizRegNumber: string;
  representative: string;
  representativeRrn: string;
  bizAddress: string;
  date: string;
}

export function Consent(props: ConsentProps) {
  return (
    <PageFrame margin={{ top: '20mm', right: '20mm', bottom: '20mm', left: '20mm' }}>
      <h1 style={{ textAlign: 'center', fontSize: '18pt', marginBottom: '8mm' }}>
        세무대리 수임 동의서
      </h1>
      <p style={{ fontSize: '11pt', lineHeight: 1.8, marginBottom: '6mm' }}>
        본인은 아래 세무대리인에게 본인 사업의 세무대리 업무 일체를 위임함에 동의합니다.
      </p>
      <SignatureBlock
        role="위임자"
        name={props.companyName}
        regNo={props.bizRegNumber}
        address={props.bizAddress}
        representative={props.representative}
        date={props.date}
      />
      <SignatureBlock
        role="세무대리인"
        name="코드택스 세무회계"
        regNo="000-00-00000"
        address="서울시 ..."
      />
    </PageFrame>
  );
}
```

세무대리인 정보(코드택스)는 `/tmp/old-consent.pdf` 의 내용을 보고 정확히 채울 것. 하드코딩으로 두되, 향후 분리 필요 시 별도 상수로.

- [ ] **Step 4: 테스트 통과 + 시각 비교 + 미세조정**

Task 6 의 Step 6~7 과 동일한 방식으로 `/tmp/new-consent.pdf` 출력 → `/tmp/old-consent.pdf` 와 옆 비교 → 일치할 때까지 수정.

- [ ] **Step 5: 커밋**

```bash
git add jeeves/server/plugins/new-client/pdf/templates/Consent.tsx \
        jeeves/server/plugins/new-client/pdf/templates/Consent.test.ts
git commit -m "feat(new-client): Consent (수임동의) PDF template"
```

---

## Task 8: 국민 EDI (EdiKb) 양식 포팅

**Files:**
- Create: `jeeves/server/plugins/new-client/pdf/templates/EdiKb.tsx`
- Test: `jeeves/server/plugins/new-client/pdf/templates/EdiKb.test.ts`

국민건강보험 EDI 신청서. Task 7 과 동일 프로토콜. 시트명: `국민 EDI`.

- [ ] **Step 1: 시각 참조 PDF**

```bash
RECORD_ID="rec..."
curl -o /tmp/old-edi.pdf "http://localhost:3001/api/new-client/$RECORD_ID/contract-download?format=pdf&group=edi"
open /tmp/old-edi.pdf
```

(EDI 그룹은 국민+건강 두 페이지로 떠지므로 1페이지 = 국민, 2페이지 = 건강.)

- [ ] **Step 2: props + 실패 테스트**

`EdiKb.test.ts`:

```typescript
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import * as React from 'react';
import { renderReact, closePdfRenderer } from '../renderer';
import { EdiKb, type EdiKbProps } from './EdiKb';

after(async () => { await closePdfRenderer(); });

const sample: EdiKbProps = {
  companyName: '주식회사 코드택스',
  bizRegNumber: '1234567890',
  representative: '홍길동',
  bizPhone: '02-1234-5678',
  bizAddress: '서울시 강남구 테헤란로 1',
  date: '2026년 04월 25일',
};

test('EdiKb: 샘플 데이터로 PDF 렌더', async () => {
  const buf = await renderReact(React.createElement(EdiKb, sample));
  assert.equal(buf.slice(0, 4).toString(), '%PDF');
  assert.ok(buf.length > 3000);
});
```

Expected: FAIL → 구현 후 PASS.

- [ ] **Step 3: 템플릿 구현**

`/tmp/old-edi.pdf` 1페이지(국민)를 보고 표/문구 그대로 재현. props 는 `EdiKbProps` 인터페이스로 강제.

- [ ] **Step 4: 시각 비교 + 미세조정 + 커밋**

```bash
git add jeeves/server/plugins/new-client/pdf/templates/EdiKb.tsx \
        jeeves/server/plugins/new-client/pdf/templates/EdiKb.test.ts
git commit -m "feat(new-client): 국민 EDI PDF template"
```

---

## Task 9: 건강 EDI (EdiNhis) 양식 포팅

**Files:**
- Create: `jeeves/server/plugins/new-client/pdf/templates/EdiNhis.tsx`
- Test: `jeeves/server/plugins/new-client/pdf/templates/EdiNhis.test.ts`

건강보험 EDI 신청서. `/tmp/old-edi.pdf` 의 2페이지 참조. Task 8 과 동일 프로토콜.

- [ ] **Step 1: props 정의 및 실패 테스트**

`EdiNhis.test.ts` — `EdiKb.test.ts` 와 동일한 sample 구조 + `EdiNhis` 호출. 인터페이스명 `EdiNhisProps`.

- [ ] **Step 2: 템플릿 구현**

`/tmp/old-edi.pdf` 2페이지 그대로 재현. props 인터페이스: 국민 EDI 와 동일 필드라면 인터페이스 공통화 검토 (`pdf/templates/shared/EdiCommon.ts` 에 `EdiCommonProps` 정의 후 둘 다 사용).

- [ ] **Step 3: 시각 비교 + 커밋**

```bash
git add jeeves/server/plugins/new-client/pdf/templates/EdiNhis.tsx \
        jeeves/server/plugins/new-client/pdf/templates/EdiNhis.test.ts \
        jeeves/server/plugins/new-client/pdf/templates/shared/EdiCommon.ts  # 분리했다면
git commit -m "feat(new-client): 건강 EDI PDF template"
```

---

## Task 10: 기장계약서 표지 (ContractCover) 양식 포팅

**Files:**
- Create: `jeeves/server/plugins/new-client/pdf/templates/ContractCover.tsx`
- Test: `jeeves/server/plugins/new-client/pdf/templates/ContractCover.test.ts`

기장 계약서 묶음의 첫 페이지. 보통 큰 제목 + 위임자/대리인 표.

- [ ] **Step 1: 시각 참조**

```bash
RECORD_ID="rec..."
curl -o /tmp/old-contract.pdf "http://localhost:3001/api/new-client/$RECORD_ID/contract-download?format=pdf&group=contract"
open /tmp/old-contract.pdf
```

(이 그룹은 표지+1+2 합쳐서 3페이지로 출력. 1페이지가 표지에 해당.)

- [ ] **Step 2~4: props/테스트/구현/시각비교/커밋**

Task 6~9 와 동일 프로토콜. `ContractCoverProps` 정의 → 실패 테스트 → 구현 → `/tmp/new-contract-cover.pdf` 출력 → `/tmp/old-contract.pdf` 1페이지와 비교 → 미세조정.

```bash
git add jeeves/server/plugins/new-client/pdf/templates/ContractCover.tsx \
        jeeves/server/plugins/new-client/pdf/templates/ContractCover.test.ts
git commit -m "feat(new-client): 기장계약서 표지 PDF template"
```

---

## Task 11: 기장계약서 1 (ContractMain1) 양식 포팅

**Files:**
- Create: `jeeves/server/plugins/new-client/pdf/templates/ContractMain1.tsx`
- Test: `jeeves/server/plugins/new-client/pdf/templates/ContractMain1.test.ts`

기장 계약서 본문 1쪽. 보통 계약 조항 (제 1 조 ~ 제 N 조) 절반.

- [ ] **Step 1~4: 동일 프로토콜**

`/tmp/old-contract.pdf` 2페이지 참조. 본문 조항 텍스트는 양이 많으므로 `ContractMain1.tsx` 에 string array 로 포함 후 `.map()` 렌더 권장.

```bash
git add jeeves/server/plugins/new-client/pdf/templates/ContractMain1.tsx \
        jeeves/server/plugins/new-client/pdf/templates/ContractMain1.test.ts
git commit -m "feat(new-client): 기장계약서 1 PDF template"
```

---

## Task 12: 기장계약서 2 (ContractMain2) 양식 포팅

**Files:**
- Create: `jeeves/server/plugins/new-client/pdf/templates/ContractMain2.tsx`
- Test: `jeeves/server/plugins/new-client/pdf/templates/ContractMain2.test.ts`

기장 계약서 본문 2쪽. 후반부 조항 + 양 당사자 서명 블록.

- [ ] **Step 1~4: 동일 프로토콜**

`/tmp/old-contract.pdf` 3페이지 참조. 마지막 페이지에는 위임자/대리인 양쪽 `SignatureBlock` 사용.

```bash
git add jeeves/server/plugins/new-client/pdf/templates/ContractMain2.tsx \
        jeeves/server/plugins/new-client/pdf/templates/ContractMain2.test.ts
git commit -m "feat(new-client): 기장계약서 2 PDF template"
```

---

## Task 13: bundles.ts — 번들 정의 + PDF 병합 + zip

**Files:**
- Create: `jeeves/server/plugins/new-client/pdf/bundles.ts`
- Test: `jeeves/server/plugins/new-client/pdf/bundles.test.ts`

`BUNDLE_GROUPS` 를 시트명 배열에서 컴포넌트 배열로 재정의. `pdf-lib` 로 다중 페이지 병합. 기존 `zipFiles`, `sanitizeFilename` 동봉.

- [ ] **Step 1: 실패 테스트 작성**

`jeeves/server/plugins/new-client/pdf/bundles.test.ts`:

```typescript
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { BUNDLE_GROUPS, sanitizeFilename, mergePdfs, assembleBundle, zipFiles } from './bundles';
import { closePdfRenderer } from './renderer';
import type { NewClientRecord } from '../types';

after(async () => { await closePdfRenderer(); });

test('BUNDLE_GROUPS: 4개 묶음 (contract/cms/consent/edi)', () => {
  assert.equal(BUNDLE_GROUPS.length, 4);
  assert.deepEqual(BUNDLE_GROUPS.map((g) => g.id).sort(), ['cms', 'consent', 'contract', 'edi']);
});

test('sanitizeFilename: 공백→_, 특수문자 제거', () => {
  assert.equal(sanitizeFilename('(주) 길동/상점'), '(주)_길동상점');
});

const sampleRecord: NewClientRecord = {
  id: 'rec_test', entityType: '법인', companyName: '주식회사 코드택스',
  representative: '홍길동', bizRegNumber: '1234567890', corpRegNumber: '0987654321',
  bizPhone: '02-1234-5678', bizAddress: '서울시 강남구', bookkeepingFee: 100000,
  openDate: '2020-01-01', bankName: '국민은행', accountNumber: '123-45-678901',
  // 추가 필수 필드는 NewClientRecord 정의 따라 채울 것
} as NewClientRecord;
const sampleRrn = '8001011234567';

test('assembleBundle(cms): 단일 페이지 PDF 반환', async () => {
  const cms = BUNDLE_GROUPS.find((g) => g.id === 'cms')!;
  const buf = await assembleBundle(cms, sampleRecord, sampleRrn);
  assert.equal(buf.slice(0, 4).toString(), '%PDF');
});

test('assembleBundle(contract): 표지+본문1+본문2 병합 PDF', async () => {
  const c = BUNDLE_GROUPS.find((g) => g.id === 'contract')!;
  const buf = await assembleBundle(c, sampleRecord, sampleRrn);
  assert.equal(buf.slice(0, 4).toString(), '%PDF');
  // pdf-lib 으로 페이지 수 검증
  const { PDFDocument } = await import('pdf-lib');
  const doc = await PDFDocument.load(buf);
  assert.equal(doc.getPageCount(), 3);
});

test('zipFiles: 입력 파일이 zip 안에 모두 존재', async () => {
  const zip = await zipFiles([
    { name: 'a.pdf', data: Buffer.from('aaa') },
    { name: 'b.pdf', data: Buffer.from('bbb') },
  ]);
  // PK magic
  assert.equal(zip.slice(0, 2).toString(), 'PK');
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd jeeves/server && npx tsx --test plugins/new-client/pdf/bundles.test.ts`
Expected: FAIL — `Cannot find module './bundles'`

- [ ] **Step 3: bundles.ts 구현**

`jeeves/server/plugins/new-client/pdf/bundles.ts`:

```typescript
import * as React from 'react';
import { PDFDocument } from 'pdf-lib';
import JSZip from 'jszip';
import { renderReact } from './renderer';
import { buildInputSheetValues } from '../contract';
import type { NewClientRecord } from '../types';

import { CMS } from './templates/CMS';
import { Consent } from './templates/Consent';
import { EdiKb } from './templates/EdiKb';
import { EdiNhis } from './templates/EdiNhis';
import { ContractCover } from './templates/ContractCover';
import { ContractMain1 } from './templates/ContractMain1';
import { ContractMain2 } from './templates/ContractMain2';

export type BundleId = 'contract' | 'cms' | 'consent' | 'edi';

export interface BundleGroup {
  id: BundleId;
  filename: string;
  /** 이 번들에 포함될 템플릿 컴포넌트들. 순서대로 페이지 병합. */
  templates: Array<(props: any) => React.ReactElement>;
}

export const BUNDLE_GROUPS: BundleGroup[] = [
  { id: 'contract', filename: '기장계약서', templates: [ContractCover, ContractMain1, ContractMain2] },
  { id: 'cms', filename: 'CMS', templates: [CMS] },
  { id: 'consent', filename: '수임동의', templates: [Consent] },
  { id: 'edi', filename: 'EDI', templates: [EdiKb, EdiNhis] },
];

export function sanitizeFilename(s: string): string {
  return s.replace(/\s+/g, '_').replace(/[\/\\:*?"<>|]/g, '');
}

/**
 * 여러 PDF Buffer 를 한 PDF 로 병합한다 (페이지 단위 append).
 */
export async function mergePdfs(pdfs: Buffer[]): Promise<Buffer> {
  if (pdfs.length === 1) return pdfs[0];
  const out = await PDFDocument.create();
  for (const pdf of pdfs) {
    const src = await PDFDocument.load(pdf);
    const pages = await out.copyPages(src, src.getPageIndices());
    for (const p of pages) out.addPage(p);
  }
  return Buffer.from(await out.save());
}

/**
 * 번들에 속한 모든 템플릿을 렌더해 한 PDF 로 병합한다.
 * 각 템플릿은 동일한 buildProps 결과를 받는다.
 */
export async function assembleBundle(
  group: BundleGroup,
  record: NewClientRecord,
  rrn: string | null,
): Promise<Buffer> {
  const values = buildInputSheetValues(record, rrn);
  // 모든 템플릿이 사용할 수 있는 통합 props. 각 템플릿이 자기 필요 필드만 사용.
  const props = { ...record, ...values, rrn, date: formatDate(new Date()) };
  const pdfs = await Promise.all(
    group.templates.map((T) => renderReact(React.createElement(T, props))),
  );
  return mergePdfs(pdfs);
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}년 ${m}월 ${day}일`;
}

export async function zipFiles(files: Array<{ name: string; data: Buffer }>): Promise<Buffer> {
  const zip = new JSZip();
  for (const f of files) zip.file(f.name, f.data);
  return await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd jeeves/server && npx tsx --test plugins/new-client/pdf/bundles.test.ts`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add jeeves/server/plugins/new-client/pdf/bundles.ts \
        jeeves/server/plugins/new-client/pdf/bundles.test.ts
git commit -m "feat(new-client): bundles.ts — assemble + merge + zip"
```

---

## Task 14: routes.ts 통합 — PDF 전용으로 단순화 + soffice 제거 + fillXlsx 제거

**Files:**
- Modify: `jeeves/server/plugins/new-client/routes.ts`
- Modify: `jeeves/server/plugins/new-client/contract.ts`
- Delete: `jeeves/server/plugins/new-client/contract-pdf.ts`
- Delete: `jeeves/server/plugins/new-client/contract-pdf.test.ts`

xlsx 다운로드는 폐기 결정. `format` 쿼리 파라미터 제거하고 라우트는 PDF 만 반환.

- [ ] **Step 1: routes.ts import 정리**

`jeeves/server/plugins/new-client/routes.ts` 의 25~26 행을 다음과 같이 교체:

기존:
```typescript
import { buildInputSheetValues, missingRequired, fillXlsx } from './contract';
import { BUNDLE_GROUPS, splitForBundle, renderPdf, sanitizeFilename } from './contract-pdf';
```

신규:
```typescript
import { missingRequired } from './contract';
import { BUNDLE_GROUPS, sanitizeFilename, assembleBundle } from './pdf/bundles';
```

`routes.ts` 안의 다른 `XLSX` 참조 (있다면) 도 제거.

- [ ] **Step 2: contract-download 라우트를 PDF 전용으로 재작성**

`/api/new-client/:id/contract-download` 핸들러를 다음으로 교체. `format` 파라미터 미사용, `group` 만 받음:

```typescript
app.get('/api/new-client/:id/contract-download', async (req, res) => {
  const id = req.params.id;
  if (!isAirtableId(id)) return res.status(400).json({ error: 'invalid airtable id' });
  const groupId = typeof req.query.group === 'string' ? req.query.group : '';
  const group = BUNDLE_GROUPS.find((g) => g.id === groupId);
  if (!group) return res.status(400).json({ error: `invalid group: ${groupId}` });

  const cfg = loadConfig();
  const record = await fetchAirtableRecord(id, cfg, ctx.logError);
  if (!record) return res.status(404).json({ error: 'record not found' });
  const rrn = await fetchRepRrn(id, cfg, ctx.logError, ctx.log);

  const missing = missingRequired(record, rrn);
  if (missing.length > 0) return res.status(400).json({ missing });

  const companyTag = sanitizeFilename(record.companyName || 'client');
  const baseName = `${companyTag}_${group.filename}`;

  try {
    const pdf = await assembleBundle(group, record, rrn);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', contentDisposition(`${baseName}.pdf`));
    return res.send(pdf);
  } catch (err: any) {
    ctx.logError(`[new-client] contract-download pdf failed: ${err.message || err}`);
    const raw = String(err.message ?? err);
    return res.status(500).json({ error: 'PDF 생성 실패 — ' + raw.slice(0, 200) });
  }
});
```

- [ ] **Step 3: contract.ts 에서 fillXlsx 제거**

`jeeves/server/plugins/new-client/contract.ts` 에서:
- `fillXlsx` 함수 전체 삭제
- 파일 상단 `import * as XLSX from 'xlsx'` 제거 (다른 함수에서 안 쓰는지 확인)
- `import { readFile } from 'node:fs/promises'` 제거 (TEMPLATE_PATH 도 안 씀)
- `TEMPLATE_PATH`, `INPUT_SHEET_NAME` 상수 제거
- `buildInputSheetValues`, `missingRequired`, `InputSheetValues` 인터페이스, 헬퍼 (`stripHyphens`, `corpOrIndividualName`, `isBlank`) 는 유지

- [ ] **Step 4: contract-pdf.ts 및 테스트 삭제**

```bash
rm jeeves/server/plugins/new-client/contract-pdf.ts
rm jeeves/server/plugins/new-client/contract-pdf.test.ts
```

(`splitForBundle` 도 함께 사라짐 — xlsx 분기 폐기로 더 이상 필요 없음. `BUNDLE_GROUPS` 와 `sanitizeFilename` 은 이미 `pdf/bundles.ts` 가 가져감.)

- [ ] **Step 5: soffice 잔존 참조 0건 확인**

Run: `grep -rn "soffice\|LibreOffice\|NEW_CLIENT_SOFFICE_PATH\|fillXlsx\|splitForBundle" jeeves/server`
Expected: 결과 없음 (또는 무관한 코멘트만)

`.env.example`, `README.md` 등에 `NEW_CLIENT_SOFFICE_PATH` 가 있으면 제거.

- [ ] **Step 6: 전체 서버 테스트 통과**

Run: `cd jeeves/server && npm test`
Expected: 모든 테스트 PASS. `contract.test.ts` 가 `fillXlsx` 를 임포트하고 있다면 해당 테스트 케이스도 함께 삭제.

- [ ] **Step 7: 커밋**

```bash
git add -A jeeves/server/plugins/new-client/
git commit -m "refactor(new-client): drop xlsx download + soffice, PDF only via HTML renderer"
```

---

## Task 15: 클라이언트 — xlsx 다운로드 버튼 제거

**Files:**
- Modify: `jeeves/client/src/plugins/new-client/components/DocumentDownloadPanel.tsx`

서버 라우트가 `format` 파라미터를 더 이상 받지 않으므로 클라이언트도 PDF 만 호출하도록 정리.

- [ ] **Step 1: 현재 패널 구조 확인**

Run: `cat jeeves/client/src/plugins/new-client/components/DocumentDownloadPanel.tsx`

핵심 부분: `triggerDownload(...?format=${format}&group=${groupId}...)` 호출 및 `'xlsx' | 'pdf'` 두 버튼이 양식별로 렌더되는 구조.

- [ ] **Step 2: PDF 전용으로 단순화**

핵심 변경:
- `Format` 타입과 `format` 파라미터 제거
- `onClick` 시그니처를 `(groupId, label)` 으로 단순화
- URL 에서 `format=...&` 제거
- xlsx 버튼 JSX 삭제, PDF 버튼만 유지
- `pendingKey` 상태 키도 `groupId` 만으로 충분 (`${groupId}:${format}` → `groupId`)

수정 예시 (실제 파일 구조에 맞춰 적용):

```tsx
async function onClick(groupId: GroupId, label: string) {
  setErr(null);
  setPendingKey(groupId);
  try {
    await triggerDownload(
      `/api/new-client/${record.id}/contract-download?group=${groupId}`,
      `${label}.pdf`,
    );
  } catch (e: any) {
    setErr(e.message ?? '다운로드 실패');
  } finally {
    setPendingKey(null);
  }
}

// JSX: 양식별로 PDF 버튼 1개만
<button
  type="button"
  disabled={disabled || pendingKey !== null}
  title={title}
  onClick={() => onClick(doc.id, doc.label)}
  className="px-2 py-0.5 rounded text-[11px] border border-border hover:bg-surface2 disabled:opacity-50"
>
  PDF
</button>
```

xlsx 관련 import / 타입 / 버튼은 모두 삭제.

- [ ] **Step 3: 클라이언트 빌드 통과 확인**

Run: `cd jeeves/client && npx tsc --noEmit`
Expected: 에러 없음

(클라이언트에 단위 테스트 인프라가 없다면 빌드 통과만으로 충분.)

- [ ] **Step 4: 수동 검증 — 양식별 PDF 다운로드**

```bash
npm run dev --prefix jeeves/server  # 서버 기동 (다른 터미널)
npm run dev --prefix jeeves/client  # 클라이언트 dev (다른 터미널)
```

브라우저로 신규 거래처 화면 → DocumentDownloadPanel 에 양식별 PDF 버튼만 보이는지, 클릭 시 정상 다운로드되는지 확인.

- [ ] **Step 5: 커밋**

```bash
git add jeeves/client/src/plugins/new-client/components/DocumentDownloadPanel.tsx
git commit -m "refactor(new-client/client): drop xlsx download buttons, PDF only"
```

---

## Task 16: 미리보기 라우트 (개발용)

**Files:**
- Create: `jeeves/server/plugins/new-client/pdf/preview-routes.ts`
- Modify: `jeeves/server/plugins/new-client/routes.ts`

브라우저로 템플릿 렌더 결과를 즉시 확인하기 위한 HTML 라우트. PDF 변환 없이 원본 HTML 반환.

- [ ] **Step 1: preview-routes.ts 구현**

`jeeves/server/plugins/new-client/pdf/preview-routes.ts`:

```typescript
import type { Express } from 'express';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ServerContext } from '../../types';
import type { Config } from '../config';
import { fetchAirtableRecord, fetchRepRrn, isAirtableId } from '../airtable';
import { buildInputSheetValues } from '../contract';
import { BUNDLE_GROUPS } from './bundles';

/**
 * 개발용. NODE_ENV !== 'production' 에서만 등록한다.
 * GET /api/new-client/preview/:bundle?recordId=rec...&template=0
 *   - bundle: contract / cms / consent / edi
 *   - template: 번들 내 템플릿 인덱스 (기본 0)
 */
export function registerPreviewRoutes(app: Express, ctx: ServerContext, loadConfig: () => Config): void {
  app.get('/api/new-client/preview/:bundle', async (req, res) => {
    const groupId = req.params.bundle;
    const group = BUNDLE_GROUPS.find((g) => g.id === groupId);
    if (!group) return res.status(404).send(`unknown bundle: ${groupId}`);
    const idx = Number.parseInt(String(req.query.template ?? '0'), 10);
    const Template = group.templates[idx];
    if (!Template) return res.status(404).send(`template index out of range: ${idx}`);

    const recordId = String(req.query.recordId ?? '');
    if (!isAirtableId(recordId)) return res.status(400).send('recordId required');
    const cfg = loadConfig();
    const record = await fetchAirtableRecord(recordId, cfg, ctx.logError);
    if (!record) return res.status(404).send('record not found');
    const rrn = await fetchRepRrn(recordId, cfg, ctx.logError, ctx.log);
    const values = buildInputSheetValues(record, rrn);
    const props = { ...record, ...values, rrn, date: new Date().toLocaleDateString('ko-KR') };

    const html = renderToStaticMarkup(React.createElement(Template, props as any));
    const doc = html.startsWith('<!doctype') || html.startsWith('<!DOCTYPE') ? html : `<!doctype html>${html}`;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(doc);
  });
}
```

- [ ] **Step 2: routes.ts 에서 조건부 등록**

`registerNewClientRoutes` 함수 끝부분에 추가:

```typescript
import { registerPreviewRoutes } from './pdf/preview-routes';
// ... (함수 끝)
if (process.env.NODE_ENV !== 'production') {
  registerPreviewRoutes(app, ctx, loadConfig);
}
```

- [ ] **Step 3: 수동 검증**

`npm run dev --prefix jeeves/server` 후 브라우저에서:
```
http://localhost:3001/api/new-client/preview/cms?recordId=rec...
```
Expected: CMS 양식 HTML 그대로 표시. Cmd+P 로 미리보기 가능.

- [ ] **Step 4: 커밋**

```bash
git add jeeves/server/plugins/new-client/pdf/preview-routes.ts \
        jeeves/server/plugins/new-client/routes.ts
git commit -m "feat(new-client): preview routes for HTML templates (dev only)"
```

---

## Task 17: 서버 라이프사이클 — 부팅 시 렌더러 초기화, 종료 시 정리

**Files:**
- Modify: `jeeves/server/index.ts`

Playwright 브라우저는 첫 요청 시 lazy launch 되지만, 부팅 직후 한 번 미리 띄워두면 첫 요청 응답이 빠르다. 종료 시 명시적 close 로 좀비 프로세스 방지.

- [ ] **Step 1: index.ts 에 훅 추가**

`jeeves/server/index.ts` 의 import 섹션에 추가:
```typescript
import { initPdfRenderer, closePdfRenderer } from './plugins/new-client/pdf/renderer';
```

`app.listen(...)` 직전 또는 직후에:
```typescript
initPdfRenderer().then(
  () => log('[pdf] Playwright Chromium ready'),
  (err) => logError(`[pdf] Chromium launch failed: ${err.message}`),
);
```

`process.on('SIGTERM', ...)` 또는 종료 핸들러 추가 (없으면 신규):
```typescript
async function shutdown() {
  log('shutting down');
  await closePdfRenderer().catch((e) => logError(`pdf close failed: ${e.message}`));
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
```

- [ ] **Step 2: 서버 부팅 확인**

Run: `cd jeeves/server && npm run dev`
Expected: 콘솔에 `[pdf] Playwright Chromium ready` 출력. 에러 없이 listen.

- [ ] **Step 3: Ctrl+C 종료 확인**

Ctrl+C 후 좀비 chromium 프로세스 없음:
```bash
ps aux | grep -i chromium | grep -v grep
```
Expected: 결과 없음

- [ ] **Step 4: 커밋**

```bash
git add jeeves/server/index.ts
git commit -m "feat(server): init/close Playwright PDF renderer on lifecycle"
```

---

## Task 18: 최종 검증 — 사장님 육안 비교

**Files:** (변경 없음, 검증 단계)

- [ ] **Step 1: 실거래처 데이터 1건으로 4개 번들 생성**

```bash
RECORD_ID="rec..."  # 실제 거래처
mkdir -p /tmp/pdf-cutover-verify
for g in contract cms consent edi; do
  curl -s -o "/tmp/pdf-cutover-verify/new-$g.pdf" \
    "http://localhost:3001/api/new-client/$RECORD_ID/contract-download?format=pdf&group=$g"
done
open /tmp/pdf-cutover-verify/
```

- [ ] **Step 2: 같은 거래처에 대해 git stash 로 이전 엔진 출력 확보**

(컷오버 PR 머지 전이라면 main 브랜치로 잠시 돌아가 동일 번들 받아 별도 폴더에 저장 후 비교.)

```bash
git stash push -u -m "html-pdf-wip"
git checkout main
npm run dev --prefix jeeves/server  # 별도 터미널, 다른 포트 또는 같은 포트로 재시작
mkdir -p /tmp/pdf-cutover-verify-old
for g in contract cms consent edi; do
  curl -s -o "/tmp/pdf-cutover-verify-old/old-$g.pdf" \
    "http://localhost:3001/api/new-client/$RECORD_ID/contract-download?format=pdf&group=$g"
done
git checkout -  # 원래 브랜치
git stash pop
```

- [ ] **Step 3: 사장님 검수**

각 양식 PDF 를 사장님(또는 이해관계자)께 신/구 비교 보여드리고 OK 사인 받기. 차이 항목이 있으면 해당 템플릿 Task 로 돌아가 미세조정 → 이 단계 재실행.

- [ ] **Step 4: 머지 (사장님 OK 후)**

```bash
git checkout main
git merge --no-ff <feature-branch>
# 또는 PR 생성 후 머지
```

---

## 자체 점검 (Self-Review)

**스펙 대응**:
- [x] §1 목적 — Task 14 가 soffice 제거로 충족
- [x] §3.1 xlsx 폐기 — Task 14 (서버 fillXlsx 제거 + format 분기 제거) + Task 15 (클라이언트 버튼 제거)
- [x] §4.1 디렉터리 구조 — Task 1~5, 13~16 가 구현
- [x] §4.3(a) Playwright 싱글톤 — Task 3
- [x] §4.3(b) renderToStaticMarkup — Task 3 의 `renderReact`
- [x] §4.3(c) 한글 폰트 — Task 2 + Task 4
- [x] §4.3(d) @page CSS — Task 4 의 `PageFrame`
- [x] §4.3(e) PDF 병합 — Task 13 의 `mergePdfs` (pdf-lib)
- [x] §4.3(f) 미리보기 라우트 — Task 16
- [x] §5 신규/수정/삭제 — 각 Task 에 매핑
- [x] §6 에러 처리 — Task 14 (PDF 실패), Task 17 (런치 실패)
- [x] §7 테스트 — 각 템플릿 단위 + bundles 통합
- [x] §8 마이그레이션 순서 — Task 6~12 (CMS → Consent → EDI 2종 → 기장계약서 3종)
- [x] §9 알려진 리스크 — Task 18 시각비교 단계가 픽셀 갭 흡수 역할

**플레이스홀더 스캔**: 모든 Task 에 실제 명령/코드 포함. 양식별 본문 문구는 "기존 PDF 보고 그대로 재현" 으로 명시 — 시각 참조 PDF 가 정확한 명세 역할.

**타입 일관성**: `BundleGroup.id` ('contract'|'cms'|'consent'|'edi') 일관. `renderReact` ↔ `renderHtml` Task 3 에서 정의 → Task 4, 13, 16 에서 사용 일관.

**스코프**: 단일 PR 단일 플랜 — 7개 양식 + 인프라 + 클라이언트 정리 = 18 task. 큰 편이지만 컷오버 + xlsx 폐기 결정에 부합. 양식별 미세조정 시간이 가장 큰 변수.
