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

export async function updateFeeTable(
  rows: ThebillRow[],
  mode: ScrapeMode,
  cfgOverride?: ThebillConfig,
): Promise<UpdateResult> {
  const cfg = cfgOverride ?? loadConfig();
  const base = new Airtable({ apiKey: cfg.airtableFeePat }).base(cfg.airtableFeeBaseId);
  const table = base(cfg.airtableFeeTableId);
  // 항상 현재 cycle 의 monthly view 동적 계산 — env override 없음.
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

  function ymOf(drawDate: string): string {
    // drawDate format from 더빌: "2026-04-27" or "" — slice first 7 chars.
    return (drawDate ?? '').slice(0, 7);
  }

  for (const row of rows) {
    const cls = classifyStatus(row.status);
    const newStatus = decideStatus(cls, mode);

    const bizNo = normalizeBizNo(row.bizNo);
    try {
      // 사업자번호 컬럼이 lookup/linked 필드라 array 로 반환됨 (예: ["150-36-00401"]).
      // ARRAYJOIN 으로 string 변환 후 SUBSTITUTE 로 하이픈/공백 양쪽 정규화 비교.
      const records = await table
        .select({
          view,
          maxRecords: 1,
          filterByFormula: `SUBSTITUTE(SUBSTITUTE(ARRAYJOIN({${cfg.airtableFeeBizNoField}}),'-',''),' ','')='${escapeFormula(bizNo)}'`,
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

      if (cls === 'success') {
        result.successUpdated += 1;
      } else {
        result.failureUpdated += 1;
        // 슬랙 알림용 — 새로 출금실패로 마킹된 row 기록.
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
  }

  return result;
}
