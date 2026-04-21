import Airtable from 'airtable';
import { loadConfig } from './config';
import type { ThebillRow } from './parser';

export interface SyncResult {
  total: number;
  updated: number;
  created: number;
  failed: number;
  skipped: number;
  errors: { key: string; error: string }[];
}

function escapeFormulaValue(v: string): string {
  return v.replace(/'/g, "\\'");
}

export async function upsertAll(rows: ThebillRow[]): Promise<SyncResult> {
  const cfg = loadConfig();
  const base = new Airtable({ apiKey: cfg.airtablePat }).base(cfg.airtableBaseId);
  const table = base(cfg.airtableTableName);

  const result: SyncResult = {
    total: rows.length,
    updated: 0,
    created: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  };

  for (const row of rows) {
    const keyVal = row[cfg.airtableKeyField];
    if (keyVal === null || keyVal === undefined || keyVal === '') {
      result.skipped += 1;
      continue;
    }

    const keyStr = String(keyVal);
    try {
      const existing = await table
        .select({
          maxRecords: 1,
          filterByFormula: `{${cfg.airtableKeyField}}='${escapeFormulaValue(keyStr)}'`,
        })
        .firstPage();

      const fields = row as Record<string, unknown>;

      if (existing.length > 0) {
        await table.update(existing[0].id, fields as any);
        result.updated += 1;
      } else {
        await table.create(fields as any);
        result.created += 1;
      }
    } catch (err) {
      result.failed += 1;
      result.errors.push({
        key: keyStr,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return result;
}
