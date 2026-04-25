import Airtable from 'airtable';
import { loadConfig, type ThebillConfig } from './config';
import { classifyStatus, normalizeBizNo, type ThebillRow, type StatusClass } from './parser';
import { mostRecentMonth25 } from './business-day';
import type { ScrapeMode } from './scraper';

export interface UnpaidEntry {
  name: string;
  representative: string;
  amount: number;
  yearMonth: string; // 'YYYY-MM' (출금일 기준)
  reason: string; // raw 더빌 status, 예: "출금실패 잔액부족 [자동출금] 재출금중지"
}

export interface UpdateResult {
  total: number;
  successUpdated: number;
  failureUpdated: number;
  skipped: number;
  unmatched: string[];
  errors: { bizNo: string; error: string }[];
  failureRows: UnpaidEntry[];
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

/**
 * 현재 cycle 의 monthly view 이름. system month 가 아닌 가장 최근 25일의 month 사용.
 * 예: 5월 1일에 동기화 실행해도 4월 cycle (4/25 출금) 결과를 받으므로 [4월] view 매칭.
 */
function currentCycleView(now: Date = new Date()): string {
  const m = mostRecentMonth25(now).getMonth() + 1;
  return `[${m}월] 세금계산서 및 입금현황`;
}

function flatStr(v: unknown): string {
  if (Array.isArray(v)) return v.join(',').trim();
  return String(v ?? '').trim();
}

function ymOf(drawDate: string): string {
  // 더빌 drawDate: "2026-04-27" or "" — 앞 7자.
  return (drawDate ?? '').slice(0, 7);
}

export async function updateFeeTable(
  rows: ThebillRow[],
  mode: ScrapeMode,
  cfgOverride?: ThebillConfig,
  log: (msg: string) => void = () => {},
): Promise<UpdateResult> {
  const cfg = cfgOverride ?? loadConfig();
  const base = new Airtable({ apiKey: cfg.airtableFeePat }).base(cfg.airtableFeeBaseId);
  const table = base(cfg.airtableFeeTableId);
  const view = currentCycleView();

  const result: UpdateResult = {
    total: rows.length,
    successUpdated: 0,
    failureUpdated: 0,
    skipped: 0,
    unmatched: [],
    errors: [],
    failureRows: [],
  };

  // 1) view 의 모든 record 를 한 번에 fetch — 매번 select() 호출하지 않음 (rate-limit 절약).
  log(`[thebill-sync] fetching view "${view}"...`);
  const viewRecords = await table.select({ view }).all();
  log(`[thebill-sync] view 에 ${viewRecords.length} rows`);

  // 2) 사업자번호 정규화 → record map. lookup 필드가 array 라 모든 항목을 키로.
  const byBiz = new Map<string, (typeof viewRecords)[number]>();
  for (const r of viewRecords) {
    const raw = r.get(cfg.airtableFeeBizNoField);
    const values = Array.isArray(raw) ? raw : [raw];
    for (const v of values) {
      const k = String(v ?? '').replace(/[\s-]/g, '');
      if (k) byBiz.set(k, r);
    }
  }

  // 3) Excel rows 순회 — 매칭은 in-memory, update 만 API.
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const cls = classifyStatus(row.status);
    const newStatus = decideStatus(cls, mode);
    const bizNo = normalizeBizNo(row.bizNo);

    const record = byBiz.get(bizNo);
    if (!record) {
      result.unmatched.push(bizNo);
      continue;
    }

    const currentStatus = flatStr(record.get(cfg.airtableFeeStatusField));
    if (currentStatus === '출금성공') {
      result.skipped += 1;
      continue;
    }

    const updates: Record<string, string> = {
      [cfg.airtableFeeStatusField]: newStatus,
      [cfg.airtableFeeRemarkField]: cls === 'success' ? '' : row.status,
    };

    try {
      await table.update(record.id, updates);

      if (cls === 'success') {
        result.successUpdated += 1;
      } else {
        result.failureUpdated += 1;
        result.failureRows.push({
          name: row.memberName,
          representative: row.representative,
          amount: row.amount,
          yearMonth: ymOf(row.drawDate),
          reason: row.status,
        });
      }
    } catch (err) {
      result.errors.push({
        bizNo,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    // 진행 로그 — 20개마다 한 번씩.
    if ((i + 1) % 20 === 0 || i === rows.length - 1) {
      log(
        `[thebill-sync] update progress ${i + 1}/${rows.length} ` +
          `(성공 ${result.successUpdated}, 실패 ${result.failureUpdated}, 스킵 ${result.skipped}, 매칭실패 ${result.unmatched.length})`,
      );
    }
  }

  return result;
}
