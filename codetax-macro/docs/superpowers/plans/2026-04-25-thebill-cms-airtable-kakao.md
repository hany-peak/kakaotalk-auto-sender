# 더빌 CMS → 에어테이블 → 미수업체 카톡 워크플로우 구현 플랜

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Notion 스토리보드 STEP 2~4 자동화 — 더빌 CMS 출금/재출금 결과를 Airtable 수수료 테이블에 반영하고, 익월 10일 미수업체에 카톡 입금요청 발송.

**Architecture:** 기존 `thebill-sync` 플러그인을 확장해 STEP 2(출금결과)·STEP 3(재출금결과) 두 모드를 처리. STEP 4(미수 카톡)는 신규 `payment-reminder` 플러그인이 Airtable 조회 후 기존 `kakao-send` 발송 엔진을 재사용. 영업일 계산은 정적 공휴일 JSON 기반 모듈로 외부 API 의존 없음.

**Tech Stack:** TypeScript, node:test (built-in), Playwright, airtable npm, xlsx, React (client), Tailwind CSS.

**Spec:** `docs/superpowers/specs/2026-04-25-thebill-cms-airtable-kakao-design.md`

---

## File Structure

### 신규 파일
```
jeeves/server/plugins/thebill-sync/
  business-day.ts                        영업일 계산 (토·일·공휴일 제외)
  business-day.test.ts                   단위 테스트
  holidays.ts                            한국 공휴일 정적 데이터
  holidays.test.ts                       단위 테스트
  parser.test.ts                         사업자번호 정규화/상태 분류 테스트
  airtable.test.ts                       업데이트 로직 테스트 (모킹)

jeeves/server/plugins/payment-reminder/
  index.ts                               MacroPlugin 등록
  config.ts                              환경변수 로드
  airtable.ts                            대상 조회 + 상태 업데이트
  airtable.test.ts
  message.ts                             멘트 템플릿 빌더
  message.test.ts
  sender.ts                              kakao-send 발송 엔진 위임
  pipeline.ts                            preview/send 흐름
  routes.ts                              GET /preview, POST /send

jeeves/client/src/plugins/payment-reminder/
  index.ts
  PaymentReminderPage.tsx                미리보기 + 발송 화면
  components/
    TargetTable.tsx                      대상 거래처 체크박스 테이블
    MessagePreview.tsx                   완성 멘트 미리보기
```

### 수정 파일
```
jeeves/server/plugins/thebill-sync/
  config.ts                              AIRTABLE_FEE_* 환경변수 추가
  parser.ts                              ThebillRow 타입 + 정규화 export
  scraper.ts                             ScrapeOptions(mode/from/to) 받게 변경
  airtable.ts                            수수료 테이블 매칭/업데이트로 재작성
  pipeline.ts                            모드 인자 받게 변경
  index.ts                               2개 schedule 등록 (withdrawal, reWithdrawal)

jeeves/client/src/plugins/thebill-sync/
  ThebillSyncPage.tsx                    두 모드 UI 분리

jeeves/server/plugins/index.ts           paymentReminderPlugin 등록
jeeves/client/src/plugins/index.tsx      payment-reminder 라우트 등록
jeeves/server/.env.example               신규 환경변수 추가
```

---

## Phase A: 공통 인프라

### Task 1: 한국 공휴일 정적 데이터

**Files:**
- Create: `jeeves/server/plugins/thebill-sync/holidays.ts`
- Create: `jeeves/server/plugins/thebill-sync/holidays.test.ts`

- [ ] **Step 1: Write the failing test**

`jeeves/server/plugins/thebill-sync/holidays.test.ts`:
```typescript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isHoliday } from './holidays';

test('isHoliday returns true for 신정 2026-01-01', () => {
  assert.equal(isHoliday(new Date('2026-01-01')), true);
});

test('isHoliday returns true for 어린이날 2026-05-05', () => {
  assert.equal(isHoliday(new Date('2026-05-05')), true);
});

test('isHoliday returns false for 평일 2026-04-25', () => {
  assert.equal(isHoliday(new Date('2026-04-25')), false);
});

test('isHoliday handles year not in dataset by returning false', () => {
  assert.equal(isHoliday(new Date('2099-01-01')), false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd jeeves/server && npx tsx --test plugins/thebill-sync/holidays.test.ts`
Expected: FAIL with `Cannot find module './holidays'`

- [ ] **Step 3: Implement holidays.ts**

`jeeves/server/plugins/thebill-sync/holidays.ts`:
```typescript
const HOLIDAY_DATES: Record<number, string[]> = {
  2026: [
    '2026-01-01', // 신정
    '2026-02-16', '2026-02-17', '2026-02-18', // 설날 연휴
    '2026-03-01', // 삼일절
    '2026-05-05', // 어린이날
    '2026-05-24', // 부처님오신날
    '2026-06-06', // 현충일
    '2026-08-15', // 광복절
    '2026-09-24', '2026-09-25', '2026-09-26', // 추석 연휴
    '2026-10-03', // 개천절
    '2026-10-09', // 한글날
    '2026-12-25', // 크리스마스
  ],
  2027: [
    '2027-01-01',
    '2027-02-06', '2027-02-07', '2027-02-08',
    '2027-03-01',
    '2027-05-05',
    '2027-05-13',
    '2027-06-06',
    '2027-08-15',
    '2027-09-14', '2027-09-15', '2027-09-16',
    '2027-10-03',
    '2027-10-09',
    '2027-12-25',
  ],
};

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function isHoliday(d: Date): boolean {
  const list = HOLIDAY_DATES[d.getFullYear()];
  if (!list) return false;
  return list.includes(toIsoDate(d));
}

export const SUPPORTED_HOLIDAY_YEARS = Object.keys(HOLIDAY_DATES).map(Number);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd jeeves/server && npx tsx --test plugins/thebill-sync/holidays.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
cd /Users/hany/workzone/codetax-macro && git add jeeves/server/plugins/thebill-sync/holidays.ts jeeves/server/plugins/thebill-sync/holidays.test.ts
git commit -m "feat(thebill): add static Korean holiday data"
```

---

### Task 2: 영업일 계산 모듈

**Files:**
- Create: `jeeves/server/plugins/thebill-sync/business-day.ts`
- Create: `jeeves/server/plugins/thebill-sync/business-day.test.ts`

- [ ] **Step 1: Write the failing test**

`jeeves/server/plugins/thebill-sync/business-day.test.ts`:
```typescript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isBusinessDay, adjustToBusinessDay, addBusinessDays } from './business-day';

test('isBusinessDay returns false for Saturday', () => {
  // 2026-04-25 is a Saturday
  assert.equal(isBusinessDay(new Date('2026-04-25')), false);
});

test('isBusinessDay returns false for Sunday', () => {
  // 2026-04-26 is a Sunday
  assert.equal(isBusinessDay(new Date('2026-04-26')), false);
});

test('isBusinessDay returns false for holiday', () => {
  assert.equal(isBusinessDay(new Date('2026-05-05')), false);
});

test('isBusinessDay returns true for weekday non-holiday', () => {
  // 2026-04-27 Monday
  assert.equal(isBusinessDay(new Date('2026-04-27')), true);
});

test('adjustToBusinessDay backward from Saturday returns Friday', () => {
  // 2026-04-25 Sat -> 2026-04-24 Fri
  const result = adjustToBusinessDay(new Date('2026-04-25'), 'backward');
  assert.equal(result.toISOString().slice(0, 10), '2026-04-24');
});

test('adjustToBusinessDay forward from Sunday returns Monday', () => {
  // 2026-04-26 Sun -> 2026-04-27 Mon
  const result = adjustToBusinessDay(new Date('2026-04-26'), 'forward');
  assert.equal(result.toISOString().slice(0, 10), '2026-04-27');
});

test('addBusinessDays 8 days from 2026-04-26 (Sun) skips weekends', () => {
  // 시작: 2026-04-26 Sun (자체가 영업일 아님)
  // 영업일 8개 더하기 → 4/27 Mon=1, 4/28=2, 4/29=3, 4/30=4, 5/1=5, 5/4=6 (5/5 어린이날 skip), 5/6=7, 5/7=8
  const result = addBusinessDays(new Date('2026-04-26'), 8);
  assert.equal(result.toISOString().slice(0, 10), '2026-05-07');
});

test('adjustToBusinessDay returns same date if already business day', () => {
  const d = new Date('2026-04-27'); // Monday
  const result = adjustToBusinessDay(d, 'backward');
  assert.equal(result.toISOString().slice(0, 10), '2026-04-27');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd jeeves/server && npx tsx --test plugins/thebill-sync/business-day.test.ts`
