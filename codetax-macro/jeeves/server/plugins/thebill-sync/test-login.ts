/**
 * Standalone login + explore script.
 * Run: cd server && npx tsx plugins/thebill-sync/test-login.ts
 *
 * Opens a visible browser, loads the CMS login URL, fills credentials,
 * and pauses with Playwright Inspector so you can click around and
 * capture selectors for the 미납 금액 page.
 */
import * as path from 'path';
import * as fs from 'fs';
import { chromium } from 'playwright';

const ENV_PATH = path.resolve(__dirname, '../../../.env');
if (fs.existsSync(ENV_PATH)) {
  require('dotenv').config({ path: ENV_PATH });
}

const STATE_FILE = path.resolve(
  __dirname,
  '../../../logs/thebill-sync/state.json',
);

async function main() {
  const url = process.env.THEBILL_CMS_LOGIN_URL;
  const username = process.env.THEBILL_CMS_USERNAME;
  const password = process.env.THEBILL_CMS_PASSWORD;
  if (!url || !username || !password) {
    console.error('Missing THEBILL_CMS_* env vars in .env');
    process.exit(1);
  }

  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });

  const browser = await chromium.launch({ headless: false, slowMo: 200 });
  const contextOpts = fs.existsSync(STATE_FILE)
    ? { storageState: STATE_FILE }
    : {};
  const context = await browser.newContext({
    acceptDownloads: true,
    ...contextOpts,
  });
  const page = await context.newPage();

  console.log(`[test] opening ${url}`);
  await page.goto(url, { waitUntil: 'domcontentloaded' });

  const passwordVisible = await page
    .locator('input[type="password"]')
    .first()
    .isVisible()
    .catch(() => false);

  if (passwordVisible) {
    console.log('[test] login form detected — attempting login');
    try {
      await page
        .locator('input[name="username"], input[name="userId"], input[name="user_id"], input[type="text"]')
        .first()
        .fill(username);
      await page.locator('input[type="password"]').first().fill(password);
      await Promise.all([
        page.waitForLoadState('networkidle').catch(() => {}),
        page
          .locator('button[type="submit"], input[type="submit"], button:has-text("로그인"), a:has-text("로그인")')
          .first()
          .click(),
      ]);
    } catch (err) {
      console.log('[test] auto-login failed (probably needs different selectors):', err);
      console.log('[test] → manual: log in yourself in the browser window');
    }
  } else {
    console.log('[test] no login form visible (maybe already logged in via storage state)');
  }

  console.log('\n========================================');
  console.log('Browser is now open.');
  console.log('1) If not logged in yet, log in manually.');
  console.log('2) Navigate to the 미납 금액 page you want to scrape.');
  console.log('3) When finished, CLOSE THE BROWSER WINDOW.');
  console.log('   → the script will then save session state and exit.');
  console.log('========================================\n');

  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) {
      console.log(`[nav] ${frame.url()}`);
    }
  });

  await new Promise<void>((resolve) => {
    context.on('close', () => resolve());
    page.on('close', () => resolve());
    browser.on('disconnected', () => resolve());
  });

  try {
    await context.storageState({ path: STATE_FILE });
    console.log(`[test] session saved to ${STATE_FILE}`);
  } catch (err) {
    console.log('[test] failed to save session state:', err);
  }

  await context.close();
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
