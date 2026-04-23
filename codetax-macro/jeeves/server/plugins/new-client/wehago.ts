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
  // WEHAGO common dialog (commonDlg209 etc.) close icons
  '[class*="commonDlg"] [class*="close"]',
  '[class*="commonDlg"] button[class*="ico"]',
  '[class*="commonDlg"] [class*="btn_x"]',
];

// WEHAGO pre-renders 수임처 생성 방식 + 수임처 신규생성 modals as hidden DOM
// with commonDlg* classes. If we blindly set display:none inline, these
// modals can never open (inline style overrides class-based toggle). Hide
// only what's currently rendered-visible.
async function forceHideCommonDialogs(page: Page, log: (m: string) => void): Promise<void> {
  const hidden = await page.evaluate(() => {
    const selectors = '[class*="commonDlg"], [class*="dialog_data_area"]';
    let count = 0;
    document.querySelectorAll(selectors).forEach((el) => {
      const h = el as HTMLElement;
      if (h.offsetWidth === 0 && h.offsetHeight === 0) return; // not visible now
      h.style.display = 'none';
      h.style.pointerEvents = 'none';
      count++;
    });
    return count;
  }).catch(() => 0);
  if (hidden > 0) log(`[wehago] force-hid ${hidden} visible commonDlg overlay(s)`);
}

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
  const combinedClose = POPUP_CLOSE_SELECTORS.join(', ');
  let totalDismissed = 0;

  // One-shot pass on "don't show again" labels — ticks checkboxes so these
  // popups won't reappear next session. No retry loop here (the main loop
  // handles closing what's visible now).
  for (const label of SUPPRESS_CHECKBOX_LABELS) {
    const loc = page.getByText(label, { exact: true }).first();
    if (await loc.isVisible().catch(() => false)) {
      await loc.click({ timeout: 500 }).catch(() => {});
    }
  }

  for (let round = 0; round < 10; round++) {
    if (Date.now() - start > 10_000) break;

    // Hide any commonDlg overlays at the TOP of each round so subsequent
    // clicks aren't intercepted.
    await forceHideCommonDialogs(page, log);

    let clickedThisRound = 0;

    // Single-pass scan across all close selectors via one locator query,
    // then click each visible one with an aggressive timeout.
    const els = await page.locator(combinedClose).all().catch(() => []);
    for (const el of els) {
      const visible = await el.isVisible().catch(() => false);
      if (!visible) continue;
      await el.click({ timeout: 500, force: false }).catch(() => {});
      clickedThisRound++;
      totalDismissed++;
    }

    // Escape once per round — cheap and often closes modals without a
    // recognizable close button.
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(250);

    if (clickedThisRound === 0) break; // stable
  }
  if (totalDismissed > 0) log(`[wehago] dismissed ${totalDismissed} popup(s) in ${Date.now() - start}ms`);

  // Final sweep in case anything re-appeared after last check.
  await forceHideCommonDialogs(page, log);
}

/**
 * WEHAGO custom dropdown. text span 은 click 이 부모 div 에 걸려 있어서
 * 부모를 클릭해야 열림. 옵션은 열린 뒤 새로 나타나는 text 를 직접 클릭.
 */