Expected: FAIL with `Cannot find module './business-day'`

- [ ] **Step 3: Implement business-day.ts**

`jeeves/server/plugins/thebill-sync/business-day.ts`:
```typescript
import { isHoliday } from './holidays';

export function isBusinessDay(d: Date): boolean {
  const day = d.getDay();
  if (day === 0 || day === 6) return false; // Sun, Sat
  return !isHoliday(d);
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function adjustToBusinessDay(
  d: Date,
  direction: 'forward' | 'backward',
): Date {
  let cur = new Date(d);
  const step = direction === 'forward' ? 1 : -1;
  for (let i = 0; i < 30; i++) {
    if (isBusinessDay(cur)) return cur;
    cur = addDays(cur, step);
  }
  throw new Error(`adjustToBusinessDay: no business day found within 30 days`);
}

export function addBusinessDays(d: Date, days: number): Date {
  if (days === 0) return new Date(d);
  let cur = new Date(d);
  let remaining = days;
  const step = days > 0 ? 1 : -1;
  remaining = Math.abs(remaining);
  while (remaining > 0) {
    cur = addDays(cur, step);
    if (isBusinessDay(cur)) remaining -= 1;
  }
  return cur;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd jeeves/server && npx tsx --test plugins/thebill-sync/business-day.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add jeeves/server/plugins/thebill-sync/business-day.ts jeeves/server/plugins/thebill-sync/business-day.test.ts
git commit -m "feat(thebill): add business-day calculation utilities"
```

---

## Phase B: thebill-sync 확장 (STEP 2/3)

### Task 3: config 확장 (AIRTABLE_FEE_*)

**Files:**
- Modify: `jeeves/server/plugins/thebill-sync/config.ts`
- Modify: `jeeves/server/.env.example`

- [ ] **Step 1: Extend config.ts**

Replace entire `jeeves/server/plugins/thebill-sync/config.ts` with:
```typescript
import * as path from 'path';
import * as fs from 'fs';

const ENV_PATH = path.resolve(__dirname, '../../../.env');
if (fs.existsSync(ENV_PATH)) {
  require('dotenv').config({ path: ENV_PATH });
}

export interface ThebillConfig {
  cmsLoginUrl: string;
  cmsUsername: string;
  cmsPassword: string;
  airtableFeePat: string;
  airtableFeeBaseId: string;
  airtableFeeTableId: string;
  airtableFeeBizNoField: string;
  airtableFeeAmountField: string;
  airtableFeeStatusField: string;
  airtableFeeNameField: string;
  slackBotToken: string;
  slackChannel: string;
}

export class ThebillConfigError extends Error {
  constructor(public missing: string[]) {
    super(`thebill-sync: missing env vars: ${missing.join(', ')}`);
    this.name = 'ThebillConfigError';
  }
}

export function loadConfig(): ThebillConfig {
  const required = {
    cmsLoginUrl: process.env.THEBILL_CMS_LOGIN_URL,
    cmsUsername: process.env.THEBILL_CMS_USERNAME,
    cmsPassword: process.env.THEBILL_CMS_PASSWORD,
    airtableFeePat: process.env.AIRTABLE_FEE_PAT,
    airtableFeeBaseId: process.env.AIRTABLE_FEE_BASE_ID,
    airtableFeeTableId: process.env.AIRTABLE_FEE_TABLE_ID,
    airtableFeeBizNoField: process.env.AIRTABLE_FEE_BIZNO_FIELD ?? '사업자번호',
    airtableFeeAmountField: process.env.AIRTABLE_FEE_AMOUNT_FIELD ?? '기장료',
    airtableFeeStatusField: process.env.AIRTABLE_FEE_STATUS_FIELD ?? '출금상태',
    airtableFeeNameField: process.env.AIRTABLE_FEE_NAME_FIELD ?? '거래처명',
    slackBotToken: process.env.SLACK_BOT_TOKEN,
    slackChannel: process.env.SLACK_CHANNEL,
  };
  const missing = Object.entries(required)
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (missing.length > 0) throw new ThebillConfigError(missing);
  return required as ThebillConfig;
}

export const STATE_FILE = path.resolve(
  __dirname,
  '../../../logs/thebill-sync/state.json',
);
```

- [ ] **Step 2: Add env example entries**

Append to `jeeves/server/.env.example`:
```
# 더빌 CMS 동기화 (수수료 테이블)
AIRTABLE_FEE_PAT=
AIRTABLE_FEE_BASE_ID=appGLQdwsGXyeoYji
AIRTABLE_FEE_TABLE_ID=tblghdSYIU17yLg6d
AIRTABLE_FEE_BIZNO_FIELD=사업자번호
AIRTABLE_FEE_AMOUNT_FIELD=기장료
AIRTABLE_FEE_STATUS_FIELD=출금상태
AIRTABLE_FEE_NAME_FIELD=거래처명
```

- [ ] **Step 3: Type-check**

Run: `cd jeeves/server && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add jeeves/server/plugins/thebill-sync/config.ts jeeves/server/.env.example
git commit -m "feat(thebill): add AIRTABLE_FEE_* env config"
```

---

### Task 4: parser 확장 (사업자번호 정규화 + 상태 분류)

**Files:**
- Modify: `jeeves/server/plugins/thebill-sync/parser.ts`
- Create: `jeeves/server/plugins/thebill-sync/parser.test.ts`

- [ ] **Step 1: Write the failing test**

`jeeves/server/plugins/thebill-sync/parser.test.ts`:
```typescript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeBizNo, classifyStatus } from './parser';

test('normalizeBizNo strips hyphens', () => {
  assert.equal(normalizeBizNo('123-45-67890'), '1234567890');
});

test('normalizeBizNo strips spaces', () => {
  assert.equal(normalizeBizNo(' 123 45 67890 '), '1234567890');
});

test('normalizeBizNo passes through individual ID prefix (6 digits)', () => {
  assert.equal(normalizeBizNo('880101'), '880101');
});

test('normalizeBizNo handles number input', () => {
  assert.equal(normalizeBizNo(1234567890 as unknown as string), '1234567890');
});

test('classifyStatus maps success values', () => {
  assert.equal(classifyStatus('출금성공'), 'success');
  assert.equal(classifyStatus('승인성공'), 'success');
  assert.equal(classifyStatus('정상출금'), 'success');
});

test('classifyStatus maps failure values', () => {
  assert.equal(classifyStatus('승인실패'), 'failure');
  assert.equal(classifyStatus('출금실패'), 'failure');
});

test('classifyStatus returns unknown for unrecognized', () => {
  assert.equal(classifyStatus('대기중'), 'unknown');
  assert.equal(classifyStatus(''), 'unknown');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd jeeves/server && npx tsx --test plugins/thebill-sync/parser.test.ts`
Expected: FAIL with import errors (`normalizeBizNo` not exported)

- [ ] **Step 3: Replace parser.ts**

