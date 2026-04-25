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

/**
 * 출금실패 row 들을 월별로 그룹화해서 슬랙으로 발송.
 * 형식:
 *   :date: 2026년 04월 내역 (3건)
 *   • 거래처명(대표자): 110,000원 — 출금실패 잔액부족 [자동출금] 재출금중지
 *   ...
 */
export async function notifyUnpaidSummary(
  rows: UnpaidEntry[],
  totalProcessed: number,
  durationMs: number,
): Promise<void> {
  const c = client();
  if (!c) return;
  const sec = Math.round(durationMs / 1000);

  if (rows.length === 0) {
    await c.web.chat.postMessage({
      channel: c.channel,
      text: `✅ thebill-sync 완료 — 처리 ${totalProcessed}건, 신규 미수업체 없음 / ${sec}초`,
    });
    return;
  }

  const groups = new Map<string, UnpaidEntry[]>();
  for (const r of rows) {
    const arr = groups.get(r.yearMonth) ?? [];
    arr.push(r);
    groups.set(r.yearMonth, arr);
  }

  const sections: string[] = [];
  for (const ym of [...groups.keys()].sort()) {
    const items = groups.get(ym)!;
    const [year, month] = ym.split('-');
    const label = year && month ? `${year}년 ${month}월` : '(귀속월 미상)';
    const lines = items.map((r) => {
      const nameDisp = r.representative ? `${r.name}(${r.representative})` : r.name;
      const reason = r.reason ? ` — ${r.reason}` : '';
      return `• ${nameDisp}: ${r.amount.toLocaleString('ko-KR')}원${reason}`;
    });
    sections.push(`:date: ${label} 내역 (${items.length}건)\n${lines.join('\n')}`);
  }

  const header = `✅ thebill-sync 완료 — 처리 ${totalProcessed}건 / ${sec}초`;
  const text = `${header}\n\n${sections.join('\n\n')}`;
  await c.web.chat.postMessage({ channel: c.channel, text });
}

export async function notifyFailure(err: Error, stage?: string): Promise<void> {
  const c = client();
  if (!c) return;
  const stageTag = stage ? ` [${stage}]` : '';
  const text = `❌ thebill-sync 실패${stageTag} — ${err.message}`;
  const stack = err.stack ? `\n\`\`\`\n${err.stack.slice(0, 2500)}\n\`\`\`` : '';
  await c.web.chat.postMessage({ channel: c.channel, text: text + stack });
}
