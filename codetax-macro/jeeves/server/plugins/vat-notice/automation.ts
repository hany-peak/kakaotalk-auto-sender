import * as path from 'path';
import * as fs from 'fs';
import type { Page } from 'playwright';
import { findSelector, clickSelector, fillSelector } from '../../shared/hometax';
import { sanitizeName, normalizeBizNum } from '../../shared/file-utils';
import { MENU, CROP_CONFIGS, DELAY_BETWEEN_BUSINESSES } from './config';
import type { LogFn } from '../types';

interface Business {
  name: string;
  bizNo: string;
  taxAmount?: number;
  groupName?: string;
}

interface DownloadResult {
  success: { name: string; bizNo: string; fileName: string; filePath: string }[];
  failed: { name: string; bizNo: string; reason: string }[];
}

async function navigateToNoticeHistoryPage(page: Page, log: LogFn): Promise<void> {
  log('navigating: tax agent > notice history');

  const clicked1 = await clickSelector(page, MENU.TAX_AGENT_TAB);
  if (!clicked1) {
    throw new Error('Cannot find tax agent tab. Check MENU.TAX_AGENT_TAB selectors.');
  }

  const found2 = await findSelector(page, MENU.NOTICE_HISTORY_MENU, 5000);
  if (!found2) throw new Error('Cannot find notice history menu.');
  await found2.frame.click(found2.sel);
  await page.waitForLoadState('networkidle').catch(() => {});
}

async function scrapeNoticeRows(page: Page, bizNo: string): Promise<any[]> {
  const bizDigits = bizNo ? bizNo.replace(/\D/g, '') : '';
  const frames = [page, ...page.frames()];

  for (const frame of frames) {
    try {
      const colMap = await frame.$$eval('tr', (trs: HTMLTableRowElement[]) => {
        for (const tr of trs) {
          const ths = [...tr.querySelectorAll('th')];
          if (ths.length < 6) continue;
          const headers = ths.map((th) => th.innerText.trim().replace(/\s+/g, ''));
          if (headers.some((h) => h.includes('결정구분') || h.includes('세목명'))) {
            const map: Record<string, number> = {};
            headers.forEach((h, i) => { map[h] = i; });
            return map;
          }
        }
        return null;
      });

      const rows = await frame.$$eval(
        'tr',
        (trs: HTMLTableRowElement[], colMap: Record<string, number> | null) => {
          return trs
            .filter((tr) => tr.querySelectorAll('td').length >= 6)
            .map((tr) => {
              const cells = [...tr.querySelectorAll('td')];
              const cellTexts = cells.map((c) => c.innerText.trim());

              if (colMap) {
                const get = (key: string) => {
                  const idx = colMap[key];
                  return idx != null ? cellTexts[idx] || '' : '';
                };
                return {
                  결정구분: get('결정구분'),
                  과세기간세목명: [get('과세기간'), get('세목명')].filter(Boolean).join(' ') || get('과세기간세목명'),
                  전자납부번호: get('전자납부번호'),
                  사업자번호: get('사업자번호') || get('사업자(주민)번호') || get('사업자번호(주민번호)'),
                  성명: get('성명') || get('성명(상호)') || get('상호(성명)'),
                  납부기한: get('납부기한'),
                  고지세액: get('고지세액'),
                  납부할세액: get('납부할세액'),
                };
              }

              let bizColIdx = -1;
              for (let i = 0; i < cellTexts.length; i++) {
                if (/^\d{3}-\d{2}-\d{5}$/.test(cellTexts[i])) {
                  bizColIdx = i;
                  break;
                }
              }

              if (bizColIdx >= 2 && bizColIdx + 3 < cellTexts.length) {
                return {
                  결정구분: cellTexts[0] || '',
                  과세기간세목명: cellTexts[1] || '',
                  전자납부번호: cellTexts[bizColIdx - 1] || '',
                  사업자번호: cellTexts[bizColIdx] || '',
                  성명: cellTexts[bizColIdx + 1] || '',
                  납부기한: cellTexts[bizColIdx + 2] || '',
                  고지세액: cellTexts[bizColIdx + 3] || '',
                  납부할세액: cellTexts[bizColIdx + 4] || '',
                };
              }

              return {
                결정구분: cellTexts[0] || '',
                과세기간세목명: cellTexts[1] || '',
                전자납부번호: cellTexts[2] || '',
                사업자번호: cellTexts[3] || '',
                성명: cellTexts[4] || '',
                납부기한: cellTexts[5] || '',
                고지세액: cellTexts[6] || '',
                납부할세액: cellTexts[7] || '',
              };
            })
            .filter((r) => r.결정구분 && r.결정구분 !== '결정구분');
        },
        colMap,
      );

      if (rows.length > 0) {
        if (bizDigits) {
          const filtered = rows.filter((r) => {
            const rowDigits = (r.사업자번호 || '').replace(/\D/g, '');
            return rowDigits === bizDigits;
          });
          if (filtered.length > 0) return filtered;
        }
        return rows;
      }
    } catch {
      /* next frame */
    }
  }
  return [];
}

