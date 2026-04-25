import Airtable from 'airtable';
import { loadConfig, type PaymentReminderConfig } from './config';

export interface UnpaidRecord {
  recordId: string;
  name: string;
  bizNo: string;
  amount: number;
}

export function previousMonthView(now: Date = new Date()): string {
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return `[${prev.getMonth() + 1}월] 세금계산서 및 입금현황`;
}

export function formatYearMonth(now: Date = new Date()): string {
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const y = prev.getFullYear();
  const m = String(prev.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export async function fetchUnpaid(
  cfgOverride?: PaymentReminderConfig,
  now: Date = new Date(),
): Promise<UnpaidRecord[]> {
  const cfg = cfgOverride ?? loadConfig();
  const base = new Airtable({ apiKey: cfg.airtablePat }).base(cfg.airtableBaseId);
  const table = base(cfg.airtableTableId);

  const records = await table
    .select({
      view: previousMonthView(now),
      filterByFormula: `{${cfg.statusField}}='출금실패'`,
    })
    .all();

  return records.map((r) => ({
    recordId: r.id,
    name: String(r.get(cfg.nameField) ?? ''),
    bizNo: String(r.get(cfg.bizNoField) ?? ''),
    amount: Number(r.get(cfg.amountField) ?? 0),
  }));
}

export async function markAsRequested(
  recordId: string,
  cfgOverride?: PaymentReminderConfig,
): Promise<void> {
  const cfg = cfgOverride ?? loadConfig();
  const base = new Airtable({ apiKey: cfg.airtablePat }).base(cfg.airtableBaseId);
  const table = base(cfg.airtableTableId);
  await table.update(recordId, { [cfg.statusField]: '입금요청' });
}
