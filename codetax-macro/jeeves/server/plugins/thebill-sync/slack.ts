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

function client(): { web: WebClient; channel: string } {
  const cfg = loadConfig();
  return { web: new WebClient(cfg.slackBotToken), channel: cfg.slackChannel };
}

export async function notifySuccess(result: SyncResult, durationMs: number): Promise<void> {
  const { web, channel } = client();
  const sec = Math.round(durationMs / 1000);
  const text =
    `✅ thebill-sync 완료 — 총 ${result.total}건 ` +
    `(수정 ${result.updated} / 생성 ${result.created} / 실패 ${result.failed} / 스킵 ${result.skipped}) / ${sec}초`;
  await web.chat.postMessage({ channel, text });
}

export async function notifyFailure(err: Error, stage?: string): Promise<void> {
  const { web, channel } = client();
  const stageTag = stage ? ` [${stage}]` : '';
  const text = `❌ thebill-sync 실패${stageTag} — ${err.message}`;
  const stack = err.stack ? `\n\`\`\`\n${err.stack.slice(0, 2500)}\n\`\`\`` : '';
  await web.chat.postMessage({ channel, text: text + stack });
}