async function clickPrintNoticeForTargetRow(
  page: Page,
  log: LogFn,
  targetRowText: string,
): Promise<Page | null> {
  log(`  searching print button for ${targetRowText}...`);

  const BTN_SEL =
    'button[title="납부서 새창"], button:has-text("납부서출력"), button:has-text("납부서 출력"), a:has-text("납부서출력")';

  const waitForPopup = page.context().waitForEvent('page', { timeout: 10000 }).catch(() => null);

  let clicked = false;
  const frames = [page, ...page.frames()];
  for (const frame of frames) {
    const targetRow = frame
      .locator('tr', { hasText: targetRowText })
      .filter({ hasText: MENU.TARGET_TAX_TYPE })
      .first();

    if ((await targetRow.count()) > 0) {
      const printBtn = targetRow.locator(BTN_SEL).first();
      if ((await printBtn.count()) > 0) {
        await printBtn.click();
        log('  print button clicked');
        clicked = true;
        break;
      }
    }
  }

  if (!clicked) {
    const result = await findSelector(page, MENU.PRINT_NOTICE_BTN, 3000);
    if (result) {
      await result.frame.click(result.sel);
      log('  print button clicked (fallback)');
      clicked = true;
    }
  }

  if (!clicked) throw new Error(`Cannot find print button for ${targetRowText}`);

  const popup = await waitForPopup;
  if (popup) {
    await popup.waitForLoadState('networkidle').catch(() => {});
    log('  popup opened');
    return popup;
  }
  return null;
}

async function savePageAsPNG(
  page: Page,
  bizNum: string,
  log: LogFn,
  downloadDir: string,
  cropBox: { left: number; top: number; right: number; bottom: number } | null = null,
): Promise<{ fileName: string; filePath: string }> {
  const fileName = `고지내역_부가가치세_${bizNum.replace(/-/g, '')}.png`;
  const filePath = path.join(downloadDir, fileName);

  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1000);

  const PAGE_W = 1242;
  const PAGE_H = 1756;
  await page.setViewportSize({ width: PAGE_W, height: PAGE_H });

  await page.screenshot({
    path: filePath,
    clip: { x: 0, y: 0, width: PAGE_W, height: Math.ceil(PAGE_H / 3) },
  });

  if (cropBox) {
    const { execFile } = require('child_process');
    await new Promise<void>((resolve, reject) => {
      const script = `
from PIL import Image
img = Image.open(r"${filePath}")
cropped = img.crop((${cropBox.left}, ${cropBox.top}, ${cropBox.right}, ${cropBox.bottom}))
cropped.save(r"${filePath}")
`;
      execFile('python3', ['-c', script], (err: Error | null) => (err ? reject(err) : resolve()));
    });
  }

  log(`  PNG saved: ${fileName}`);
  return { fileName, filePath };
}

