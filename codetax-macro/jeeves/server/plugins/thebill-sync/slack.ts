import { WebClient } from '@slack/web-api';
import { loadConfig } from './config';

export interface SyncResult {
  total: number;
  updated: number;
  created: number;
  failed: number;
  skipped: number;
  errors: { key: string; error: string }[];
}

function client(): { web: WebClient; channel: string } | null {
  const cfg = loadConfig();
  if (!cfg.slackBotToken || !cfg.slackChannel) return null;
  return { web: new WebClient(cfg.slackBotToken), channel: cfg.slackChannel };
}

export async function notifySuccess(result: SyncResult, durationMs: number): Promise<void> {
  const c = client();
  if (!c) return; // RECEIVABLES_SLACK_BOT_TOKEN 미설정 — 알림 skip, 동기화 자체는 계속
  const sec = Math.round(durationMs / 1000);
  const text =
    `✅ thebill-sync 완료 — 총 ${result.total}건 ` +
    `(수정 ${result.updated} / 생성 ${result.created} / 실패 ${result.failed} / 스킵 ${result.skipped}) / ${sec}초`;
  await c.web.chat.postMessage({ channel: c.channel, text });
}

export interface UnpaidEntry {
  name: string;
  representative: string;
  amount: number;
  yearMonth: string; // 'YYYY-MM'
  reason: string;
}

export interface UnmatchedEntry {
  bizNo: string;
  name: string;
  representative: string;
  amount: number;
  reason: string;
}

function nameDisplay(name: string, rep: string): string {
  if (!name && !rep) return '(이름없음)';
  return rep ? `${name}(${rep})` : name;
}

/**
 * 출금실패 row 들을 월별 그룹 + 매칭실패 (Airtable 에 없는 사업자번호) 별도 섹션으로 발송.
 * 형식:
 *   :date: 2026년 04월 내역 (3건)
 *   • 거래처명(대표자): 110,000원 — 출금실패 잔액부족 [자동출금] 재출금중지
 *   ...
 *   ⚠ Airtable 매칭 실패 (2건) — 더빌엔 있으나 view 에 없음:
 *   • 거래처명(대표자) [110-31-21908]: 110,000원 — 출금실패 ...
 */
export async function notifyUnpaidSummary(
  rows: UnpaidEntry[],
  unmatched: UnmatchedEntry[],
  totalProcessed: number,
  durationMs: number,
  log: (msg: string) => void = () => {},
): Promise<void> {
  const c = client();
  if (!c) {
    log('[thebill-sync] slack skip — RECEIVABLES_SLACK_BOT_TOKEN 또는 _CHANNEL 미설정');
    return;
  }
  log(
    `[thebill-sync] slack 발송 channel="${c.channel}" rows=${rows.length} unmatched=${unmatched.length}`,
  );

  const sec = Math.round(durationMs / 1000);
  const header = `✅ thebill-sync 완료 — 처리 ${totalProcessed}건 / ${sec}초`;
  const blocks: string[] = [header];

  if (rows.length === 0 && unmatched.length === 0) {
    blocks[0] = `✅ thebill-sync 완료 — 처리 ${totalProcessed}건, 신규 미수업체 없음 / ${sec}초`;
  } else {
    if (rows.length > 0) {
      const groups = new Map<string, UnpaidEntry[]>();
      for (const r of rows) {
        const arr = groups.get(r.yearMonth) ?? [];
        arr.push(r);
        groups.set(r.yearMonth, arr);
      }
      for (const ym of [...groups.keys()].sort()) {
        const items = groups.get(ym)!;
        const [year, month] = ym.split('-');
        const label = year && month ? `${year}년 ${month}월` : '(귀속월 미상)';
        const lines = items.map((r) => {
          const reason = r.reason ? ` — ${r.reason}` : '';
          return `• ${nameDisplay(r.name, r.representative)}: ${r.amount.toLocaleString('ko-KR')}원${reason}`;
        });
        blocks.push(`:date: ${label} 내역 (${items.length}건)\n${lines.join('\n')}`);
      }
    }

    if (unmatched.length > 0) {
      const lines = unmatched.map((u) => {
        const reason = u.reason ? ` — ${u.reason}` : '';
        return `• ${nameDisplay(u.name, u.representative)} [${u.bizNo}]: ${u.amount.toLocaleString('ko-KR')}원${reason}`;
      });
      blocks.push(
        `⚠ Airtable 매칭 실패 (${unmatched.length}건) — 더빌엔 있으나 [N월] view 에 없음:\n${lines.join('\n')}`,
      );
    }
  }

  const text = blocks.join('\n\n');

  try {
    const res = await c.web.chat.postMessage({ channel: c.channel, text });
    log(
      `[thebill-sync] slack post ok=${res.ok}, channel=${res.channel ?? '?'}, ts=${res.ts ?? '?'}`,
    );
  } catch (err: any) {
    log(`[thebill-sync] slack post FAIL: ${err?.data ? JSON.stringify(err.data) : err?.message ?? err}`);
    throw err;
  }
}

export async function notifyFailure(err: Error, stage?: string): Promise<void> {
  const c = client();
  if (!c) return;
  const stageTag = stage ? ` [${stage}]` : '';
  const text = `❌ thebill-sync 실패${stageTag} — ${err.message}`;
  const stack = err.stack ? `\n\`\`\`\n${err.stack.slice(0, 2500)}\n\`\`\`` : '';
  await c.web.chat.postMessage({ channel: c.channel, text: text + stack });
}
