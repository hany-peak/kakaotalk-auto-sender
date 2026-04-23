import { chromium, type Browser, type Page } from 'playwright';
import type { NewClientConfig } from './config';
import type { BusinessScope, EntityType, NewClientRecord } from './types';

// ============================================================================
// Pure functions — Airtable/Jeeves values → WEHAGO dropdown values
// ============================================================================

/** WEHAGO 회사구분 드롭다운 값. */
export function wehagoEntityTypeValue(e: EntityType | undefined): '0.법인사업자' | '1.개인사업자' {
  return e === '법인' ? '0.법인사업자' : '1.개인사업자';
}

/** WEHAGO 서비스 제공형태 드롭다운 값. */
export function wehagoScopeValue(s: BusinessScope): '0.기장' | '1.신고대리' | '2.기타' {
  if (s === '기장') return '0.기장';
  if (s === '신고대리') return '1.신고대리';
  return '2.기타';
}

/** 기수 회계기간 시작일(연도 1/1) 계산. 개업일 연도 기준, 없으면 현재 연도. */
export function fiscalYearStart(openDate: string | undefined): string {
  const year = openDate && /^\d{4}/.test(openDate) ? openDate.slice(0, 4) : String(new Date().getFullYear());
  return `${year}.01.01`;
}

/** 기수 회계기간 종료일(연도 12/31). */
export function fiscalYearEnd(openDate: string | undefined): string {
  const year = openDate && /^\d{4}/.test(openDate) ? openDate.slice(0, 4) : String(new Date().getFullYear());
  return `${year}.12.31`;
}

export interface WehagoFormValues {
  companyName: string;
  entityType: '0.법인사업자' | '1.개인사업자';
  representative: string;
  bizRegNumber: string;       // 사업자등록번호 — 필수
  corpRegNumber?: string;     // 법인등록번호 — 법인 only
  bizAddress?: string;
  bizPhone?: string;
  industry?: string;          // 업종 텍스트
  scope: '0.기장' | '1.신고대리' | '2.기타';
  startDate: string;          // 수임일자 (YYYY-MM-DD)
  openDate?: string;          // 개업년월일 (YYYY-MM-DD)
  fiscalStart: string;        // YYYY.MM.DD
  fiscalEnd: string;          // YYYY.MM.DD
  personnelYear: string;      // 인사연도 (YYYY)
}

/** NewClientRecord → WEHAGO form 값. 필수 필드 누락 시 Error throw. */
export function buildWehagoForm(record: NewClientRecord): WehagoFormValues {
  if (!record.bizRegNumber) {
    throw new Error('사업자등록번호 누락 — Airtable 사업자번호 필드 확인');
  }
  const year = record.openDate && /^\d{4}/.test(record.openDate)
    ? record.openDate.slice(0, 4)
    : String(new Date().getFullYear());
  return {
    companyName: record.companyName,
    entityType: wehagoEntityTypeValue(record.entityType),
    representative: record.representative,
    bizRegNumber: record.bizRegNumber,
    corpRegNumber: record.entityType === '법인' ? record.corpRegNumber : undefined,
    bizAddress: record.bizAddress,
    bizPhone: record.bizPhone,
    industry: record.industry,
    scope: wehagoScopeValue(record.businessScope),
    startDate: record.startDate,
    openDate: record.openDate,
    fiscalStart: fiscalYearStart(record.openDate),
    fiscalEnd: fiscalYearEnd(record.openDate),
    personnelYear: year,
  };
}

// ============================================================================
// Credentials / session
// ============================================================================

export interface WehagoCreds {
  loginUrl: string;
  username: string;
  password: string;
}

export function extractWehagoCreds(cfg: NewClientConfig): WehagoCreds | null {
  const w = cfg.wehago;
  if (!w.username || !w.password) return null;
  return { loginUrl: w.loginUrl, username: w.username, password: w.password };
}

// ============================================================================
// Playwright automation
// ============================================================================

let sessionBrowser: Browser | null = null;
let sessionPage: Page | null = null;

async function ensureBrowser(): Promise<Page> {
  if (sessionBrowser && sessionPage && !sessionPage.isClosed()) return sessionPage;
  try {
    sessionBrowser = await chromium.launch({ headless: false, channel: 'chrome' });
  } catch {
    sessionBrowser = await chromium.launch({ headless: false });
  }
  const ctx = await sessionBrowser.newContext({ acceptDownloads: true });
  sessionPage = await ctx.newPage();
  sessionBrowser.on('disconnected', () => {
    sessionBrowser = null;
    sessionPage = null;
  });
  return sessionPage;
}