async function selectCustomDropdown(
  page: Page,
  currentText: string,
  targetText: string,
  log: (m: string) => void,
  labelHint: string,
): Promise<void> {
  if (currentText === targetText) {
    log(`[wehago] ${labelHint} already at "${targetText}"`);
    return;
  }
  const trigger = page.getByText(currentText, { exact: true }).first().locator('xpath=..');
  await trigger.click({ timeout: 3000 });
  await page.waitForTimeout(400);
  await page.getByText(targetText, { exact: true }).first().click({ timeout: 3000 });
  await page.waitForTimeout(200);
  log(`[wehago] ${labelHint}: ${currentText} → ${targetText}`);
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
  // force: true — WEHAGO 의 commonDlg209 래퍼가 actionability 검사에서
  // intercept 로 잡혀 기본 click 이 timeout 됨. 실제 브라우저 이벤트는 정상
  // 전파되므로 force 로 검사 건너뛰는 게 가장 안정적.
  await page.getByRole('button', { name: /새 수임처/ }).first().click({ force: true });
  await page.waitForTimeout(800);

  log('[wehago] selecting 신규 회사로 생성');
  await page.getByText('신규 회사로 생성').first().click({ force: true });
  await page.waitForTimeout(800);

  // Wait for the 수임처 신규생성 modal heading so subsequent fills see a
  // fully-rendered form (and popup animations are done).
  await page.waitForSelector('text=수임처 신규생성', { timeout: 10_000 });
  await page.waitForTimeout(800);

  log(`[wehago] filling form — companyName=${form.companyName}, entityType=${form.entityType}, scope=${form.scope}`);
  log(`[wehago]   representative=${form.representative}, bizRegNumber=${form.bizRegNumber}, industry=${form.industry ?? '-'}`);

  // Helper — fill by placeholder substring. WEHAGO renders both a sidebar/list
  // row template AND the 수임처 신규생성 modal input with the same placeholder;
  // :visible can catch both. The modal is appended later in DOM, so .last()
  // reliably targets the modal form. Additionally scope to the modal container
  // when possible for extra safety.
  const modal = page.locator('text=수임처 신규생성').locator('xpath=ancestor::*[contains(@class, "Dlg") or contains(@class, "dialog") or contains(@class, "popup") or contains(@class, "modal")][1]');
  const modalExists = (await modal.count()) > 0;

  const fillByPlaceholder = async (placeholderHint: string, value: string, label: string): Promise<void> => {
    if (!value) {
      log(`[wehago]   skip ${label} — empty value`);
      return;
    }
    try {
      // Prefer scoping to modal; fall back to page-level .last() if we can't
      // resolve the modal ancestor.
      const scope = modalExists ? modal : page;
      const locator = scope.locator(`input[placeholder*="${placeholderHint}"]:visible`);
      const count = await locator.count();
      if (count === 0) {
        const anyCount = await page.locator(`input[placeholder*="${placeholderHint}"]`).count();
        log(`[wehago]   ✗ ${label}: no visible input in modal matching "${placeholderHint}" (DOM total: ${anyCount})`);
        return;
      }
      const input = locator.last(); // modal input is latest-rendered
      await input.click({ force: true, timeout: 2_000 }).catch(() => {});
      // pressSequentially emits keydown/keypress/input per character → React
      // controlled-inputs and masked inputs (예: 사업자등록번호 XXX-XX-XXXXX)
      // reliably register. fill() alone is often silently overwritten.
      await input.clear({ timeout: 2_000 }).catch(() => {});
      await input.pressSequentially(value, { delay: 15 });
      log(`[wehago]   ✓ ${label} = ${value} (match=${count}, scope=${modalExists ? 'modal' : 'page'})`);
    } catch (e: any) {
      log(`[wehago]   ✗ ${label} 실패: ${e.message}`);
    }
  };

  await fillByPlaceholder('회사명', form.companyName, '수임처명');

  // 회사구분 — change only when target differs from default.
  try {
    await selectCustomDropdown(page, '0.법인사업자', form.entityType, log, '회사구분');
  } catch (e: any) {
    log(`[wehago]   ✗ 회사구분 실패: ${e.message}`);
  }

  await fillByPlaceholder('대표자명', form.representative, '대표자명');
  // 사업자등록번호 / 법인등록번호 는 hyphen 을 mask 가 자동 삽입 — 숫자만 입력.
  await fillByPlaceholder('사업자등록번호', form.bizRegNumber.replace(/-/g, ''), '사업자등록번호');

  if (form.corpRegNumber) {
    await fillByPlaceholder('법인등록번호', form.corpRegNumber.replace(/-/g, ''), '법인등록번호');
  }
  if (form.bizAddress) {
    await fillByPlaceholder('나머지 주소', form.bizAddress, '사업장주소');
  }
  if (form.industry) {
    await fillByPlaceholder('업종을', form.industry, '업종');
  }

  // 서비스 제공형태 — default 0.기장; only click when different.
  try {
    await selectCustomDropdown(page, '0.기장', form.scope, log, '서비스 제공형태');
  } catch (e: any) {
    log(`[wehago]   ✗ 서비스 제공형태 실패: ${e.message}`);
  }

  // 개업년월일 — label-proximity, best effort.
  if (form.openDate) {
    const openDateFormatted = form.openDate.replace(/-/g, '.');
    try {
      const openDateInput = page.locator('text=개업년월일').locator('..').locator('input').first();
      await openDateInput.fill(openDateFormatted, { timeout: 3_000 });
      log(`[wehago]   ✓ 개업년월일 = ${openDateFormatted}`);
    } catch (e: any) {
      log(`[wehago]   ✗ 개업년월일 실패: ${e.message}`);
    }
  }

  // Auto-submit is disabled for safety — the user should review the populated
  // form and click [수임처 생성] themselves. Once automation stabilizes we can
  // re-enable this.
  log('[wehago] form populated — user should review and click [수임처 생성]');
  return { ok: true, companyName: form.companyName };
}

export async function closeWehagoSession(): Promise<void> {
  if (sessionBrowser) {
    await sessionBrowser.close().catch(() => {});
  }
  sessionBrowser = null;
  sessionPage = null;
}
