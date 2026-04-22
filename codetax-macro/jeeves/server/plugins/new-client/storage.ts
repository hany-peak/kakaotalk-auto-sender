import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import type { NewClientInput, NewClientRecord, ChecklistItemState } from './types';
import type { ChecklistItemKey } from './checklist-config';

function normalize(record: any): NewClientRecord {
  return {
    ...record,
    checklist: record.checklist ?? {},
  };
}

export async function readAll(file: string): Promise<NewClientRecord[]> {
  try {
    const raw = await fs.promises.readFile(file, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return (parsed as any[]).map(normalize);
  } catch (err: any) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

export async function readOne(
  file: string,
  id: string,
): Promise<NewClientRecord | null> {
  const all = await readAll(file);
  return all.find((r) => r.id === id) ?? null;
}

export async function append(
  file: string,
  input: NewClientInput,
): Promise<NewClientRecord> {
  const now = new Date().toISOString();
  const checklist: NewClientRecord['checklist'] = {};
  // bizRegStatus='기존' 이면 사업자등록증 체크리스트를 '기존발급' 으로 선반영.
  // doneStates 에 '기존발급' 이 포함되어 있어 이 상태도 완료로 집계됨.
  if (input.bizRegStatus === '기존') {
    checklist.businessLicense = { status: '기존발급', updatedAt: now };
  }
  const record: NewClientRecord = {
    ...input,
    id: randomUUID(),
    createdAt: now,
    checklist,
  };

  await fs.promises.mkdir(path.dirname(file), { recursive: true });
  const existing = await readAll(file);
  existing.push(record);
  await fs.promises.writeFile(file, JSON.stringify(existing, null, 2), 'utf-8');

  return record;
}

export async function setAirtableRecordId(
  file: string,
  id: string,
  airtableRecordId: string,
): Promise<void> {
  const all = await readAll(file);
  const idx = all.findIndex((r) => r.id === id);
  if (idx < 0) return;
  all[idx].airtableRecordId = airtableRecordId;
  await fs.promises.writeFile(file, JSON.stringify(all, null, 2), 'utf-8');
}

export interface ChecklistUpdatePayload {
  status?: string;
  value?: string;
  note?: string;
}

/**
 * Updates a single checklist item state. Returns the updated state, or null if
 * the client record is not found. The caller is responsible for validating that
 * `updates` conforms to the item's kind.
 */
export async function updateChecklistItem(
  file: string,
  id: string,
  itemKey: ChecklistItemKey,
  updates: ChecklistUpdatePayload,
  kind: 'binary' | 'enum' | 'value',
): Promise<ChecklistItemState | null> {
  const all = await readAll(file);
  const idx = all.findIndex((r) => r.id === id);
  if (idx < 0) return null;

  const record = all[idx];
  const existing = record.checklist[itemKey];

  const nextNote =
    updates.note !== undefined ? updates.note : existing?.note;

  const next: ChecklistItemState = {
    updatedAt: new Date().toISOString(),
  };
  if (kind === 'value') {
    if (updates.value !== undefined) {
      next.value = updates.value;
    } else if (existing?.value !== undefined) {
      next.value = existing.value;
    }
  } else {
    if (updates.status !== undefined) {
      next.status = updates.status;
    } else if (existing?.status !== undefined) {
      next.status = existing.status;
    }
  }
  if (nextNote !== undefined) next.note = nextNote;

  record.checklist[itemKey] = next;
  all[idx] = record;

  await fs.promises.writeFile(file, JSON.stringify(all, null, 2), 'utf-8');
  return next;
}
