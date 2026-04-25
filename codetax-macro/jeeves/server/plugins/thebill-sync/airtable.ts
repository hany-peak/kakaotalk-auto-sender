import Airtable from 'airtable';
import { loadConfig, type ThebillConfig } from './config';
import { classifyStatus, normalizeBizNo, type ThebillRow, type StatusClass } from './parser';
import type { ScrapeMode } from './scraper';

export interface UpdateResult {
  total: number;
  successUpdated: number;
  failureUpdated: number;
  skipped: number;
  unmatched: string[];
  errors: { bizNo: string; error: string }[];
}

/**
 * 더빌 status → Airtable 출금상태 매핑.
 * success 만 '출금성공', 그 외(failure/unknown 모두)는 '출금실패' 로 통일.
 * mode 는 현재 사용되지 않지만, 향후 mode 별 분리 매핑 필요 시 유지.
 */
export function decideStatus(
  cls: StatusClass,
  _mode: ScrapeMode,
): string {
  return cls === 'success' ? '출금성공' : '출금실패';
}

function escapeFormula(s: string): string {
  return s.replace(/'/g, "\\'");
}

function currentMonthView(): string {
  const m = String(new Date().getMonth() + 1);
  return `[${m}월] 세금계산서 및 입금현황`;
}

export async function updateFeeTable(
  rows: ThebillRow[],
  mode: ScrapeMode,
  cfgOverride?: ThebillConfig,
): Promise<UpdateResult> {
  const cfg = cfgOverride ?? loadConfig();
  const base = new Airtable({ apiKey: cfg.airtableFeePat }).base(cfg.airtableFeeBaseId);
  const table = base(cfg.airtableFeeTableId);
  const view = cfg.airtableFeeViewName || currentMonthView();

  const result: UpdateResult = {
    total: rows.length,
    successUpdated: 0,
    failureUpdated: 0,
    skipped: 0,
    unmatched: [],
    errors: [],
  };

  for (const row of rows) {
    const cls = classifyStatus(row.status);
    const newStatus = decideStatus(cls, mode);

    const bizNo = normalizeBizNo(row.bizNo);
    try {
      const records = await table
        .select({
          view,
          maxRecords: 1,
          filterByFormula: `{${cfg.airtableFeeBizNoField}}='${escapeFormula(bizNo)}'`,
        })
        .firstPage();

      if (records.length === 0) {
        result.unmatched.push(bizNo);
        continue;
      }

      const record = records[0];
      const currentStatus = String(
        record.get(cfg.airtableFeeStatusField) ?? '',
      ).trim();

      // 안전장치: 이미 '출금성공' 인 row 는 재업데이트 안 함 (수동 확인 또는 이전 cycle 보존).
      if (currentStatus === '출금성공') {
        result.skipped += 1;
        continue;
      }

      // 비고: success 면 비움, 그 외 (failure/unknown) 는 더빌 raw status 그대로.
      // 출금상태: success → '출금성공', 그 외 (failure/unknown 모두) → '출금실패'.
      const updates: Record<string, string> = {
        [cfg.airtableFeeStatusField]: newStatus,
        [cfg.airtableFeeRemarkField]: cls === 'success' ? '' : row.status,
      };

      await table.update(record.id, updates);

      if (cls === 'success') result.successUpdated += 1;
      else result.failureUpdated += 1;
    } catch (err) {
      result.errors.push({
        bizNo,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return result;
}
