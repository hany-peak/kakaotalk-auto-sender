import * as path from 'path';

export const BASE_DOWNLOAD_DIR = path.resolve(__dirname, '../../../src/images');

function getDateStr(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
}

export function getDownloadDir(): string {
  return path.join(BASE_DOWNLOAD_DIR, getDateStr());
}

export const MENU = {
  TAX_AGENT_TAB: 'a#mf_wfHeader_hdGrp921, a.w2group:has(span:has-text("세무대리")), a:has-text("세무대리/납세관리")',
  NOTICE_HISTORY_MENU: 'a:has-text("고지내역 조회"), a:has-text("고지내역조회"), li:has-text("고지내역 조회"), td:has-text("고지내역 조회")',
  BIZ_NUM_INPUT: '#mf_txppWframe_edtTxprNo, input[title*="주민(사업자)등록번호"], input[name*="bizNo"], input[id*="bizNo"]',
  SEARCH_BTN: '#mf_txppWframe_trigger15, button:has-text("조회"), input[value="조회"]',
  PRINT_NOTICE_BTN: 'button[title="납부서 새창"], button:has-text("납부서출력"), button:has-text("납부서 출력"), a:has-text("납부서출력"), a:has-text("납부서 출력")',
  PRINT_BTN: 'button:has-text("인쇄"), a:has-text("인쇄"), input[value="인쇄"]',
  TARGET_TAX_TYPE: '부가가치세',
};

export const CROP_CONFIGS: Record<string, { left: number; top: number; right: number; bottom: number }> = {
  '부가가치세_예정고지': { left: 225, top: 71, right: 1018, bottom: 530 },
};

export const DELAY_BETWEEN_BUSINESSES = 500;