Replace entire `jeeves/server/plugins/thebill-sync/parser.ts` with:
```typescript
import * as XLSX from 'xlsx';

export interface ThebillRow {
  bizNo: string;
  memberName: string;
  amount: number;
  status: string;
  drawDate: string;
}

export type StatusClass = 'success' | 'failure' | 'unknown';

const HEADER_CANDIDATES = {
  bizNo: ['사업자번호', '주민(사업자)번호', '주민번호', '식별번호'],
  memberName: ['회원명', '고객명', '업체명'],
  amount: ['금액', '청구금액', '출금액'],
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
  if (s.includes('실패')) return 'failure';
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
      amount: Number(pickField(r, HEADER_CANDIDATES.amount) ?? 0),
      status: String(pickField(r, HEADER_CANDIDATES.status) ?? ''),
      drawDate: String(pickField(r, HEADER_CANDIDATES.drawDate) ?? ''),
    }))
    .filter((r) => r.bizNo);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd jeeves/server && npx tsx --test plugins/thebill-sync/parser.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add jeeves/server/plugins/thebill-sync/parser.ts jeeves/server/plugins/thebill-sync/parser.test.ts
git commit -m "feat(thebill): parse bizNo/status with normalization helpers"
```

---

### Task 5: scraper 모드 분리

**Files:**
- Modify: `jeeves/server/plugins/thebill-sync/scraper.ts`

> Note: 실제 셀렉터는 첫 실행 시 더빌 CMS 페이지를 보고 확정해야 합니다. 이 task는 인터페이스를 모드 분리하고, 셀렉터는 TODO 주석으로 남겨둠. 통합 검증(Task 17)에서 한 메뉴씩 확정.

- [ ] **Step 1: Replace scraper.ts**

Replace entire `jeeves/server/plugins/thebill-sync/scraper.ts` with:
```typescript
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { chromium, Browser, BrowserContext, Page } from 'playwright';
import type { ServerContext } from '../types';
import { loadConfig, STATE_FILE } from './config';

export type ScrapeMode = 'withdrawal' | 'reWithdrawal';

export interface ScrapeOptions {
  mode: ScrapeMode;
  from: Date;
  to: Date;
}

function fmt(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

async function ensureLoggedIn(page: Page, ctx: ServerContext): Promise<void> {
  const cfg = loadConfig();
  await page.goto(cfg.cmsLoginUrl, { waitUntil: 'domcontentloaded' });

  const onLoginForm = await page
    .locator('input[type="password"]')
    .first()
    .isVisible()
    .catch(() => false);

  if (!onLoginForm) {
    ctx.log('[thebill-sync] existing session valid');
    return;
  }

  ctx.log('[thebill-sync] logging in...');
  await page.locator('input[name="username"], input[name="userId"], input[type="text"]').first().fill(cfg.cmsUsername);
  await page.locator('input[type="password"]').first().fill(cfg.cmsPassword);
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded' }).catch(() => {}),
    page.locator('button[type="submit"], button:has-text("로그인")').first().click(),
  ]);

  const stillOnLogin = await page
    .locator('input[type="password"]')
    .first()
    .isVisible()
    .catch(() => false);
  if (stillOnLogin) {
    throw new Error('CMS login failed - credentials rejected or CAPTCHA required');
  }
  ctx.log('[thebill-sync] login success');
}

async function navigateAndDownload(
  page: Page,
  ctx: ServerContext,
  opts: ScrapeOptions,
): Promise<string> {
  if (opts.mode === 'withdrawal') {
    ctx.log('[thebill-sync] mode=withdrawal — [자동이체][출금결과조회]');
    // TODO(selectors): 첫 실행 시 실제 메뉴 클릭 sequence 확정
    // await page.click('text=자동이체');
    // await page.click('text=출금결과조회');
  } else {
    ctx.log('[thebill-sync] mode=reWithdrawal — [자동이체][회원상태/출금설정]');
    // TODO(selectors):
    // await page.click('text=자동이체');
    // await page.click('text=회원상태/출금설정');
  }

  ctx.log(`[thebill-sync] period: ${fmt(opts.from)} ~ ${fmt(opts.to)}`);
  // TODO(selectors): 기간 input 채우기 + 조회 버튼

  ctx.log('[thebill-sync] waiting for download...');
  const downloadPromise = page.waitForEvent('download', { timeout: 60_000 });
  // TODO(selectors): await page.click('text=엑셀다운로드');
  const download = await downloadPromise;

  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const savePath = path.join(os.tmpdir(), `thebill_${opts.mode}_${ts}.xlsx`);
  await download.saveAs(savePath);
  ctx.log(`[thebill-sync] downloaded: ${savePath}`);
  return savePath;
}

export async function downloadResult(
  ctx: ServerContext,
  opts: ScrapeOptions,
): Promise<string> {
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });

  let browser: Browser | null = null;
  let context: BrowserContext | null = null;
  try {
    browser = await chromium.launch({ headless: true });
    const contextOpts = fs.existsSync(STATE_FILE) ? { storageState: STATE_FILE } : {};
    context = await browser.newContext({ acceptDownloads: true, ...contextOpts });
    const page = await context.newPage();

    await ensureLoggedIn(page, ctx);
    const savePath = await navigateAndDownload(page, ctx, opts);
    await context.storageState({ path: STATE_FILE });
    return savePath;
  } finally {
    await context?.close().catch(() => {});
    await browser?.close().catch(() => {});
  }
}
```

- [ ] **Step 2: Type-check**

Run: `cd jeeves/server && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add jeeves/server/plugins/thebill-sync/scraper.ts
git commit -m "feat(thebill): split scraper into withdrawal/reWithdrawal modes"
```

---

### Task 6: airtable 재작성 (수수료 매칭/업데이트)

**Files:**
- Modify: `jeeves/server/plugins/thebill-sync/airtable.ts`
- Create: `jeeves/server/plugins/thebill-sync/airtable.test.ts`

- [ ] **Step 1: Write the failing test (mocking Airtable)**

`jeeves/server/plugins/thebill-sync/airtable.test.ts`:
```typescript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decideStatus } from './airtable';

test('decideStatus withdrawal mode: success → 출금성공', () => {
  assert.equal(decideStatus('success', 'withdrawal'), '출금성공');
});

test('decideStatus withdrawal mode: failure → 자동재출금', () => {
  assert.equal(decideStatus('failure', 'withdrawal'), '자동재출금');
});

test('decideStatus reWithdrawal mode: success → 출금성공', () => {
  assert.equal(decideStatus('success', 'reWithdrawal'), '출금성공');
});

test('decideStatus reWithdrawal mode: failure → 출금실패', () => {
  assert.equal(decideStatus('failure', 'reWithdrawal'), '출금실패');
});

test('decideStatus unknown returns null (skip update)', () => {
  assert.equal(decideStatus('unknown', 'withdrawal'), null);
  assert.equal(decideStatus('unknown', 'reWithdrawal'), null);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd jeeves/server && npx tsx --test plugins/thebill-sync/airtable.test.ts`
Expected: FAIL — `decideStatus` not exported

- [ ] **Step 3: Replace airtable.ts**

Replace entire `jeeves/server/plugins/thebill-sync/airtable.ts` with:
```typescript
import Airtable from 'airtable';
import { loadConfig, type ThebillConfig } from './config';
import { classifyStatus, normalizeBizNo, type ThebillRow, type StatusClass } from './parser';
import type { ScrapeMode } from './scraper';

export interface UpdateResult {
  total: number;
  successUpdated: number;
  failureUpdated: number;
  skipped: number;
  unmatched: string[];
  errors: { bizNo: string; error: string }[];
}

export function decideStatus(
  cls: StatusClass,
  mode: ScrapeMode,
): string | null {
  if (cls === 'unknown') return null;
  if (cls === 'success') return '출금성공';
  // failure
  return mode === 'withdrawal' ? '자동재출금' : '출금실패';
}

function escapeFormula(s: string): string {
  return s.replace(/'/g, "\\'");
}

function currentMonthView(): string {
  const m = String(new Date().getMonth() + 1);
  return `[${m}월] 세금계산서 및 입금현황`;
}

export async function updateFeeTable(
  rows: ThebillRow[],
  mode: ScrapeMode,
  cfgOverride?: ThebillConfig,
): Promise<UpdateResult> {
  const cfg = cfgOverride ?? loadConfig();
  const base = new Airtable({ apiKey: cfg.airtableFeePat }).base(cfg.airtableFeeBaseId);
  const table = base(cfg.airtableFeeTableId);
  const view = currentMonthView();

  const result: UpdateResult = {
    total: rows.length,
    successUpdated: 0,
    failureUpdated: 0,
    skipped: 0,
    unmatched: [],
    errors: [],
  };

  for (const row of rows) {
    const cls = classifyStatus(row.status);
    const newStatus = decideStatus(cls, mode);
    if (newStatus === null) {
      result.skipped += 1;
      continue;
    }

    const bizNo = normalizeBizNo(row.bizNo);
    try {
      const records = await table
        .select({
          view,
          maxRecords: 1,
          filterByFormula: `{${cfg.airtableFeeBizNoField}}='${escapeFormula(bizNo)}'`,
        })
        .firstPage();

      if (records.length === 0) {
        result.unmatched.push(bizNo);
        continue;
      }

      await table.update(records[0].id, {
        [cfg.airtableFeeStatusField]: newStatus,
      });

      if (cls === 'success') result.successUpdated += 1;
      else result.failureUpdated += 1;
    } catch (err) {
      result.errors.push({
        bizNo,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return result;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd jeeves/server && npx tsx --test plugins/thebill-sync/airtable.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add jeeves/server/plugins/thebill-sync/airtable.ts jeeves/server/plugins/thebill-sync/airtable.test.ts
git commit -m "feat(thebill): match by bizNo, update Airtable fee status by mode"
```

