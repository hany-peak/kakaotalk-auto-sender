import 'dotenv/config';
import * as path from 'path';
import * as fs from 'fs';
import { chromium, Page } from 'playwright';

const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
}

const URL = process.env.THEBILL_CMS_LOGIN_URL!;
const USER = process.env.THEBILL_CMS_USERNAME!;
const PASS = process.env.THEBILL_CMS_PASSWORD!;

if (!URL || !USER || !PASS) {
  console.error('THEBILL_CMS_LOGIN_URL/USERNAME/PASSWORD missing in .env');
  process.exit(1);
}

const SHOTS = '/tmp/thebill-probe';
fs.mkdirSync(SHOTS, { recursive: true });

async function snap(page: Page, name: string) {
  const file = path.join(SHOTS, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true }).catch(() => {});
  console.log(`  📸 ${file}`);
}

async function dumpVisibleInputs(page: Page, label: string) {
  console.log(`\n[${label}] visible inputs:`);
  const inputs = await page.locator('input, select, textarea').all();
  for (let i = 0; i < Math.min(inputs.length, 40); i++) {
    const info = await inputs[i].evaluate((el: HTMLInputElement) => {
      const r = el.getBoundingClientRect();
      return {
        tag: el.tagName,
        type: (el as HTMLInputElement).type,
        name: (el as HTMLInputElement).name,
        id: el.id,
        placeholder: (el as HTMLInputElement).placeholder,
        cls: (el.className?.toString() ?? '').slice(0, 60),
        visible: r.width > 0 && r.height > 0,
      };
    });
    if (info.visible) console.log(`  [${i}]`, JSON.stringify(info));
  }
}

async function dumpButtons(page: Page, label: string) {
  console.log(`\n[${label}] visible buttons / a / .btn-like:`);
  const els = await page
    .locator('button, a, input[type="submit"], input[type="button"], [class*="btn"], [class*="button"]')
    .all();
  for (let i = 0; i < Math.min(els.length, 60); i++) {
    const info = await els[i].evaluate((el: Element) => {
      const r = el.getBoundingClientRect();
      const txt = (el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 40);
      const val = (el as HTMLInputElement).value ?? '';
      return {
        tag: el.tagName,
        id: (el as HTMLElement).id,
        cls: ((el as HTMLElement).className?.toString() ?? '').slice(0, 60),
        txt,
        val: val.slice(0, 40),
        visible: r.width > 0 && r.height > 0,
      };
    });
    if (info.visible && (info.txt || info.val)) console.log(`  [${i}]`, JSON.stringify(info));
  }
}

async function dumpMenu(page: Page, keyword: string) {
  console.log(`\n[menu candidates containing "${keyword}"]`);
  const els = await page
    .locator(`text=${keyword}`)
    .all();
  for (let i = 0; i < Math.min(els.length, 10); i++) {
    const info = await els[i].evaluate((el: Element) => {
      const r = el.getBoundingClientRect();
      return {
        tag: el.tagName,
        cls: ((el as HTMLElement).className?.toString() ?? '').slice(0, 60),
        parentTag: el.parentElement?.tagName,
        parentCls: (el.parentElement?.className?.toString() ?? '').slice(0, 40),
        href: (el as HTMLAnchorElement).href,
        text: (el.textContent ?? '').trim().slice(0, 50),
        visible: r.width > 0 && r.height > 0,
      };
    });
    console.log(`  [${i}]`, JSON.stringify(info));
  }
}

(async () => {
  const browser = await chromium
    .launch({ headless: false, channel: 'chrome' })
    .catch(() => chromium.launch({ headless: false }));
  const ctx = await browser.newContext({ acceptDownloads: true });
  const page = await ctx.newPage();

  console.log('▶ goto', URL);
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await snap(page, '01-login-form');
  await dumpVisibleInputs(page, 'login form');
  await dumpButtons(page, 'login form');

  console.log('\n▶ login...');
  await page
    .locator('input[name="username"], input[name="userId"], input[name="userid"], input[type="text"]')
    .first()
    .fill(USER);
  await page.locator('input[type="password"]').first().fill(PASS);
  await Promise.all([
    page.waitForLoadState('domcontentloaded').catch(() => {}),
    page
      .locator('button[type="submit"], button:has-text("로그인"), input[type="submit"]')
      .first()
      .click(),
  ]);
  await page.waitForTimeout(2500);
  console.log('  URL after login:', page.url());
  await snap(page, '02-after-login');

  // ── Top menu inspection ───────────────────────────────────────────────
  await dumpMenu(page, '자동이체');
  await dumpMenu(page, '출금결과');
  await dumpMenu(page, '회원상태');

  // ── Try [자동이체] → [출금결과조회] (withdrawal) ───────────────────────
  console.log('\n▶ [withdrawal] click 자동이체...');
  await page.getByText('자동이체', { exact: false }).first().click({ timeout: 5_000 }).catch((e) => console.log('  click err:', e.message));
  await page.waitForTimeout(1500);
  await snap(page, '03-after-자동이체');

  console.log('\n▶ [withdrawal] click 출금결과조회...');
  await page.getByText('출금결과조회', { exact: false }).first().click({ timeout: 5_000 }).catch((e) => console.log('  click err:', e.message));
  await page.waitForTimeout(2500);
  await snap(page, '04-출금결과조회-page');
  await dumpVisibleInputs(page, 'withdrawal page');
  await dumpButtons(page, 'withdrawal page');

  // 기간 / 조회 / 엑셀다운로드 후보 텍스트 확인
  for (const kw of ['기간', '시작', '종료', '조회', '엑셀', '다운로드', '출력']) {
    await dumpMenu(page, kw);
  }

  console.log('\n--- 브라우저 60초 유지 (수동 탐색 가능) ---');
  console.log('이후 자동으로 회원상태/출금설정 페이지로 이동');
  await page.waitForTimeout(60_000);

  // ── Try [자동이체] → [회원상태/출금설정] (reWithdrawal) ────────────────
  console.log('\n▶ [reWithdrawal] navigating...');
  await page.getByText('자동이체', { exact: false }).first().click({ timeout: 5_000 }).catch(() => {});
  await page.waitForTimeout(1000);
  await page.getByText('회원상태', { exact: false }).first().click({ timeout: 5_000 }).catch((e) => console.log('  click err:', e.message));
  await page.waitForTimeout(2500);
  await snap(page, '05-회원상태-page');
  await dumpVisibleInputs(page, 'reWithdrawal page');
  await dumpButtons(page, 'reWithdrawal page');

  console.log('\n--- 브라우저 60초 추가 유지 (수동 탐색) ---');
  await page.waitForTimeout(60_000);

  await browser.close();
  console.log('\n✓ probe done. screenshots:', SHOTS);
})().catch((e) => {
  console.error('probe error:', e.message);
  process.exit(1);
});
