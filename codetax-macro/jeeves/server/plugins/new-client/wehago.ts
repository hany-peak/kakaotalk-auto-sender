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
    const text = await page.locator('text=담당 수임처').first().textContent({ timeout: 3000 });
    return text !== null && text.includes('수임처');
  } catch {
    return false;
  }
}

async function login(page: Page, creds: WehagoCreds, log: (m: string) => void): Promise<void> {
  log(`[wehago] navigating to ${creds.loginUrl}`);
  await page.goto(creds.loginUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });

  if (await isLoggedIn(page)) {
    log('[wehago] already logged in (session reused)');
    return;
  }

  // Login form selectors — WEHAGO uses placeholder text "아이디" / "비밀번호".
  log('[wehago] filling login form');
  await page.getByPlaceholder('아이디', { exact: false }).first().fill(creds.username, { timeout: 10_000 });
  await page.getByPlaceholder('비밀번호', { exact: false }).first().fill(creds.password);
  await page.getByRole('button', { name: /로그인/ }).first().click();

  // Wait for redirect to main/dashboard.
  await page.waitForLoadState('networkidle', { timeout: 30_000 });
  if (!(await isLoggedIn(page))) {
    throw new Error('로그인 실패 — ID/PW 또는 CAPTCHA 확인');
  }
  log('[wehago] login successful');
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

  // Wait for modal to close / success toast / list refresh.
  await page.waitForLoadState('networkidle', { timeout: 30_000 });
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