---

### Task 7: pipeline 모드별 흐름

**Files:**
- Modify: `jeeves/server/plugins/thebill-sync/pipeline.ts`

- [ ] **Step 1: Replace pipeline.ts**

Replace entire `jeeves/server/plugins/thebill-sync/pipeline.ts` with:
```typescript
import type { ServerContext, RunResult } from '../types';
import * as scraper from './scraper';
import * as parser from './parser';
import * as airtable from './airtable';
import * as slack from './slack';
import { adjustToBusinessDay, addBusinessDays } from './business-day';

export type RunMode = 'withdrawal' | 'reWithdrawal';

function nthOfThisMonth(n: number): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), n);
}

function computePeriod(mode: RunMode): { from: Date; to: Date } {
  if (mode === 'withdrawal') {
    const target = adjustToBusinessDay(nthOfThisMonth(25), 'backward');
    return { from: target, to: target };
  }
  const start = adjustToBusinessDay(nthOfThisMonth(26), 'forward');
  const end = addBusinessDays(nthOfThisMonth(25), 8);
  return { from: start, to: end };
}

export interface RunOptions {
  mode: RunMode;
  from?: Date;
  to?: Date;
}

export async function run(
  ctx: ServerContext,
  opts: RunOptions = { mode: 'withdrawal' },
): Promise<RunResult> {
  const start = Date.now();
  const startedAt = new Date().toISOString();
  let stage: 'scrape' | 'parse' | 'airtable' | 'slack' = 'scrape';
  const period = opts.from && opts.to ? { from: opts.from, to: opts.to } : computePeriod(opts.mode);

  try {
    ctx.log(`[thebill-sync] mode=${opts.mode} period=${period.from.toISOString().slice(0, 10)}~${period.to.toISOString().slice(0, 10)}`);
    const xlsxPath = await scraper.downloadResult(ctx, {
      mode: opts.mode,
      from: period.from,
      to: period.to,
    });

    stage = 'parse';
    const rows = parser.parse(xlsxPath);
    ctx.log(`[thebill-sync] parsed ${rows.length} rows`);

    stage = 'airtable';
    const updateResult = await airtable.updateFeeTable(rows, opts.mode);

    const durationMs = Date.now() - start;
    stage = 'slack';
    await slack.notifySuccess(
      {
        total: updateResult.total,
        updated: updateResult.successUpdated + updateResult.failureUpdated,
        created: 0,
        failed: updateResult.errors.length,
        skipped: updateResult.skipped,
        errors: updateResult.errors.map((e) => ({ key: e.bizNo, error: e.error })),
      },
      durationMs,
    );

    return {
      status: 'success',
      startedAt,
      finishedAt: new Date().toISOString(),
      durationMs,
      summary: `[${opts.mode}] 총 ${updateResult.total}건 (성공반영 ${updateResult.successUpdated}, 실패반영 ${updateResult.failureUpdated}, 매칭실패 ${updateResult.unmatched.length}, 에러 ${updateResult.errors.length})`,
      meta: {
        mode: opts.mode,
        period: {
          from: period.from.toISOString().slice(0, 10),
          to: period.to.toISOString().slice(0, 10),
        },
        ...updateResult,
      } as unknown as Record<string, unknown>,
    };
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    ctx.logError(`[thebill-sync] ${stage} failed: ${e.message}`);
    await slack.notifyFailure(e, stage).catch((slackErr) => {
      ctx.logError(`[thebill-sync] slack notify failed: ${slackErr}`);
    });
    return {
      status: 'error',
      startedAt,
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - start,
      summary: `[${opts.mode}] 실패 (${stage}): ${e.message}`,
      error: e.stack ?? e.message,
      meta: { stage, mode: opts.mode },
    };
  }
}
```

- [ ] **Step 2: Type-check**

Run: `cd jeeves/server && npx tsc --noEmit`
Expected: no errors (some warnings about old code OK if any)

- [ ] **Step 3: Commit**

```bash
git add jeeves/server/plugins/thebill-sync/pipeline.ts
git commit -m "feat(thebill): mode-aware pipeline with auto-period calculation"
```

---

### Task 8: index.ts 두 schedule 등록

**Files:**
- Modify: `jeeves/server/plugins/thebill-sync/index.ts`

- [ ] **Step 1: Check scheduler API**

Run: `grep -n "MacroPlugin\|schedule" jeeves/server/plugins/types.ts jeeves/server/scheduler.ts | head -40`
Expected: see schedule contract

- [ ] **Step 2: Read scheduler types**

Run: `cat jeeves/server/plugins/types.ts`
Identify: whether `MacroPlugin.schedule` accepts an array or only one schedule. If array supported, register two; if not, use one schedule with mode dispatch via env or run param.

- [ ] **Step 3: Update index.ts**

If scheduler supports a single `schedule` field per plugin, register two distinct **plugins** (`thebill-sync-withdrawal`, `thebill-sync-reWithdrawal`) sharing the same pipeline. Replace `jeeves/server/plugins/thebill-sync/index.ts`:
```typescript
import type { MacroPlugin } from '../types';
import { registerThebillRoutes } from './routes';
import { run } from './pipeline';

export const thebillWithdrawalPlugin: MacroPlugin = {
  id: 'thebill-sync-withdrawal',
  name: '더빌 출금결과 → 에어테이블 (매월 26일)',
  icon: '📊',
  status: 'ready',
  registerRoutes: registerThebillRoutes,
  schedule: {
    defaultCron: '0 9 26 * *',
    defaultEnabled: false,
    timezone: 'Asia/Seoul',
    run: (ctx) => run(ctx, { mode: 'withdrawal' }),
  },
};

export const thebillReWithdrawalPlugin: MacroPlugin = {
  id: 'thebill-sync-reWithdrawal',
  name: '더빌 재출금결과 → 에어테이블 (25+8영업일)',
  icon: '📊',
  status: 'ready',
  registerRoutes: registerThebillRoutes,
  schedule: {
    defaultCron: '0 9 * * *',  // 매일 09:00 — pipeline 안에서 25+8영업일인지 체크
    defaultEnabled: false,
    timezone: 'Asia/Seoul',
    run: (ctx) => run(ctx, { mode: 'reWithdrawal' }),
  },
};
```

- [ ] **Step 4: Update plugin registry**

Open `jeeves/server/plugins/index.ts` and replace any `thebillSyncPlugin` import/export with the two new plugins. Example diff (apply equivalent edit to actual file):
```typescript
// Before
import { thebillSyncPlugin } from './thebill-sync';
export const plugins: MacroPlugin[] = [..., thebillSyncPlugin];

// After
import { thebillWithdrawalPlugin, thebillReWithdrawalPlugin } from './thebill-sync';
export const plugins: MacroPlugin[] = [..., thebillWithdrawalPlugin, thebillReWithdrawalPlugin];
```

- [ ] **Step 5: Type-check**

