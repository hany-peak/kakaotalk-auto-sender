import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { chromium, Browser, BrowserContext, Page } from 'playwright';
import type { ServerContext } from '../types';
import { loadConfig, STATE_FILE } from './config';

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

export async function downloadResult(ctx: ServerContext): Promise<string> {
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });

  let browser: Browser | null = null;
  let context: BrowserContext | null = null;
  try {
    browser = await chromium.launch({ headless: true });
    const contextOpts = fs.existsSync(STATE_FILE)
      ? { storageState: STATE_FILE }
      : {};
    context = await browser.newContext({
      acceptDownloads: true,
      ...contextOpts,
    });
    const page = await context.newPage();

    await ensureLoggedIn(page, ctx);

    // TODO: navigate to 출글 결과 page — selector to be confirmed on first run
    // Placeholder: user must adjust selectors to match actual CMS markup
    ctx.log('[thebill-sync] navigating to result page');
    // await page.click('text=출글 결과');

    ctx.log('[thebill-sync] waiting for download...');
    const downloadPromise = page.waitForEvent('download', { timeout: 60_000 });
    // await page.click('text=엑셀 다운로드');
    const download = await downloadPromise;

    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const savePath = path.join(os.tmpdir(), `thebill_result_${ts}.xlsx`);
    await download.saveAs(savePath);
    ctx.log(`[thebill-sync] downloaded: ${savePath}`);

    await context.storageState({ path: STATE_FILE });
    return savePath;
  } finally {
    await context?.close().catch(() => {});
    await browser?.close().catch(() => {});
  }
}
