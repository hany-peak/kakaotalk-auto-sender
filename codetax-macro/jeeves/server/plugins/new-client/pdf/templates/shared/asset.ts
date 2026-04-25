import { readFileSync } from 'node:fs';
import * as path from 'node:path';

const ASSETS_DIR = path.join(__dirname, '..', '..', 'assets');
const cache = new Map<string, string>();

export function assetDataUrl(filename: string): string {
  const cached = cache.get(filename);
  if (cached) return cached;
  const buf = readFileSync(path.join(ASSETS_DIR, filename));
  const mime = filename.toLowerCase().endsWith('.png')
    ? 'image/png'
    : filename.toLowerCase().endsWith('.jpg') || filename.toLowerCase().endsWith('.jpeg')
      ? 'image/jpeg'
      : 'application/octet-stream';
  const url = `data:${mime};base64,${buf.toString('base64')}`;
  cache.set(filename, url);
  return url;
}
