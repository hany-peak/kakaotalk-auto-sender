import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { chromium, Browser, BrowserContext, Page, Download } from 'playwright';
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

  // Auto-accept any confirm/alert dialogs that 더빌 may show before download.
  page.on('dialog', (dialog) => {
    ctx.log(`[thebill-sync] dialog ${dialog.type()}: "${dialog.message()}"`);
    dialog.accept().catch(() => {});
  });

  // [엑셀다운로드] 버튼이 popup/새 창을 열 수도 있어 main page + popup 모두에서
  // download 이벤트 listen. 어느 쪽이든 먼저 발생하면 resolve.
  let resolveDownload!: (d: Download) => void;
  const downloadPromise = new Promise<Download>((resolve) => {
    resolveDownload = resolve;
  });
  page.on('download', (d) => resolveDownload(d));
  page.on('popup', (popup) => {
    ctx.log(`[thebill-sync] popup opened: ${popup.url()}`);
    popup.on('download', (d) => resolveDownload(d));
  });

  await page
    .locator('input[type="button"][value="엑셀다운로드"]')
    .first()
    .click({ timeout: 5_000 });

  // 더빌은 [엑셀다운로드] 클릭 후 "엑셀다운로드 이력 등록" 모달을 띄움.
  // 작업내용 select 에서 "기타" 선택 + 옆 텍스트 input 에 사유 입력 후 [등록].
  try {
    await page
      .locator('text=엑셀다운로드 이력 등록')
      .waitFor({ state: 'visible', timeout: 10_000 });
    ctx.log('[thebill-sync] 다운로드 이력 등록 모달 감지');

    // heading 의 가장 가까운 select 포함 ancestor = 모달 컨테이너.
    const modal = page
      .locator('text=엑셀다운로드 이력 등록')
      .locator('xpath=ancestor::*[.//select][1]');
    const modalCount = await modal.count();
    ctx.log(`[thebill-sync] 모달 컨테이너 매칭: ${modalCount}`);

    const scope = modalCount > 0 ? modal : page; // fallback: page-wide

    // 작업내용 select — 모달 안 첫 select.
    const workTypeSelect = scope.locator('select').first();
    const optionTexts = await workTypeSelect.locator('option').allTextContents();
    ctx.log(`[thebill-sync] 작업내용 옵션: [${optionTexts.join(' | ')}]`);

    // 우선순위: "제출" → "기타" → index 1 (선택하세요 다음).
    const findIdx = (label: string) =>
      optionTexts.findIndex((t) => t.trim() === label);
    const targetIdx = [findIdx('제출'), findIdx('기타')].find((i) => i >= 0) ?? 1;
    await workTypeSelect.selectOption({ index: targetIdx }).catch((e) => {
      ctx.log(`[thebill-sync] selectOption(index:${targetIdx}) 실패: ${e.message}`);
    });
    ctx.log(`[thebill-sync] 작업내용 → "${optionTexts[targetIdx] ?? '?'}" (idx ${targetIdx})`);

    // 사유 input — 모달 안 첫 visible text input.
    await scope
      .locator('input[type="text"]:visible')
      .first()
      .fill('확인')
      .catch((e) => {
        ctx.log(`[thebill-sync] 사유 텍스트 입력 실패: ${e.message}`);
      });

    // [등록] 버튼.
    await scope
      .locator('input[type="button"][value="등록"], button:has-text("등록")')
      .first()
      .click({ timeout: 5_000 });
    ctx.log('[thebill-sync] 모달 [등록] 클릭 — 다운로드 대기');
  } catch (e: any) {
    ctx.log(`[thebill-sync] 다운로드 모달 처리 skip: ${e.message}`);
  }

  const TIMEOUT_MS = 60_000;
  const timeoutErr = new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new Error(`download timeout (${TIMEOUT_MS}ms) — no download/popup observed`)),
      TIMEOUT_MS,
    ),
  );

  const download = await Promise.race([downloadPromise, timeoutErr]).catch(async (err) => {
    // 진단: 다운로드 실패 시 현재 페이지 스크린샷.
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const shotPath = `/tmp/thebill-download-fail-${opts.mode}-${ts}.png`;
    await page.screenshot({ path: shotPath, fullPage: true }).catch(() => {});
    ctx.log(`[thebill-sync] download fail screenshot: ${shotPath}`);
    ctx.log(`[thebill-sync] page URL at fail: ${page.url()}`);
    throw err;
  });

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
    // THEBILL_HEADLESS=0 으로 헤드 모드 토글 (헤드리스 감지 차단 의심 시 진단용).
    const headless = process.env.THEBILL_HEADLESS !== '0';
    browser = await chromium.launch({ headless });
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
