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

// 더빌 CMS 셀렉터는 thebill_probe.ts 결과로 확정 (2026-04-26).
// 페이지 전환은 SPA 식 `$.loadContent(...)` AJAX 라 navigation 이 발생하지 않음.
// 페이지가 바뀌었는지는 입력 필드 등장 여부로 판정.
async function ensureLoggedIn(page: Page, ctx: ServerContext): Promise<void> {
  const cfg = loadConfig();
  await page.goto(cfg.cmsLoginUrl, { waitUntil: 'domcontentloaded' });

  const onLoginForm = await page.locator('#loginpw').isVisible().catch(() => false);

  if (!onLoginForm) {
    ctx.log('[thebill-sync] existing session valid');
    return;
  }

  ctx.log('[thebill-sync] logging in...');
  await page.locator('#loginid').fill(cfg.cmsUsername);
  await page.locator('#loginpw').fill(cfg.cmsPassword);
  await Promise.all([
    page.waitForLoadState('domcontentloaded').catch(() => {}),
    page.locator('#btnLogin').click(),
  ]);

  // 로그인 후 기본 진입 화면(정산관리 등)에서 #loginpw 가 사라지는지로 성공 판정.
  await page.waitForTimeout(1500);
  const stillOnLogin = await page.locator('#loginpw').isVisible().catch(() => false);
  if (stillOnLogin) {
    throw new Error('CMS login failed - credentials rejected or CAPTCHA required');
  }
  ctx.log(`[thebill-sync] login success: ${page.url()}`);
}

// `text=자동이체` 클릭 후 좌측 sub-menu 가 렌더링될 때까지 대기.
async function openCmsModule(page: Page, ctx: ServerContext): Promise<void> {
  ctx.log('[thebill-sync] open [자동이체] module');
  await page.getByText('자동이체', { exact: true }).first().click({ timeout: 10_000 });
  // 자동이체 모듈 left-nav 의 대표 메뉴들이 보이면 진입 완료로 판정.
  await page
    .getByText('출금결과조회', { exact: true })
    .first()
    .waitFor({ state: 'visible', timeout: 10_000 });
}

async function navigateAndDownload(
  page: Page,
  ctx: ServerContext,
  opts: ScrapeOptions,
): Promise<string> {
  await openCmsModule(page, ctx);

  if (opts.mode === 'withdrawal') {
    ctx.log('[thebill-sync] mode=withdrawal — [출금결과조회]');
    await page.getByText('출금결과조회', { exact: true }).first().click({ timeout: 10_000 });
    // AJAX 로 폼이 들어올 때까지 wait.
    await page.locator('#startDate').waitFor({ state: 'visible', timeout: 15_000 });

    const fromStr = fmt(opts.from);
    const toStr = fmt(opts.to);
    ctx.log(`[thebill-sync] period: ${fromStr} ~ ${toStr}`);

    // jQuery datepicker 가 hyphen-format 을 받아들임 (input 직접 fill).
    // datepicker popup 이 자동으로 뜰 수 있어 fill 후 Escape 로 닫음.
    await page.locator('#startDate').fill(fromStr);
    await page.keyboard.press('Escape').catch(() => {});
    await page.locator('#endDate').fill(toStr);
    await page.keyboard.press('Escape').catch(() => {});

    // 상태=전체 (셀렉트 첫 옵션) — statusCd 는 그대로 두고 조회.
    await page.locator('input[type="button"][value="조회"]').first().click({ timeout: 5_000 });
    // 그리드 갱신 대기 (조회 결과 로딩).
    await page.waitForTimeout(2000);
  } else {
    ctx.log('[thebill-sync] mode=reWithdrawal — [회원상태/출금설정]');
    // 회원상태/출금설정 페이지는 기간 필터가 없음 — 회원 상태 스냅샷 뷰.
    // statusCd* 체크박스로 출금실패/재출금 등 status 를 골라야 정확하지만,
    // 우선은 기본 조회(전체)로 받고 parser/airtable 단계에서 분류.
    // 필요 시 statusCd34, statusCd35 등 체크박스 활성화 로직 추가.
    await page.getByText('회원상태/출금설정', { exact: true }).first().click({ timeout: 10_000 });
    await page.locator('input[name="statusCdAll"]').waitFor({ state: 'visible', timeout: 15_000 });
    await page.locator('input[type="button"][value="조회"]').first().click({ timeout: 5_000 });
    await page.waitForTimeout(2000);
  }

  ctx.log('[thebill-sync] downloading excel...');
  const downloadPromise = page.waitForEvent('download', { timeout: 60_000 });
  await page.locator('input[type="button"][value="엑셀다운로드"]').first().click({ timeout: 5_000 });
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