Run: `cd jeeves/server && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add jeeves/server/plugins/thebill-sync/index.ts jeeves/server/plugins/index.ts
git commit -m "feat(thebill): register withdrawal/reWithdrawal as separate plugins"
```

---

### Task 9: 클라이언트 ThebillSyncPage 모드 분리

> Plugin이 둘로 나뉘었으므로 기존 페이지(`thebill-sync`)도 두 페이지로 자연 분리됨. 클라이언트 라우트 등록만 갱신.

**Files:**
- Modify: `jeeves/client/src/plugins/thebill-sync/index.ts`
- Modify: `jeeves/client/src/plugins/thebill-sync/ThebillSyncPage.tsx`
- Modify: `jeeves/client/src/plugins/index.tsx`

- [ ] **Step 1: Inspect current registry**

Run: `cat jeeves/client/src/plugins/index.tsx`
Identify: how plugins are registered in the client.

- [ ] **Step 2: Make ThebillSyncPage mode-aware**

Open `jeeves/client/src/plugins/thebill-sync/ThebillSyncPage.tsx`. Change the component to accept `pluginId` and `title` via props:
```typescript
interface Props {
  pluginId: string;
  title: string;
  description: string;
}

export function ThebillSyncPage({ pluginId, title, description }: Props) {
  // 기존 본문에서 const PLUGIN_ID = 'thebill-sync'; 제거
  // 모든 PLUGIN_ID 참조를 pluginId로 교체
  // <h2>{title}</h2><p>{description}</p>
  // ...
}
```
Update the existing function body so the literal `PLUGIN_ID = 'thebill-sync'` and the heading are replaced by these props.

- [ ] **Step 3: Update plugin entries to instantiate two pages**

Replace `jeeves/client/src/plugins/thebill-sync/index.ts`:
```typescript
import { ThebillSyncPage } from './ThebillSyncPage';

export const thebillWithdrawalEntry = {
  id: 'thebill-sync-withdrawal',
  name: '출금결과 동기화',
  icon: '📊',
  page: () => (
    <ThebillSyncPage
      pluginId="thebill-sync-withdrawal"
      title="📊 출금결과 → 에어테이블 (매월 26일)"
      description="더빌 [출금결과조회] 엑셀을 받아 수수료 테이블의 출금상태를 출금성공/자동재출금으로 갱신합니다."
    />
  ),
};

export const thebillReWithdrawalEntry = {
  id: 'thebill-sync-reWithdrawal',
  name: '재출금결과 동기화',
  icon: '📊',
  page: () => (
    <ThebillSyncPage
      pluginId="thebill-sync-reWithdrawal"
      title="📊 재출금결과 → 에어테이블 (25+8영업일)"
      description="더빌 [회원상태/출금설정] 엑셀을 받아 수수료 테이블의 출금상태를 출금성공/출금실패로 갱신합니다."
    />
  ),
};
```
Adjust the named-export shape to match whatever interface the existing client registry expects (verify in Step 1).

- [ ] **Step 4: Update client plugins registry**

In `jeeves/client/src/plugins/index.tsx`, replace any `thebill-sync` registration with the two new entries from Step 3.

- [ ] **Step 5: Build client**

Run: `cd jeeves/client && npm run build`
Expected: build succeeds

- [ ] **Step 6: Commit**

```bash
git add jeeves/client/src/plugins/thebill-sync/ jeeves/client/src/plugins/index.tsx
git commit -m "feat(thebill): split client page into withdrawal/reWithdrawal entries"
```

---

## Phase C: payment-reminder 신규 (STEP 4)

### Task 10: payment-reminder/config.ts

**Files:**
- Create: `jeeves/server/plugins/payment-reminder/config.ts`

- [ ] **Step 1: Create config.ts**

`jeeves/server/plugins/payment-reminder/config.ts`:
```typescript
import * as path from 'path';
import * as fs from 'fs';

const ENV_PATH = path.resolve(__dirname, '../../../.env');
if (fs.existsSync(ENV_PATH)) {
  require('dotenv').config({ path: ENV_PATH });
}

export interface PaymentReminderConfig {
  airtablePat: string;
  airtableBaseId: string;
  airtableTableId: string;
  bizNoField: string;
  amountField: string;
  statusField: string;
  nameField: string;
  bankAccount: string;
  slackBotToken: string;
  slackChannel: string;
}

export class PaymentReminderConfigError extends Error {
  constructor(public missing: string[]) {
    super(`payment-reminder: missing env vars: ${missing.join(', ')}`);
    this.name = 'PaymentReminderConfigError';
  }
}

export function loadConfig(): PaymentReminderConfig {
  const required = {
    airtablePat: process.env.AIRTABLE_FEE_PAT,
    airtableBaseId: process.env.AIRTABLE_FEE_BASE_ID,
    airtableTableId: process.env.AIRTABLE_FEE_TABLE_ID,
    bizNoField: process.env.AIRTABLE_FEE_BIZNO_FIELD ?? '사업자번호',
    amountField: process.env.AIRTABLE_FEE_AMOUNT_FIELD ?? '기장료',
    statusField: process.env.AIRTABLE_FEE_STATUS_FIELD ?? '출금상태',
    nameField: process.env.AIRTABLE_FEE_NAME_FIELD ?? '거래처명',
    bankAccount: process.env.PAYMENT_REMINDER_BANK_ACCOUNT ?? '카카오뱅크 / 3333367093297',
    slackBotToken: process.env.SLACK_BOT_TOKEN,
    slackChannel: process.env.SLACK_CHANNEL,
  };
  const missing = Object.entries(required)
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (missing.length > 0) throw new PaymentReminderConfigError(missing);
  return required as PaymentReminderConfig;
}
```

- [ ] **Step 2: Append env example**

Append to `jeeves/server/.env.example`:
```
PAYMENT_REMINDER_BANK_ACCOUNT=카카오뱅크 / 3333367093297
```

- [ ] **Step 3: Commit**

```bash
git add jeeves/server/plugins/payment-reminder/config.ts jeeves/server/.env.example
git commit -m "feat(payment-reminder): add plugin config"
```

---

### Task 11: payment-reminder/airtable.ts

**Files:**
- Create: `jeeves/server/plugins/payment-reminder/airtable.ts`
- Create: `jeeves/server/plugins/payment-reminder/airtable.test.ts`

- [ ] **Step 1: Write the failing test**

`jeeves/server/plugins/payment-reminder/airtable.test.ts`:
```typescript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { previousMonthView, formatYearMonth } from './airtable';

test('previousMonthView returns the previous-month view name', () => {
  assert.equal(previousMonthView(new Date('2026-05-10')), '[4월] 세금계산서 및 입금현황');
});

test('previousMonthView wraps January to December', () => {
  assert.equal(previousMonthView(new Date('2026-01-10')), '[12월] 세금계산서 및 입금현황');
});

test('formatYearMonth returns previous month YYYY-MM', () => {
  assert.equal(formatYearMonth(new Date('2026-05-10')), '2026-04');
  assert.equal(formatYearMonth(new Date('2026-01-10')), '2025-12');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd jeeves/server && npx tsx --test plugins/payment-reminder/airtable.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement airtable.ts**

`jeeves/server/plugins/payment-reminder/airtable.ts`:
```typescript
import Airtable from 'airtable';
import { loadConfig, type PaymentReminderConfig } from './config';

export interface UnpaidRecord {
  recordId: string;
  name: string;
  bizNo: string;
  amount: number;
}

export function previousMonthView(now: Date = new Date()): string {
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return `[${prev.getMonth() + 1}월] 세금계산서 및 입금현황`;
}

