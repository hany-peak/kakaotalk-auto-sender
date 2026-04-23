import { WebClient } from '@slack/web-api';
import type { NewClientConfig } from './config';
import type { NewClientRecord } from './types';

function formatWon(n: number): string {
  return `${n.toLocaleString('en-US')}원`;
}

function formatKstTimestamp(iso: string): string {
  const d = new Date(iso);
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const y = kst.getUTCFullYear();
  const m = String(kst.getUTCMonth() + 1).padStart(2, '0');
  const day = String(kst.getUTCDate()).padStart(2, '0');
  const hh = String(kst.getUTCHours()).padStart(2, '0');
  const mm = String(kst.getUTCMinutes()).padStart(2, '0');
  return `${y}-${m}-${day} ${hh}:${mm}`;
}

export function buildBlocks(r: NewClientRecord): any[] {
  const blocks: any[] = [
    {
      type: 'header',
      text: { type: 'plain_text', text: '📋 신규 수임처 등록' },
    },
    { type: 'divider' },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*업체명*\n${r.companyName}` },
        { type: 'mrkdwn', text: `*업무 범위*\n${r.businessScope}` },
        { type: 'mrkdwn', text: `*대표자*\n${r.representative}` },
        { type: 'mrkdwn', text: `*업무착수일*\n${r.startDate}` },
        { type: 'mrkdwn', text: `*업종*\n${r.industry}` },
        { type: 'mrkdwn', text: `*유입경로*\n${r.inflowRoute}` },
        { type: 'mrkdwn', text: `*기장료*\n${r.bookkeepingFee !== undefined ? formatWon(r.bookkeepingFee) : '-'}` },
        { type: 'mrkdwn', text: `*조정료*\n${r.adjustmentFee !== undefined ? formatWon(r.adjustmentFee) : '-'}` },
      ],
    },
  ];

  if (r.contractNote && r.contractNote.trim() !== '') {
    blocks.push({ type: 'divider' });
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `*📝 계약특이사항*\n${r.contractNote}` },
    });
  }

  blocks.push({
    type: 'context',
    elements: [{ type: 'mrkdwn', text: `등록: ${formatKstTimestamp(r.createdAt)}` }],
  });

  return blocks;
}

/**
 * Attempts to send a Slack notification. Returns true on success, false on
 * any failure (missing config, network, or Slack API error). Never throws.
 */
export async function notifyNewClient(
  record: NewClientRecord,
  cfg: NewClientConfig,
  logError: (msg: string) => void,
): Promise<boolean> {
  if (!cfg.slackBotToken) {
    logError('[new-client] SLACK_BOT_TOKEN not set — skipping slack notify');
    return false;
  }
  if (!cfg.slackChannel) {
    logError('[new-client] SLACK_NEW_CLIENT_CHANNEL not set — skipping slack notify');
    return false;
  }

  try {
    const web = new WebClient(cfg.slackBotToken);
    await web.chat.postMessage({
      channel: cfg.slackChannel,
      text: `신규 수임처 등록: ${record.companyName}`,
      blocks: buildBlocks(record),
    });
    return true;
  } catch (err: any) {
    logError(`[new-client] slack notify failed: ${err.message || err}`);
    return false;
  }
}
