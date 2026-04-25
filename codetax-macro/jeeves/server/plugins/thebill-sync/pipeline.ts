import type { ServerContext, RunResult } from '../types';
import * as scraper from './scraper';
import * as parser from './parser';
import * as airtable from './airtable';
import * as slack from './slack';
import { adjustToBusinessDay, addBusinessDays, mostRecentMonth25 } from './business-day';

export type RunMode = 'withdrawal' | 'reWithdrawal';

function nthOfThisMonth(n: number, now: Date = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth(), n);
}

function computePeriod(mode: RunMode, now: Date = new Date()): { from: Date; to: Date } {
  if (mode === 'withdrawal') {
    // 25일(주말이면 직전 영업일) 기준 ±5 영업일.
    // 출금 등록(D-N), 실행(D), 결과 반영(D+N) 모든 단계 포함.
    const target = adjustToBusinessDay(nthOfThisMonth(25, now), 'backward');
    return {
      from: addBusinessDays(target, -5),
      to: addBusinessDays(target, 5),
    };
  }
  // reWithdrawal: 가장 최근 25일을 기준으로 retry window 산출.
  const ref25 = mostRecentMonth25(now);
  const start = adjustToBusinessDay(
    new Date(ref25.getFullYear(), ref25.getMonth(), 26),
    'forward',
  );
  const end = addBusinessDays(ref25, 8);
  return { from: start, to: end };
}

export interface RunOptions {
  mode: RunMode;
  from?: Date;
  to?: Date;
}

export async function run(
  ctx: ServerContext,
  opts: RunOptions = { mode: 'withdrawal' },
): Promise<RunResult> {
  const start = Date.now();
  const startedAt = new Date().toISOString();
  let stage: 'scrape' | 'parse' | 'airtable' | 'slack' = 'scrape';
  const period = opts.from && opts.to ? { from: opts.from, to: opts.to } : computePeriod(opts.mode);

  try {
    ctx.log(`[thebill-sync] mode=${opts.mode} period=${period.from.toISOString().slice(0, 10)}~${period.to.toISOString().slice(0, 10)}`);
    const xlsxPath = await scraper.downloadResult(ctx, {
      mode: opts.mode,
      from: period.from,
      to: period.to,
    });

    stage = 'parse';
    const rows = parser.parse(xlsxPath);
    ctx.log(`[thebill-sync] parsed ${rows.length} rows`);

    stage = 'airtable';
    const updateResult = await airtable.updateFeeTable(rows, opts.mode, undefined, ctx.log);
    ctx.log(
      `[thebill-sync] airtable 완료 — 성공 ${updateResult.successUpdated} / 실패 ${updateResult.failureUpdated} / 스킵 ${updateResult.skipped} / 매칭실패 ${updateResult.unmatched.length} / 에러 ${updateResult.errors.length}`,
    );

    const durationMs = Date.now() - start;
    stage = 'slack';
    ctx.log('[thebill-sync] slack 알림 발송...');
    await slack.notifyUnpaidSummary(
      updateResult.failureRows,
      updateResult.total,
      durationMs,
      ctx.log,
    );
    ctx.log('[thebill-sync] slack 완료');

    return {
      status: 'success',
      startedAt,
      finishedAt: new Date().toISOString(),
      durationMs,
      summary: `[${opts.mode}] 총 ${updateResult.total}건 (성공반영 ${updateResult.successUpdated}, 실패반영 ${updateResult.failureUpdated}, 매칭실패 ${updateResult.unmatched.length}, 에러 ${updateResult.errors.length})`,
      meta: {
        mode: opts.mode,
        period: {
          from: period.from.toISOString().slice(0, 10),
          to: period.to.toISOString().slice(0, 10),
        },
        ...updateResult,
      } as unknown as Record<string, unknown>,
    };
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    ctx.logError(`[thebill-sync] ${stage} failed: ${e.message}`);
    await slack.notifyFailure(e, stage).catch((slackErr) => {
      ctx.logError(`[thebill-sync] slack notify failed: ${slackErr}`);
    });
    return {
      status: 'error',
      startedAt,
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - start,
      summary: `[${opts.mode}] 실패 (${stage}): ${e.message}`,
      error: e.stack ?? e.message,
      meta: { stage, mode: opts.mode },
    };
  }
}
