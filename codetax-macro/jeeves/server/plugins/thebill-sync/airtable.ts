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

export function decideStatus(
  cls: StatusClass,
  mode: ScrapeMode,
): string | null {
  if (cls === 'unknown') return null;
  if (cls === 'success') return '출금성공';
  // failure
  return mode === 'withdrawal' ? '자동재출금' : '출금실패';
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
    if (newStatus === null) {
      result.skipped += 1;
      continue;
    }

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

      await table.update(records[0].id, {
        [cfg.airtableFeeStatusField]: newStatus,
      });

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