async function processOneBusiness(
  page: Page,
  bizNum: string,
  log: LogFn,
  downloadDir: string,
  name: string,
  taxAmount = 0,
  groupName = '',
  targetRowText = '2026년1기분',
): Promise<{ fileName: string; filePath: string }> {
  const formatted = normalizeBizNum(bizNum);
  log(`processing: ${formatted}`);

  const bizDir = path.join(downloadDir, `${sanitizeName(name)}_${formatted.replace(/-/g, '')}`);
  fs.mkdirSync(bizDir, { recursive: true });

  const filled = await fillSelector(page, MENU.BIZ_NUM_INPUT, formatted.replace(/-/g, ''));
  if (!filled) throw new Error('Cannot find biz number input field.');

  const searched = await clickSelector(page, MENU.SEARCH_BTN);
  if (!searched) await page.keyboard.press('Enter');

  await page.waitForLoadState('networkidle').catch(() => {});

  const taxList = await scrapeNoticeRows(page, formatted);
  log(`  notice rows: ${taxList.length}`);

  const printPage = await clickPrintNoticeForTargetRow(page, log, targetRowText);
  const targetPage = printPage || page;

  await targetPage.waitForLoadState('networkidle').catch(() => {});
  await targetPage.evaluate(() => {
    const imgs = [...document.images];
    return Promise.all(
      imgs
        .filter((img) => !img.complete)
        .map((img) => new Promise((resolve) => { img.onload = img.onerror = resolve; })),
    );
  });

  const cropBox = CROP_CONFIGS['부가가치세_예정고지'];
  const result = await savePageAsPNG(targetPage, formatted, log, bizDir, cropBox);

  if (printPage) {
    await printPage.close().catch(() => {});
    log('  popup closed');
  }

  const info = {
    name,
    bizNo: formatted,
    taxAmount,
    groupName: formatted.replace(/-/g, ''),
    taxList,
    status: '대기중',
    savedAt: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(bizDir, 'info.json'), JSON.stringify(info, null, 2), 'utf8');

  return result;
}

export async function downloadPDFsForBusinesses(
  page: Page,
  businesses: Business[],
  isStopped: () => boolean,
  log: LogFn,
  logError: LogFn,
  downloadDir: string,
  taxYear: number = new Date().getFullYear(),
  taxPeriod: number = 1,
): Promise<DownloadResult> {
  const targetRowText = `${taxYear}년${taxPeriod}기분`;
  log(`query: ${targetRowText} VAT`);

  page.setDefaultTimeout(3000);
  await navigateToNoticeHistoryPage(page, log);

  const results: DownloadResult = { success: [], failed: [] };

  for (let i = 0; i < businesses.length; i++) {
    if (isStopped()) {
      log('stop requested');
      break;
    }

    const { name, bizNo, taxAmount = 0, groupName = '' } = businesses[i];
    log(`[${i + 1}/${businesses.length}] ${name} (${bizNo})`);

    try {
      const result = await processOneBusiness(page, bizNo, log, downloadDir, name, taxAmount, groupName, targetRowText);
      results.success.push({ name, bizNo, ...result });
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      logError(`failed (${name} / ${bizNo}): ${reason}`);
      results.failed.push({ name, bizNo, reason });

      if (reason.includes('Cannot find print button')) {
        try {
          const formatted = normalizeBizNum(bizNo);
          const bizDir = path.join(downloadDir, `${sanitizeName(name)}_${formatted.replace(/-/g, '')}`);
          if (fs.existsSync(bizDir)) {
            const infoPath = path.join(bizDir, 'info.json');
            let info: any = {};
            try { info = JSON.parse(fs.readFileSync(infoPath, 'utf8')); } catch {}
            Object.assign(info, {
              name,
              bizNo: formatted,
              taxAmount: info.taxAmount || 0,
              groupName: info.groupName || name,
              note: 'no notice found',
              status: '주의',
              updatedAt: new Date().toISOString(),
            });
            fs.writeFileSync(infoPath, JSON.stringify(info, null, 2), 'utf8');
          }
        } catch {}
      }
    }

    if (i < businesses.length - 1) {
      await page.waitForTimeout(DELAY_BETWEEN_BUSINESSES);
    }
  }

  log(`\ndone - success ${results.success.length} / failed ${results.failed.length}`);
  results.failed.forEach(({ name, bizNo, reason }) => logError(`  failed: ${name} (${bizNo}) - ${reason}`));

  return results;
}