export function formatYearMonth(now: Date = new Date()): string {
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const y = prev.getFullYear();
  const m = String(prev.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export async function fetchUnpaid(
  cfgOverride?: PaymentReminderConfig,
  now: Date = new Date(),
): Promise<UnpaidRecord[]> {
  const cfg = cfgOverride ?? loadConfig();
  const base = new Airtable({ apiKey: cfg.airtablePat }).base(cfg.airtableBaseId);
  const table = base(cfg.airtableTableId);

  const records = await table
    .select({
      view: previousMonthView(now),
      filterByFormula: `{${cfg.statusField}}='출금실패'`,
    })
    .all();

  return records.map((r) => ({
    recordId: r.id,
    name: String(r.get(cfg.nameField) ?? ''),
    bizNo: String(r.get(cfg.bizNoField) ?? ''),
    amount: Number(r.get(cfg.amountField) ?? 0),
  }));
}

export async function markAsRequested(
  recordId: string,
  cfgOverride?: PaymentReminderConfig,
): Promise<void> {
  const cfg = cfgOverride ?? loadConfig();
  const base = new Airtable({ apiKey: cfg.airtablePat }).base(cfg.airtableBaseId);
  const table = base(cfg.airtableTableId);
  await table.update(recordId, { [cfg.statusField]: '입금요청' });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd jeeves/server && npx tsx --test plugins/payment-reminder/airtable.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add jeeves/server/plugins/payment-reminder/airtable.ts jeeves/server/plugins/payment-reminder/airtable.test.ts
git commit -m "feat(payment-reminder): fetch unpaid records + mark as requested"
```

---

### Task 12: payment-reminder/message.ts

**Files:**
- Create: `jeeves/server/plugins/payment-reminder/message.ts`
- Create: `jeeves/server/plugins/payment-reminder/message.test.ts`

- [ ] **Step 1: Write the failing test**

`jeeves/server/plugins/payment-reminder/message.test.ts`:
```typescript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildMessage, formatAmount } from './message';

test('formatAmount inserts thousand separators', () => {
  assert.equal(formatAmount(110000), '110,000');
  assert.equal(formatAmount(88000), '88,000');
});

test('buildMessage substitutes month, amount, and bank account', () => {
  const msg = buildMessage(
    { recordId: 'r1', name: 'ABC세무', bizNo: '1234567890', amount: 110000 },
    { yearMonth: '2026-04', bankAccount: '카카오뱅크 / 3333367093297' },
  );

  assert.match(msg, /04월 기장료 110,000원/);
  assert.match(msg, /카카오뱅크 \/ 3333367093297/);
  assert.match(msg, /안녕하세요 대표님/);
});

test('buildMessage handles single-digit month with zero pad', () => {
  const msg = buildMessage(
    { recordId: 'r1', name: 'XYZ', bizNo: '111', amount: 50000 },
    { yearMonth: '2026-03', bankAccount: '카카오뱅크 / 1' },
  );
  assert.match(msg, /03월 기장료 50,000원/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd jeeves/server && npx tsx --test plugins/payment-reminder/message.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement message.ts**

`jeeves/server/plugins/payment-reminder/message.ts`:
```typescript
import type { UnpaidRecord } from './airtable';

export interface MessageContext {
  yearMonth: string; // 'YYYY-MM'
  bankAccount: string;
}

export function formatAmount(n: number): string {
  return new Intl.NumberFormat('ko-KR').format(n);
}

const TEMPLATE = [
  '안녕하세요 대표님.',
  '{귀속월}월 기장료 {금액}원(부가세포함)이 잔액부족으로 출금이 실패된 것으로 확인됩니다.',
  '아래 계좌로 입금 후 말씀한번 부탁드립니다.',
  '{계좌번호}',
  '',
  'CMS 자동이체 계좌 변경이나 별도 협의가 필요하신 경우, 편하게 연락 주시면 빠르게 도와드리겠습니다.',
  '감사합니다.',
].join('\n');

export function buildMessage(record: UnpaidRecord, ctx: MessageContext): string {
  const month = ctx.yearMonth.slice(5, 7);
  return TEMPLATE
    .replace('{귀속월}', month)
    .replace('{금액}', formatAmount(record.amount))
    .replace('{계좌번호}', ctx.bankAccount);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd jeeves/server && npx tsx --test plugins/payment-reminder/message.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add jeeves/server/plugins/payment-reminder/message.ts jeeves/server/plugins/payment-reminder/message.test.ts
git commit -m "feat(payment-reminder): message template builder"
```

---

### Task 13: payment-reminder/sender.ts (kakao-send 위임)

**Files:**
- Create: `jeeves/server/plugins/payment-reminder/sender.ts`

> 기존 `kakao-send/sender.ts` 의 `runKakaoSend` 는 (a) targets 배열을 받음 (b) 카드 이미지 첨부 옵션. 이번 STEP 4 는 텍스트 멘트만 전송, 이미지 없음. `runKakaoSend` 의 시그니처가 호환된다면 cardImagePaths=[] 로 호출. 호환 안 되면 텍스트-only 변형을 추가해야 함.

- [ ] **Step 1: Inspect kakao-send sender API**

Run: `sed -n '1,80p' jeeves/server/plugins/kakao-send/sender.ts`
Identify: signature of exported send function and whether `cardImagePaths` can be empty.

- [ ] **Step 2: Implement wrapper**

`jeeves/server/plugins/payment-reminder/sender.ts`:
```typescript
import { runKakaoSend } from '../kakao-send/sender';
import type { UnpaidRecord } from './airtable';

export interface SendInput {
  record: UnpaidRecord;
  message: string;
}

export interface SendStats {
  total: number;
  success: number;
  failed: number;
  skipped: number;
  failures: { recordId: string; error: string }[];
}

export async function sendBatch(
  inputs: SendInput[],
  isStopped: () => boolean,
  log: (msg: string) => void,
): Promise<{ stats: SendStats; perRecord: { recordId: string; success: boolean }[] }> {
  const stats: SendStats = {
    total: inputs.length,
    success: 0,
    failed: 0,
    skipped: 0,
    failures: [],
  };
  const perRecord: { recordId: string; success: boolean }[] = [];

  for (const input of inputs) {
    if (isStopped()) {
      stats.skipped += 1;
      perRecord.push({ recordId: input.record.recordId, success: false });
      continue;
    }
    try {
      const result = await runKakaoSend(
        [
          {
            name: input.record.name,
            bizNo: input.record.bizNo,
            groupName: '미수업체',
            imagePath: null,
          },
        ],
        input.message,
        [],
        isStopped,
        log,
        () => {},
      );

      const ok = result.success > 0 && result.failed === 0;
      if (ok) {
        stats.success += 1;
        perRecord.push({ recordId: input.record.recordId, success: true });
      } else {
        stats.failed += 1;
        stats.failures.push({ recordId: input.record.recordId, error: 'kakao send returned non-success' });
        perRecord.push({ recordId: input.record.recordId, success: false });
      }
    } catch (err) {
      stats.failed += 1;
      const msg = err instanceof Error ? err.message : String(err);
      stats.failures.push({ recordId: input.record.recordId, error: msg });
      perRecord.push({ recordId: input.record.recordId, success: false });
    }
  }

  return { stats, perRecord };
}
```

- [ ] **Step 3: Type-check**

Run: `cd jeeves/server && npx tsc --noEmit`
Expected: no errors. If `runKakaoSend` import path or signature differs, adjust to match Step 1 findings.

- [ ] **Step 4: Commit**

```bash
git add jeeves/server/plugins/payment-reminder/sender.ts
git commit -m "feat(payment-reminder): batch sender wrapping kakao-send engine"
```

---

### Task 14: payment-reminder/pipeline.ts + routes.ts

**Files:**
- Create: `jeeves/server/plugins/payment-reminder/pipeline.ts`
- Create: `jeeves/server/plugins/payment-reminder/routes.ts`

- [ ] **Step 1: Create pipeline.ts**

`jeeves/server/plugins/payment-reminder/pipeline.ts`:
```typescript
import { fetchUnpaid, markAsRequested, formatYearMonth, type UnpaidRecord } from './airtable';
import { buildMessage } from './message';
import { sendBatch } from './sender';
import { loadConfig } from './config';

export interface PreviewItem {
  recordId: string;
  name: string;
  bizNo: string;
  amount: number;
  message: string;
}

export interface PreviewResult {
  yearMonth: string;
  targets: PreviewItem[];
}

export async function buildPreview(now: Date = new Date()): Promise<PreviewResult> {
  const cfg = loadConfig();
  const records = await fetchUnpaid(cfg, now);
  const yearMonth = formatYearMonth(now);
  const targets = records.map((r) => ({
    recordId: r.recordId,
    name: r.name,
    bizNo: r.bizNo,
    amount: r.amount,
    message: buildMessage(r, { yearMonth, bankAccount: cfg.bankAccount }),
  }));
  return { yearMonth, targets };
}

export interface SendRequest {
  recordIds: string[];
  isStopped: () => boolean;
  log: (msg: string) => void;
}

export async function sendSelected(req: SendRequest, now: Date = new Date()) {
  const cfg = loadConfig();
  const records: UnpaidRecord[] = await fetchUnpaid(cfg, now);
  const idSet = new Set(req.recordIds);
  const selected = records.filter((r) => idSet.has(r.recordId));
  const yearMonth = formatYearMonth(now);

  const inputs = selected.map((record) => ({
    record,
    message: buildMessage(record, { yearMonth, bankAccount: cfg.bankAccount }),
  }));

  const { stats, perRecord } = await sendBatch(inputs, req.isStopped, req.log);

  for (const r of perRecord) {
    if (r.success) {
      try {
        await markAsRequested(r.recordId, cfg);
      } catch (err) {
        req.log(`[payment-reminder] markAsRequested failed for ${r.recordId}: ${err instanceof Error ? err.message : err}`);
      }
    }
  }

  return { stats, yearMonth };
}
```

- [ ] **Step 2: Create routes.ts**

`jeeves/server/plugins/payment-reminder/routes.ts`:
```typescript
import type { Express } from 'express';
import type { ServerContext } from '../types';
import { buildPreview, sendSelected } from './pipeline';

let stopFlag = false;

export function registerPaymentReminderRoutes(app: Express, ctx: ServerContext): void {
  app.get('/api/payment-reminder/preview', async (_req, res) => {
    try {
      const result = await buildPreview();
      res.json(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      ctx.logError(`[payment-reminder] preview failed: ${msg}`);
      res.status(500).json({ error: msg });
    }
  });

  app.post('/api/payment-reminder/send', async (req, res) => {
    const recordIds: string[] = Array.isArray(req.body?.recordIds) ? req.body.recordIds : [];
    if (recordIds.length === 0) {
      res.status(400).json({ error: 'recordIds required' });
      return;
    }
    stopFlag = false;
    try {
      const result = await sendSelected({
        recordIds,
        isStopped: () => stopFlag,
        log: (m) => ctx.log(`[payment-reminder] ${m}`),
      });
      res.json(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      ctx.logError(`[payment-reminder] send failed: ${msg}`);
      res.status(500).json({ error: msg });
    }
  });

  app.post('/api/payment-reminder/stop', (_req, res) => {
    stopFlag = true;
    res.json({ stopped: true });
  });
}
```

- [ ] **Step 3: Type-check**

Run: `cd jeeves/server && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add jeeves/server/plugins/payment-reminder/pipeline.ts jeeves/server/plugins/payment-reminder/routes.ts
git commit -m "feat(payment-reminder): preview/send/stop pipeline + routes"
```

---

### Task 15: payment-reminder/index.ts + 등록

**Files:**
- Create: `jeeves/server/plugins/payment-reminder/index.ts`
- Modify: `jeeves/server/plugins/index.ts`

- [ ] **Step 1: Create index.ts**

`jeeves/server/plugins/payment-reminder/index.ts`:
```typescript
import type { MacroPlugin } from '../types';
import { registerPaymentReminderRoutes } from './routes';

export const paymentReminderPlugin: MacroPlugin = {
  id: 'payment-reminder',
  name: '미수업체 입금요청 카톡 (익월 10일)',
  icon: '💬',
  status: 'ready',
  registerRoutes: registerPaymentReminderRoutes,
  // 의도적으로 schedule 미설정 — 사람 검토 필수, 수동 트리거만
};
```

- [ ] **Step 2: Register plugin**

In `jeeves/server/plugins/index.ts`, add the import and entry:
```typescript
import { paymentReminderPlugin } from './payment-reminder';
// ... in the plugins array:
//   ..., paymentReminderPlugin,
```

- [ ] **Step 3: Type-check**

Run: `cd jeeves/server && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add jeeves/server/plugins/payment-reminder/index.ts jeeves/server/plugins/index.ts
git commit -m "feat(payment-reminder): register plugin"
```

---

### Task 16: 클라이언트 PaymentReminderPage

**Files:**
- Create: `jeeves/client/src/plugins/payment-reminder/index.ts`
- Create: `jeeves/client/src/plugins/payment-reminder/PaymentReminderPage.tsx`
- Create: `jeeves/client/src/plugins/payment-reminder/components/TargetTable.tsx`
- Create: `jeeves/client/src/plugins/payment-reminder/components/MessagePreview.tsx`
- Modify: `jeeves/client/src/plugins/index.tsx`

- [ ] **Step 1: Inspect existing client patterns**

Run: `cat jeeves/client/src/plugins/index.tsx`
Identify: registry shape; reuse one of the existing entries as a template.

- [ ] **Step 2: TargetTable component**

`jeeves/client/src/plugins/payment-reminder/components/TargetTable.tsx`:
```typescript
interface Target {
  recordId: string;
  name: string;
  bizNo: string;
  amount: number;
}

interface Props {
  targets: Target[];
  selected: Set<string>;
  onToggle: (recordId: string) => void;
  onToggleAll: (checked: boolean) => void;
}

export function TargetTable({ targets, selected, onToggle, onToggleAll }: Props) {
  const allChecked = targets.length > 0 && targets.every((t) => selected.has(t.recordId));
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-muted border-b border-border">
          <tr>
            <th className="text-left py-2 w-8">
              <input
                type="checkbox"
                checked={allChecked}
                onChange={(e) => onToggleAll(e.target.checked)}
              />
            </th>
            <th className="text-left">거래처</th>
            <th className="text-left">사업자번호</th>
            <th className="text-right">기장료</th>
          </tr>
        </thead>
        <tbody>
          {targets.map((t) => (
            <tr key={t.recordId} className="border-b border-border/50">
              <td className="py-2">
                <input
                  type="checkbox"
                  checked={selected.has(t.recordId)}
                  onChange={() => onToggle(t.recordId)}
                />
              </td>
              <td>{t.name}</td>
              <td>{t.bizNo}</td>
              <td className="text-right">{t.amount.toLocaleString('ko-KR')}원</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 3: MessagePreview component**

`jeeves/client/src/plugins/payment-reminder/components/MessagePreview.tsx`:
```typescript
interface Props {
  message: string;
  recipientName: string;
}

export function MessagePreview({ message, recipientName }: Props) {
  return (
    <div className="bg-surface2 border border-border rounded-lg p-4">
      <div className="text-xs text-muted mb-2">대상: {recipientName}</div>
      <pre className="whitespace-pre-wrap text-sm font-sans">{message}</pre>
    </div>
  );
}
```

- [ ] **Step 4: PaymentReminderPage**

`jeeves/client/src/plugins/payment-reminder/PaymentReminderPage.tsx`:
```typescript
import { useCallback, useEffect, useState } from 'react';
import { useApi } from '../../core/hooks/useApi';
import { TargetTable } from './components/TargetTable';
import { MessagePreview } from './components/MessagePreview';

interface Preview {
  yearMonth: string;
  targets: Array<{
    recordId: string;
    name: string;
    bizNo: string;
    amount: number;
    message: string;
  }>;
}

interface SendStats {
  stats: { total: number; success: number; failed: number; skipped: number };
  yearMonth: string;
}

export function PaymentReminderPage() {
  const api = useApi();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<SendStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadPreview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const p = await api.get<Preview>('/payment-reminder/preview');
      setPreview(p);
      setSelected(new Set(p.targets.map((t) => t.recordId)));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => { void loadPreview(); }, [loadPreview]);

  const onToggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const onToggleAll = (checked: boolean) => {
    if (!preview) return;
    setSelected(checked ? new Set(preview.targets.map((t) => t.recordId)) : new Set());
  };

  const onSend = async () => {
    if (!preview || selected.size === 0) return;
    if (!confirm(`선택된 ${selected.size}건에게 카톡을 발송합니다. 계속하시겠습니까?`)) return;
    setSending(true);
    setError(null);
    try {
      const r = await api.post<SendStats>('/payment-reminder/send', {
        recordIds: Array.from(selected),
      });
      setResult(r);
      await loadPreview();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  };

  const firstSelected = preview?.targets.find((t) => selected.has(t.recordId));

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h2 className="text-lg font-bold">💬 미수업체 입금요청 카톡 (익월 10일)</h2>
        <p className="text-sm text-muted mt-1">
          Airtable 수수료 테이블 [전월] 뷰에서 출금상태=출금실패 거래처에 입금요청 카톡 발송
        </p>
      </div>

      <div className="flex gap-2 items-center">
        <button
          onClick={loadPreview}
          disabled={loading}
          className="px-3 py-1 border border-border rounded"
        >
          {loading ? '불러오는 중…' : '미리보기 새로고침'}
        </button>
        {preview && (
          <span className="text-sm text-muted">
            대상 월: <strong>{preview.yearMonth}</strong> · 총 {preview.targets.length}건
          </span>
        )}
      </div>

      {error && <div className="text-danger text-sm">{error}</div>}

      {preview && (
        <div className="bg-surface border border-border rounded-xl p-5 space-y-3">
          <h3 className="font-bold text-sm">대상 거래처 (선택 {selected.size}건)</h3>
          <TargetTable
            targets={preview.targets}
            selected={selected}
            onToggle={onToggle}
            onToggleAll={onToggleAll}
          />
        </div>
      )}

      {firstSelected && (
        <div>
          <h3 className="font-bold text-sm mb-2">멘트 미리보기 (첫 선택 거래처 기준)</h3>
          <MessagePreview message={firstSelected.message} recipientName={firstSelected.name} />
        </div>
      )}

      <div>
        <button
          onClick={onSend}
          disabled={sending || selected.size === 0}
          className="px-4 py-2 bg-accent text-white rounded font-bold disabled:opacity-40"
        >
          {sending ? '발송 중…' : `발송 (선택 ${selected.size}건)`}
        </button>
      </div>

      {result && (
        <div className="bg-surface border border-border rounded-xl p-5 text-sm">
          <h3 className="font-bold mb-2">발송 결과</h3>
          <div>월: {result.yearMonth}</div>
          <div>총 {result.stats.total}건 / 성공 {result.stats.success} / 실패 {result.stats.failed} / 건너뜀 {result.stats.skipped}</div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: index.ts**

`jeeves/client/src/plugins/payment-reminder/index.ts`:
```typescript
export { PaymentReminderPage } from './PaymentReminderPage';
```

- [ ] **Step 6: Register in client plugins index**

In `jeeves/client/src/plugins/index.tsx`, follow the same shape used by `thebill-sync` registration to add a `payment-reminder` entry pointing to `PaymentReminderPage`.

- [ ] **Step 7: Build client**

Run: `cd jeeves/client && npm run build`
Expected: build succeeds

- [ ] **Step 8: Commit**

```bash
git add jeeves/client/src/plugins/payment-reminder/ jeeves/client/src/plugins/index.tsx
git commit -m "feat(payment-reminder): client preview + send UI"
```

---

## Phase D: 통합 검증

### Task 17: 수동 검증 체크리스트

> 셀렉터·필드명 확정과 실제 환경 검증을 한 번에 수행. 코드 변경이 발생하면 별도 commit.

- [ ] **Step 1: 환경변수 설정**

Edit `jeeves/server/.env` and fill:
- `AIRTABLE_FEE_PAT`
- `AIRTABLE_FEE_BASE_ID=appGLQdwsGXyeoYji`
- `AIRTABLE_FEE_TABLE_ID=tblghdSYIU17yLg6d`
- `AIRTABLE_FEE_BIZNO_FIELD` / `AMOUNT_FIELD` / `STATUS_FIELD` / `NAME_FIELD` (실제 컬럼명 확인)
- `PAYMENT_REMINDER_BANK_ACCOUNT=카카오뱅크 / 3333367093297`

- [ ] **Step 2: dev 서버 기동**

```bash
cd jeeves/server && npm run dev
# 별 터미널
cd jeeves/client && npm run dev
```
Open browser → admin UI 두 신규 메뉴 확인:
- `더빌 출금결과 → 에어테이블`
- `더빌 재출금결과 → 에어테이블`
- `미수업체 입금요청 카톡`

- [ ] **Step 3: STEP 2 셀렉터 확정 (withdrawal)**

화면에서 `[실행]` 버튼 클릭 → 실패 시 더빌 CMS 페이지에 직접 접속해 메뉴 sequence 와 selector 확정. 다음을 `scraper.ts` 의 `navigateAndDownload` 함수 `withdrawal` 분기에 채움:
- `[자동이체]` 메뉴 클릭 셀렉터
- `[출금결과조회]` 클릭
- 기간 input field (from/to) selector + 날짜 포맷
- `[조회]` 버튼
- `[엑셀다운로드]` 버튼

확정 후 다시 실행, 엑셀 다운로드 성공 확인.

- [ ] **Step 4: STEP 3 셀렉터 확정 (reWithdrawal)**

같은 방식으로 `[자동이체] [회원상태/출금설정]` 메뉴 selector 확정.

- [ ] **Step 5: parser 검증**

다운로드된 엑셀 한 건을 console 에서 직접 파싱해보고:
- 사업자번호 컬럼명이 `HEADER_CANDIDATES.bizNo` 후보 중 하나인지 확인
- 상태 값들이 `classifyStatus` 의 `성공/실패` 매칭에 잡히는지 확인
- 다르면 `parser.ts` 의 후보 배열 또는 `classifyStatus` 키워드 추가 후 commit

- [ ] **Step 6: Airtable 매칭 검증**

UI에서 STEP 2 실행 → Airtable `[N월]` 뷰 확인:
- 출금성공 행 N건의 출금상태가 `출금성공`
- 실패 행 N건의 출금상태가 `자동재출금`
- 사업자번호 매칭 실패 건이 있다면 더빌 사업자번호 vs Airtable 사업자번호 포맷 차이 확인 (parser.normalizeBizNo 로 충분한지)

- [ ] **Step 7: STEP 4 미리보기 검증**

`/payment-reminder` 화면 → preview 호출:
- 대상 거래처 리스트가 Airtable `[전월]` 뷰의 출금실패 행과 일치하는지
- 멘트가 의도한 형태로 출력되는지

- [ ] **Step 8: STEP 4 발송 (1~2건 테스트)**

Airtable 에서 본인 명의 테스트 거래처를 한두 개 출금실패 상태로 임시 변경 → UI에서 1~2건만 선택 → 발송:
- 카카오톡 PC앱이 정상 메시지 전송했는지
- 발송 성공 후 Airtable 상태가 `입금요청` 으로 변경됐는지
- 실패 시 상태 그대로 유지인지

- [ ] **Step 9: Slack 알림 검증**

각 작업의 Slack 채널 알림이 도착하는지 확인.

- [ ] **Step 10: 자동 schedule 활성화 결정**

문제없이 검증되면 admin UI 의 `스케줄 설정` 에서 STEP 2/3 자동 cron 활성화. STEP 4 는 자동 활성화하지 않음 (사람 검토 필수).

- [ ] **Step 11: Final commit (검증 중 수정 사항)**

```bash
git status
git add <changed files>
git commit -m "fix(thebill,payment-reminder): finalize selectors + field names from manual verification"
```

---

## 검증 완료 후

- 스펙 [확인필요] 6개 항목이 모두 코드/환경변수에 반영됐는지 확인
- README 또는 운영 메모에 매월 일정(26일 / 25+8영업일 / 익월 10일) 명시
- 1년 후 `holidays.ts` 갱신 알림 (또는 next-year 자동 fallback 추가)
