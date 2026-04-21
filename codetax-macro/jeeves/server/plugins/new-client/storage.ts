import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import type { NewClientInput, NewClientRecord } from './types';

export async function readAll(file: string): Promise<NewClientRecord[]> {
  try {
    const raw = await fs.promises.readFile(file, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as NewClientRecord[];
  } catch (err: any) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

export async function append(
  file: string,
  input: NewClientInput,
): Promise<NewClientRecord> {
  const record: NewClientRecord = {
    ...input,
    id: randomUUID(),
    createdAt: new Date().toISOString(),
  };

  await fs.promises.mkdir(path.dirname(file), { recursive: true });
  const existing = await readAll(file);
  existing.push(record);
  await fs.promises.writeFile(file, JSON.stringify(existing, null, 2), 'utf-8');

  return record;
}