async function isLoggedIn(page: Page): Promise<boolean> {
  // WEHAGO main page shows "담당 수임처" when logged in.
  try {
    const loc = page.locator('text=담당 수임처').first();
    const count = await loc.count();
    return count > 0;
  } catch {
    return false;
  }
}

async function pollLoggedIn(page: Page, timeoutMs: number): Promise<boolean> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await isLoggedIn(page)) return true;
    await page.waitForTimeout(1000);
  }
  return false;
}

async function login(page: Page, creds: WehagoCreds, log: (m: string) => void): Promise<void> {
  log(`[wehago] navigating to https://www.wehago.com/`);
  await page.goto('https://www.wehago.com/', { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.waitForTimeout(1500);

  if (await pollLoggedIn(page, 2_000)) {
    log('[wehago] already logged in (session reused)');
    return;
  }

  // Landing page shows a "로그인" link (id=login) that opens the login form.
  log('[wehago] opening login form');
  await page.locator('#login').click();
  await page.waitForSelector('#inputId', { timeout: 15_000 });

  log('[wehago] filling credentials');
  await page.locator('#inputId').fill(creds.username);
  await page.locator('#inputPw').fill(creds.password);
  await page.getByRole('button', { name: '로그인', exact: true }).click();

  if (!(await pollLoggedIn(page, 45_000))) {
    await page.screenshot({ path: '/tmp/wehago-login-fail.png' }).catch(() => {});
    throw new Error('로그인 실패 — ID/PW/CAPTCHA 확인 (/tmp/wehago-login-fail.png 스크린샷 저장)');
  }
  log('[wehago] login successful');
}

// Elements that may represent a "close X" on a popup. Applied in order.
const POPUP_CLOSE_SELECTORS = [
  // Button-form close controls
  'button:has-text("오늘 하루 보지 않기")',
  'button:has-text("오늘하루 보지 않기")',
  'button:has-text("하루 동안 보지 않기")',
  'button:has-text("하루동안 보지 않기")',
  'button:has-text("다시 보지 않기")',
  'button:has-text("닫기")',
  'button:has-text("확인")',   // 알림 confirm-style modals
  // Aria + class-based X icons
  '[aria-label="닫기"]',
  '[aria-label="close"]',
  '[aria-label="Close"]',
  '.popup-close',
  '.btn-close',
  '.closeBtn',
  '[class*="btn_close"]',
  '[class*="btnClose"]',
  '[class*="close-btn"]',
  '[class*="popup_close"]',
  '[class*="ico_close"]',
];

// Labels for "don't show again" checkboxes — click to suppress on next login.
const SUPPRESS_CHECKBOX_LABELS = [
  '하루 동안 보지 않기',
  '하루동안 보지 않기',
  '오늘 하루 보지 않기',
  '오늘하루 보지 않기',
  '다시 보지 않기',
];

/**
 * Loop-based dismissal — WEHAGO stacks multiple popups sequentially (공지,
 * 이벤트, 광고, etc.), each appearing only after the previous is closed.
 * Scan + click one round → wait → repeat until no visible close button is
 * found. Safety cap: max 20 rounds or 20s elapsed.
 */
async function dismissPopups(page: Page, log: (m: string) => void): Promise<void> {
  const start = Date.now();
  let totalDismissed = 0;

  for (let round = 0; round < 25; round++) {
    if (Date.now() - start > 30_000) break;
    let clickedThisRound = 0;

    // 1) Tick "don't show again" checkboxes first so they won't come back.
    for (const label of SUPPRESS_CHECKBOX_LABELS) {
      const textLoc = page.getByText(label, { exact: false });
      const count = await textLoc.count().catch(() => 0);
      for (let i = 0; i < count; i++) {
        const item = textLoc.nth(i);
        if (!(await item.isVisible().catch(() => false))) continue;
        // Find the associated checkbox: label is a span/label near a checkbox
        // input. Try clicking the label itself first (most label→input pairs
        // react to label click).
        await item.click({ timeout: 1500 }).catch(() => {});
        await page.waitForTimeout(200);
      }
    }

    // 2) Click X close controls.
    for (const sel of POPUP_CLOSE_SELECTORS) {
      const els = await page.locator(sel).all().catch(() => []);
      for (const el of els) {
        if (await el.isVisible().catch(() => false)) {
          await el.click({ timeout: 2000 }).catch(() => {});
          clickedThisRound++;
          totalDismissed++;
          await page.waitForTimeout(400);
        }
      }
    }

    // 3) As a fallback, Escape often dismisses modals.
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(300);

    if (clickedThisRound === 0) break; // stable
  }
  if (totalDismissed > 0) log(`[wehago] dismissed ${totalDismissed} popup(s)`);
}

export interface RegisterResult {
  ok: true;
  companyName: string;
}

/**
 * Register a new 수임처 on WEHAGO T via browser automation.
 * Reuses the singleton browser session (stays logged in across calls).
 * Throws on any failure.
 */
export async function registerWehagoClient(
  record: NewClientRecord,
  creds: WehagoCreds,
  log: (m: string) => void,
): Promise<RegisterResult> {
  if (record.transferStatus === '이관') {
    throw new Error('이관 케이스는 아직 지원하지 않음 (Smart A 백업파일 업로드 필요)');
  }
  const form = buildWehagoForm(record);

  const page = await ensureBrowser();
  await login(page, creds, log);

  // Promotional / notice modals often appear right after login — close them first.
  await dismissPopups(page, log);

  // Click the 전체 tab — the 담당 수임처 view + "새 수임처" button only surface
  // under this tab (not T edge 사용/미사용/개인고객/대시보드).
  log('[wehago] clicking 전체 tab');
  await page.getByText('전체', { exact: true }).first().click({ timeout: 10_000 });
  await page.waitForTimeout(1000);
  await dismissPopups(page, log);

  log('[wehago] clicking 새 수임처');
  await page.getByRole('button', { name: /새 수임처/ }).first().click();

  log('[wehago] selecting 신규 회사로 생성');
  await page.getByText('신규 회사로 생성').first().click();

  // Wait for the 수임처 신규생성 modal.
  log('[wehago] filling form');
  await page.getByPlaceholder('회사명을 입력하세요').fill(form.companyName);
  // 회사구분 드롭다운 - select by label.
  await page.getByLabel('회사구분').selectOption({ label: form.entityType });
  await page.getByPlaceholder('대표자명을 입력하세요').fill(form.representative);
  await page.getByPlaceholder('사업자등록번호를 입력하세').fill(form.bizRegNumber);
  if (form.corpRegNumber) {
    await page.getByPlaceholder('법인등록번호를 입력해주세요.').fill(form.corpRegNumber);
  }
  if (form.bizAddress) {
    await page.getByPlaceholder('나머지 주소를 입력하세요').fill(form.bizAddress);
  }
  if (form.industry) {
    await page.getByPlaceholder('업종을 입력하세요').fill(form.industry);
  }
  await page.getByLabel('서비스 제공형태').selectOption({ label: form.scope });
  if (form.openDate) {
    // 개업년월일 input — date picker. Try direct fill.
    const openDateInput = page.locator('input').filter({ has: page.locator('[placeholder=""]') }).nth(0);
    await openDateInput.fill(form.openDate).catch(() => {
      log('[wehago] 개업년월일 자동 입력 실패 — 수동 확인 필요');
    });
  }

  log('[wehago] submitting');
  await page.getByRole('button', { name: '수임처 생성' }).click();

  // Wait for the modal to disappear as a success signal (poll up to 30s).
  const modal = page.getByText('수임처 신규생성').first();
  const start = Date.now();
  let closed = false;
  while (Date.now() - start < 30_000) {
    if ((await modal.count()) === 0) {
      closed = true;
      break;
    }
    await page.waitForTimeout(1000);
  }
  if (!closed) {
    await page.screenshot({ path: '/tmp/wehago-submit-fail.png' }).catch(() => {});
    throw new Error('수임처 생성 후 모달이 닫히지 않음 — 입력값/검증 확인 (/tmp/wehago-submit-fail.png)');
  }
  log(`[wehago] registration submitted for ${form.companyName}`);

  return { ok: true, companyName: form.companyName };
}

export async function closeWehagoSession(): Promise<void> {
  if (sessionBrowser) {
    await sessionBrowser.close().catch(() => {});
  }
  sessionBrowser = null;
  sessionPage = null;
}
