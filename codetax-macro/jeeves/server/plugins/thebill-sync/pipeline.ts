import type { ServerContext } from '../types';
import type { RunResult } from '../types';
import * as scraper from './scraper';
import * as parser from './parser';
import * as airtable from './airtable';
import * as slack from './slack';

export async function run(ctx: ServerContext): Promise<RunResult> {
  const start = Date.now();
  const startedAt = new Date().toISOString();
  let stage: 'scrape' | 'parse' | 'airtable' | 'slack' = 'scrape';

  try {
    ctx.log('[thebill-sync] scraping CMS...');
    const xlsxPath = await scraper.downloadResult(ctx);

    stage = 'parse';
    ctx.log('[thebill-sync] parsing excel...');
    const rows = parser.parse(xlsxPath);
    ctx.log(`[thebill-sync] parsed ${rows.length} rows`);

    stage = 'airtable';
    ctx.log('[thebill-sync] syncing to Airtable...');
    const syncResult = await airtable.upsertAll(rows);

    const durationMs = Date.now() - start;
    stage = 'slack';
    await slack.notifySuccess(syncResult, durationMs);

    return {
      status: 'success',
      startedAt,
      finishedAt: new Date().toISOString(),
      durationMs,
      summary: `총 ${syncResult.total}건 (수정 ${syncResult.updated} / 생성 ${syncResult.created} / 실패 ${syncResult.failed})`,
      meta: syncResult as unknown as Record<string, unknown>,
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
      summary: `실패 (${stage}): ${e.message}`,
      error: e.stack ?? e.message,
      meta: { stage },
    };
  }
}
