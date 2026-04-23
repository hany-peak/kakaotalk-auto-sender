import type { BusinessScope, EntityType } from './types';
import type { NewClientConfig } from './config';

const TEAM_FOLDER_ROOT = '/세무법인의 팀 폴더/2.기장';

/**
 * Returns the Dropbox parent path for a new client based on entity/scope combination.
 * Paths are returned without a trailing slash.
 */
export function resolveParentPath(
  entityType: EntityType,
  businessScope: BusinessScope,
): string {
  if (entityType === '개인' && businessScope === '기장') return `${TEAM_FOLDER_ROOT}/개인/일반기장`;
  if (entityType === '개인' && businessScope === '신고대리') return `${TEAM_FOLDER_ROOT}/개인/신고대리`;
  if (entityType === '법인' && businessScope === '기장') return `${TEAM_FOLDER_ROOT}/법인`;
  if (entityType === '법인' && businessScope === '신고대리') return `${TEAM_FOLDER_ROOT}/법인/000 신고대리`;
  // Exhaustiveness guard — should be unreachable if types are correct.
  throw new Error(`unreachable: ${entityType} × ${businessScope}`);
}

/**
 * Extracts leading digits from a folder name. Returns null if no leading digits.
 */
export function parseLeadingNumber(name: string): number | null {
  const m = name.match(/^(\d+)/);
  if (!m) return null;
  return parseInt(m[1], 10);
}

/**
 * Formats a client folder name as "NNN. 업체명" with 3-digit zero-pad (4+ digits stay as-is).
 */
export function formatFolderName(n: number, companyName: string): string {
  const padded = n < 1000 ? String(n).padStart(3, '0') : String(n);
  return `${padded}. ${companyName}`;
}

export interface DropboxCreds {
  appKey: string;
  appSecret: string;
  refreshToken: string;
  teamRootNsId: string;
}

export function extractCreds(cfg: NewClientConfig): DropboxCreds | null {
  const d = cfg.dropbox;
  if (!d.appKey || !d.appSecret || !d.refreshToken || !d.teamRootNsId) return null;
  return {
    appKey: d.appKey,
    appSecret: d.appSecret,
    refreshToken: d.refreshToken,
    teamRootNsId: d.teamRootNsId,
  };
}

// In-memory token cache. Invalidated when expiry passes.
let tokenCache: { accessToken: string; expiresAt: number } | null = null;

export async function getAccessToken(creds: DropboxCreds): Promise<string> {
  const now = Date.now();
  if (tokenCache && tokenCache.expiresAt > now + 30_000) {
    return tokenCache.accessToken;
  }
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: creds.refreshToken,
  });
  const auth = Buffer.from(`${creds.appKey}:${creds.appSecret}`).toString('base64');
  const res = await fetch('https://api.dropboxapi.com/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${auth}`,
    },
    body,
  });
  if (!res.ok) {
    throw new Error(`dropbox token refresh failed: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as { access_token: string; expires_in: number };
  tokenCache = {
    accessToken: json.access_token,
    expiresAt: now + json.expires_in * 1000,
  };
  return json.access_token;
}

// For tests: reset in-memory token cache.
export function _resetTokenCacheForTests(): void {
  tokenCache = null;
}

interface FolderEntry {
  '.tag': 'folder' | 'file';
  name: string;
}

async function dbxApi<T>(
  endpoint: string,
  creds: DropboxCreds,
  bodyJson: unknown,
): Promise<T> {
  const token = await getAccessToken(creds);
  const res = await fetch(`https://api.dropboxapi.com${endpoint}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Dropbox-API-Path-Root': JSON.stringify({ '.tag': 'root', root: creds.teamRootNsId }),
    },
    body: JSON.stringify(bodyJson),
  });
  if (!res.ok) {
    throw new Error(`dropbox ${endpoint} failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as T;
}

export async function listFolder(
  path: string,
  creds: DropboxCreds,
): Promise<FolderEntry[]> {
  const entries: FolderEntry[] = [];
  let cursor: string | null = null;
  let hasMore = true;
  while (hasMore) {
    const endpoint: string = cursor ? '/2/files/list_folder/continue' : '/2/files/list_folder';
    const body: unknown = cursor ? { cursor } : { path, recursive: false };
    const resp: { entries: FolderEntry[]; has_more: boolean; cursor: string } =
      await dbxApi<{ entries: FolderEntry[]; has_more: boolean; cursor: string }>(
        endpoint,
        creds,
        body,
      );
    entries.push(...resp.entries);
    hasMore = resp.has_more;
    cursor = resp.cursor;
  }
  return entries;
}

export interface FolderStatusResult {
  exists: boolean;
  baseFiles: string[];
}

/**
 * Checks whether the given client folder exists on Dropbox, and if so returns
 * the file names inside its "1. 기초자료" subfolder. If the folder or its
 * subfolder is missing (path/not_found), returns exists:false with empty files.
 */
export async function getFolderStatus(
  clientPath: string,
  creds: DropboxCreds,
): Promise<FolderStatusResult> {
  try {
    const entries = await listFolder(`${clientPath}/1. 기초자료`, creds);
    return {
      exists: true,
      baseFiles: entries
        .filter((e) => e['.tag'] === 'file')
        .map((e) => e.name),
    };
  } catch (err: any) {
    const msg = err?.message ?? '';
    if (msg.includes('path/not_found') || msg.includes('"not_found"')) {
      return { exists: false, baseFiles: [] };
    }
    throw err;
  }
}

export async function nextFolderNumber(
  parentPath: string,
  creds: DropboxCreds,
): Promise<number> {
  const entries = await listFolder(parentPath, creds);
  let max = 0;
  for (const e of entries) {
    if (e['.tag'] !== 'folder') continue;
    const n = parseLeadingNumber(e.name);
    if (n !== null && n > max) max = n;
  }
  return max + 1;
}

export interface CreateResult {
  path: string;
}

export async function createClientFolders(
  entityType: EntityType,
  businessScope: BusinessScope,
  companyName: string,
  creds: DropboxCreds,
): Promise<CreateResult> {
  const parent = resolveParentPath(entityType, businessScope);
  const n = await nextFolderNumber(parent, creds);
  const folderName = formatFolderName(n, companyName);
  const clientPath = `${parent}/${folderName}`;
  const basePath = `${clientPath}/1. 기초자료`;

  // Two sequential create_folder_v2 calls — parent must exist before child.
  // (Dropbox HTTP API has no create_folder_batch_v2 endpoint.)
  await dbxApi<unknown>('/2/files/create_folder_v2', creds, {
    path: clientPath,
    autorename: false,
  });
  await dbxApi<unknown>('/2/files/create_folder_v2', creds, {
    path: basePath,
    autorename: false,
  });

  return { path: clientPath };
}
