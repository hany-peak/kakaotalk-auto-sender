import { fetchUnpaid, markAsRequested, formatYearMonth, type UnpaidRecord } from './airtable';
import { buildMessage } from './message';
import { sendBatch } from './sender';
import { loadConfig } from './config';

export interface PreviewItem {
  recordId: string;
  name: string;
  bizNo: string;
  amount: number;
  message: string;
}

export interface PreviewResult {
  yearMonth: string;
  targets: PreviewItem[];
}

export async function buildPreview(now: Date = new Date()): Promise<PreviewResult> {
  const cfg = loadConfig();
  const records = await fetchUnpaid(cfg, now);
  const yearMonth = formatYearMonth(now);
  const targets = records.map((r) => ({
    recordId: r.recordId,
    name: r.name,
    bizNo: r.bizNo,
    amount: r.amount,
    message: buildMessage(r, { yearMonth, bankAccount: cfg.bankAccount }),
  }));
  return { yearMonth, targets };
}

export interface SendRequest {
  recordIds: string[];
  isStopped: () => boolean;
  log: (msg: string) => void;
}

export async function sendSelected(req: SendRequest, now: Date = new Date()) {
  const cfg = loadConfig();
  const records: UnpaidRecord[] = await fetchUnpaid(cfg, now);
  const idSet = new Set(req.recordIds);
  const selected = records.filter((r) => idSet.has(r.recordId));
  const yearMonth = formatYearMonth(now);

  const inputs = selected.map((record) => ({
    record,
    message: buildMessage(record, { yearMonth, bankAccount: cfg.bankAccount }),
  }));

  const { stats, perRecord } = await sendBatch(inputs, req.isStopped, req.log);

  for (const r of perRecord) {
    if (r.success) {
      try {
        await markAsRequested(r.recordId, cfg);
      } catch (err) {
        req.log(`[payment-reminder] markAsRequested failed for ${r.recordId}: ${err instanceof Error ? err.message : err}`);
      }
    }
  }

  return { stats, yearMonth };
}
