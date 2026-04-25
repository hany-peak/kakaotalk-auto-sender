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
