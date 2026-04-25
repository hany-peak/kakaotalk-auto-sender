# Dropbox Folder Creation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 신규 수임처 등록 시 Dropbox API로 거래처 폴더(`NNN. 업체명/`)와 `1. 기초자료/` 서브폴더를 자동 생성하고, 실패 시 체크리스트에 error 상태로 표시해 재시도 가능하게 한다.

**Architecture:** 서버 `plugins/new-client/dropbox.ts` 모듈이 refresh token으로 access token 갱신, 팀 namespace 헤더로 팀 폴더에 접근, `list_folder`로 번호 max 계산 후 `create_folder_batch_v2`로 2개 폴더 동시 생성. submit 핸들러가 Slack·Airtable 싱크 뒤에 호출하며, 실패는 등록 성공을 막지 않고 체크리스트에 기록된다. 클라이언트는 등록 폼에 `entityType: 개인/법인` 라디오를 추가하고 체크리스트에 error/재시도 UI를 붙인다.

**Tech Stack:** TypeScript · Node `fetch` · Express · React · Tailwind v4. 테스트는 `tsx --test` + `node:test` + `node:assert`.

**Spec:** [docs/superpowers/specs/2026-04-23-dropbox-folder-creation-design.md](../specs/2026-04-23-dropbox-folder-creation-design.md)

**Environment (이미 설정 완료):** `.env`에 `DROPBOX_APP_KEY`, `DROPBOX_APP_SECRET`, `DROPBOX_REFRESH_TOKEN`, `DROPBOX_TEAM_ROOT_NS_ID=11439656593` 존재.

---

## File Structure

**New files (server):**
- `jeeves/server/plugins/new-client/dropbox.ts` — API 클라이언트 + pure 함수 (경로 결정, 번호 파싱, 폴더 생성)
- `jeeves/server/plugins/new-client/dropbox.test.ts` — pure 함수 + 파싱 로직 단위 테스트

**Modified files (server):**
- `plugins/new-client/types.ts` — `ENTITY_TYPES`, `EntityType`, `NewClientInput.entityType`, `NewClientRecord.dropboxFolderPath`
- `plugins/new-client/checklist-config.ts` — `dropboxFolder` states: `['none', 'done', 'error']`, kind: `'enum'`, doneStates: `['done']`
- `plugins/new-client/validate.ts` — `entityType` enum 검증 추가
- `plugins/new-client/storage.ts` — `setDropboxFolderPath(file, id, path)` 함수 추가
- `plugins/new-client/config.ts` — `dropbox: { appKey, appSecret, refreshToken, teamRootNsId }` 필드 추가
- `plugins/new-client/routes.ts` — submit 핸들러에 Dropbox 생성 스텝, `POST /new-client/:id/dropbox-folder/retry` 추가

**Modified files (client):**
- `plugins/new-client/types.ts` — `ENTITY_TYPES`, `EntityType`, `NewClientInput.entityType`, `NewClientRecord.dropboxFolderPath`; `CHECKLIST_ITEMS` 중 `dropboxFolder` states 업데이트
- `plugins/new-client/components/NewClientForm.tsx` — `entityType` 라디오 (업무범위 옆)
- `plugins/new-client/components/ChecklistItemRow.tsx` — `dropboxFolder` 전용 렌더링 (status별 badge + error 시 재시도 버튼)
- `plugins/new-client/hooks/useChecklistUpdate.ts` — `retryDropboxFolder(clientId)` 함수 추가 (또는 `useDropboxRetry` 신규 훅)
- `plugins/new-client/NewClientPage.tsx` — `DetailView` InfoCard에 `dropboxFolderPath` 행 (있을 때만)

**Modified files (infra):**
- `jeeves/server/package.json` — `"test": "tsx --test plugins/**/*.test.ts"` 스크립트 추가

---

## Task 0: Setup — Verify environment

**Files:**
- Read: `jeeves/.env`

- [ ] **Step 1: Confirm env values exist**

Run:
```bash
cd /Users/hany/workzone/codetax-macro/jeeves
grep -E "^DROPBOX_(APP_KEY|APP_SECRET|REFRESH_TOKEN|TEAM_ROOT_NS_ID)=" .env
```
Expected: 4 lines with non-empty values. If any are empty, STOP and ask user to rerun OAuth flow.

- [ ] **Step 2: Smoke-test API access (refresh token + list folder)**

Run:
```bash
cd /Users/hany/workzone/codetax-macro/jeeves
set -a && source .env && set +a

# Exchange refresh token for access token
ACCESS=$(curl -s -X POST https://api.dropboxapi.com/oauth2/token \
  -u "$DROPBOX_APP_KEY:$DROPBOX_APP_SECRET" \
  -d "refresh_token=$DROPBOX_REFRESH_TOKEN" \
  -d "grant_type=refresh_token" | python3 -c "import json,sys;print(json.load(sys.stdin)['access_token'])")

# List 2.기장 via team root namespace
curl -s -X POST https://api.dropboxapi.com/2/files/list_folder \
  -H "Authorization: Bearer $ACCESS" \
  -H "Content-Type: application/json" \
  -H "Dropbox-API-Path-Root: {\".tag\":\"root\",\"root\":\"$DROPBOX_TEAM_ROOT_NS_ID\"}" \
  -d '{"path":"/세무법인의 팀 폴더/2.기장"}' | python3 -c "import json,sys;d=json.load(sys.stdin);print([e['name'] for e in d['entries']])"
```
Expected: `['개인', '법인']` (exact order may vary). If error, halt plan.

---

## Task 1: Server types — Add entityType + dropboxFolderPath

**Files:**
- Modify: `jeeves/server/plugins/new-client/types.ts`

- [ ] **Step 1: Add ENTITY_TYPES enum and fields**

Edit `jeeves/server/plugins/new-client/types.ts`. After the `BIZ_REG_STATUSES` block add:
```ts
export const ENTITY_TYPES = ['개인', '법인'] as const;
export type EntityType = typeof ENTITY_TYPES[number];
```

Then add `entityType: EntityType;` to `NewClientInput` interface (place it right after `businessScope`):
```ts
export interface NewClientInput {
  companyName: string;
  businessScope: BusinessScope;
  entityType: EntityType;
  representative: string;
  // ... rest unchanged
}
```

Replace the existing `NewClientRecord` interface so `entityType` is optional on records (hỗ trợ 기존 레코드 migration). Full replacement:
```ts
export interface NewClientRecord extends Omit<NewClientInput, 'entityType'> {
  id: string;
  createdAt: string;
  checklist: ChecklistState;
  airtableRecordId?: string;
  entityType?: EntityType;       // 신규 레코드엔 존재, 기존 레코드엔 undefined
  dropboxFolderPath?: string;    // 생성 성공 시 전체 경로 저장
}
```

Also extend `SubmitResponse`:
```ts
export interface SubmitResponse {
  ok: true;
  id: string;
  slackNotified: boolean;
  airtableSynced: boolean;
  dropboxFolderCreated: boolean;
  dropboxFolderPath?: string;
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/hany/workzone/codetax-macro
git add jeeves/server/plugins/new-client/types.ts
git commit -m "feat(new-client): add entityType and dropboxFolderPath to server types"
```

---

## Task 2: Server validation — entityType enum check

**Files:**
- Modify: `jeeves/server/plugins/new-client/validate.ts`

- [ ] **Step 1: Write failing behavioral assertion**

Create `jeeves/server/plugins/new-client/validate.test.ts`:
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateInput } from './validate';

const BASE = {
  companyName: '테스트업체',
  businessScope: '기장',
  entityType: '개인',
  representative: '홍길동',
  startDate: '2026-04-23',
  industry: '제조업',
  bookkeepingFee: 100000,
  adjustmentFee: 0,
  inflowRoute: '소개1',
  transferStatus: '신규',
  bizRegStatus: '기존',
};

test('validateInput accepts valid 개인 entityType', () => {
  const r = validateInput(BASE);
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.value.entityType, '개인');
});

test('validateInput accepts 법인 entityType', () => {
  const r = validateInput({ ...BASE, entityType: '법인' });
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.value.entityType, '법인');
});

test('validateInput rejects missing entityType', () => {
  const { entityType: _, ...rest } = BASE;
  const r = validateInput(rest);
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.error, /entityType/);
});

test('validateInput rejects invalid entityType', () => {
  const r = validateInput({ ...BASE, entityType: '공공기관' });
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.error, /entityType/);
});
```

- [ ] **Step 2: Add test npm script**

Edit `jeeves/server/package.json`. In `scripts`, add `"test"`:
```json
"scripts": {
  "dev": "tsx watch index.ts",
  "start": "tsx index.ts",
  "build": "tsc",
  "test": "tsx --test plugins/**/*.test.ts",
  "install:browser": "npx playwright install chromium"
}
```

- [ ] **Step 3: Run test to verify it fails**

Run:
```bash
cd /Users/hany/workzone/codetax-macro/jeeves/server
npm test 2>&1 | tail -20
```
Expected: 4 tests, some fail with "invalid entityType" not being reported (because validator currently ignores the field).

- [ ] **Step 4: Add entityType validation in validate.ts**

In `jeeves/server/plugins/new-client/validate.ts`, import `ENTITY_TYPES`:
```ts
import {
  BUSINESS_SCOPES,
  ENTITY_TYPES,
  INFLOW_ROUTES,
  // ... rest of imports
```

After the `businessScope` validation block (around line 51), add:
```ts
  const entityType = b.entityType;
  if (typeof entityType !== 'string' || !ENTITY_TYPES.includes(entityType as any)) {
    return { ok: false, error: 'invalid entityType' };
  }
```

In the `return { ok: true, value: { ... } }` block, add `entityType` right after `businessScope`:
```ts
      businessScope: businessScope as NewClientInput['businessScope'],
      entityType: entityType as NewClientInput['entityType'],
```

- [ ] **Step 5: Run tests — must pass**

Run:
```bash
cd /Users/hany/workzone/codetax-macro/jeeves/server
npm test 2>&1 | tail -10
```
Expected: 4 tests pass.

- [ ] **Step 6: Commit**

```bash
cd /Users/hany/workzone/codetax-macro
git add jeeves/server/plugins/new-client/validate.ts jeeves/server/plugins/new-client/validate.test.ts jeeves/server/package.json
git commit -m "feat(new-client): validate entityType enum"
```

---

## Task 3: Checklist config — dropboxFolder states

**Files:**
- Modify: `jeeves/server/plugins/new-client/checklist-config.ts`

- [ ] **Step 1: Update dropboxFolder definition**

In `jeeves/server/plugins/new-client/checklist-config.ts`, find the `dropboxFolder` entry in `CHECKLIST_ITEMS` (~line 62):
```ts
  { key: 'dropboxFolder', label: '드롭박스 생성', step: 3, kind: 'binary',
    states: ['none', 'done'],
    description: '드롭박스 기장 거래처 폴더 생성 (2.기장/업체명)' },
```

Replace with:
```ts
  { key: 'dropboxFolder', label: '드롭박스 생성', step: 3, kind: 'enum',
    states: ['none', 'done', 'error'],
    doneStates: ['done'],
    description: '등록 시 자동 생성 (실패 시 error + 재시도 버튼)' },
```

- [ ] **Step 2: Commit**

```bash
cd /Users/hany/workzone/codetax-macro
git add jeeves/server/plugins/new-client/checklist-config.ts
git commit -m "feat(new-client): extend dropboxFolder states with error"
```

---

## Task 4: Storage — setDropboxFolderPath function

**Files:**
- Modify: `jeeves/server/plugins/new-client/storage.ts`

- [ ] **Step 1: Add function**

In `jeeves/server/plugins/new-client/storage.ts`, after `setAirtableRecordId` (~line 70), add:
```ts
export async function setDropboxFolderPath(
  file: string,
  id: string,
  dropboxFolderPath: string,
): Promise<void> {
  const all = await readAll(file);
  const idx = all.findIndex((r) => r.id === id);
  if (idx < 0) return;
  all[idx].dropboxFolderPath = dropboxFolderPath;
  await fs.promises.writeFile(file, JSON.stringify(all, null, 2), 'utf-8');
}
```

- [ ] **Step 2: Type check**

Run:
```bash
cd /Users/hany/workzone/codetax-macro/jeeves/server && npx tsc --noEmit
```
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
cd /Users/hany/workzone/codetax-macro
git add jeeves/server/plugins/new-client/storage.ts
git commit -m "feat(new-client): add setDropboxFolderPath storage helper"
```

---

## Task 5: Dropbox — Pure functions with tests (TDD)

**Files:**
- Create: `jeeves/server/plugins/new-client/dropbox.ts`
- Create: `jeeves/server/plugins/new-client/dropbox.test.ts`

- [ ] **Step 1: Write failing tests for pure functions**

Create `jeeves/server/plugins/new-client/dropbox.test.ts`:
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveParentPath, parseLeadingNumber, formatFolderName } from './dropbox';

test('resolveParentPath: 개인 × 기장', () => {
  assert.equal(
    resolveParentPath('개인', '기장'),
    '/세무법인의 팀 폴더/2.기장/개인/일반기장',
  );
});

test('resolveParentPath: 개인 × 신고대리', () => {
  assert.equal(
    resolveParentPath('개인', '신고대리'),
    '/세무법인의 팀 폴더/2.기장/개인/신고대리',
  );
});

test('resolveParentPath: 법인 × 기장', () => {
  assert.equal(
    resolveParentPath('법인', '기장'),
    '/세무법인의 팀 폴더/2.기장/법인',
  );
});

test('resolveParentPath: 법인 × 신고대리', () => {
  assert.equal(
    resolveParentPath('법인', '신고대리'),
    '/세무법인의 팀 폴더/2.기장/법인/000 신고대리',
  );
});

test('parseLeadingNumber: "334. 메이저랩" → 334', () => {
  assert.equal(parseLeadingNumber('334. 메이저랩'), 334);
});

test('parseLeadingNumber: "096 (주)힐스타" → 96', () => {
  assert.equal(parseLeadingNumber('096 (주)힐스타'), 96);
});

test('parseLeadingNumber: "99 전태빈_50,000원 신고" → 99', () => {
  assert.equal(parseLeadingNumber('99 전태빈_50,000원 신고'), 99);
});

test('parseLeadingNumber: "기한후신고.xlsx" → null (no leading digits)', () => {
  assert.equal(parseLeadingNumber('기한후신고.xlsx'), null);
});

test('parseLeadingNumber: empty string → null', () => {
  assert.equal(parseLeadingNumber(''), null);
});

test('formatFolderName: zero-pad to 3 digits', () => {
  assert.equal(formatFolderName(1, '홍길동'), '001. 홍길동');
  assert.equal(formatFolderName(97, '(주)아모레'), '097. (주)아모레');
  assert.equal(formatFolderName(335, '메이저랩'), '335. 메이저랩');
});

test('formatFolderName: 4-digit number stays as-is', () => {
  assert.equal(formatFolderName(1000, 'X'), '1000. X');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
cd /Users/hany/workzone/codetax-macro/jeeves/server
npm test 2>&1 | tail -20
```
Expected: FAIL — `Cannot find module './dropbox'` or similar.

- [ ] **Step 3: Implement pure functions**

Create `jeeves/server/plugins/new-client/dropbox.ts`:
```ts
import type { BusinessScope, EntityType } from './types';

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
```

- [ ] **Step 4: Run tests — must pass**

Run:
```bash
cd /Users/hany/workzone/codetax-macro/jeeves/server
npm test 2>&1 | tail -30
```
Expected: all 15 tests pass (4 from validate + 11 from dropbox).

- [ ] **Step 5: Commit**

```bash
cd /Users/hany/workzone/codetax-macro
git add jeeves/server/plugins/new-client/dropbox.ts jeeves/server/plugins/new-client/dropbox.test.ts
git commit -m "feat(new-client): add dropbox pure functions for path/number logic"
```

---

## Task 6: Dropbox — Config wiring

**Files:**
- Modify: `jeeves/server/plugins/new-client/config.ts`

- [ ] **Step 1: Add dropbox config section**

In `jeeves/server/plugins/new-client/config.ts`, extend `NewClientConfig` and `loadConfig`:
```ts
export interface NewClientConfig {
  slackBotToken: string | undefined;
  slackChannel: string | undefined;
  dataFile: string;
  airtableNewClientPat: string | undefined;
  airtableNewClientBaseId: string | undefined;
  airtableNewClientTableName: string;
  dropbox: {
    appKey: string | undefined;
    appSecret: string | undefined;
    refreshToken: string | undefined;
    teamRootNsId: string | undefined;
  };
}

export function loadConfig(): NewClientConfig {
  return {
    slackBotToken: process.env.SLACK_BOT_TOKEN,
    slackChannel: process.env.SLACK_NEW_CLIENT_CHANNEL,
    dataFile: path.resolve(__dirname, '../../data/new-clients.json'),
    airtableNewClientPat: process.env.AIRTABLE_NEW_CLIENT_PAT,
    airtableNewClientBaseId: process.env.AIRTABLE_NEW_CLIENT_BASE_ID,
    airtableNewClientTableName: process.env.AIRTABLE_NEW_CLIENT_TABLE_NAME || '거래처',
    dropbox: {
      appKey: process.env.DROPBOX_APP_KEY,
      appSecret: process.env.DROPBOX_APP_SECRET,
      refreshToken: process.env.DROPBOX_REFRESH_TOKEN,
      teamRootNsId: process.env.DROPBOX_TEAM_ROOT_NS_ID,
    },
  };
}
```

- [ ] **Step 2: Type check**

Run:
```bash
cd /Users/hany/workzone/codetax-macro/jeeves/server && npx tsc --noEmit
```
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
cd /Users/hany/workzone/codetax-macro
git add jeeves/server/plugins/new-client/config.ts
git commit -m "feat(new-client): add dropbox config section"
```

---

## Task 7: Dropbox — API client (token + list + create)

**Files:**
- Modify: `jeeves/server/plugins/new-client/dropbox.ts`

- [ ] **Step 1: Add API client implementation**

Append the following to the existing `jeeves/server/plugins/new-client/dropbox.ts`:
```ts
import type { NewClientConfig } from './config';

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
    const endpoint = cursor ? '/2/files/list_folder/continue' : '/2/files/list_folder';
    const body = cursor ? { cursor } : { path, recursive: false };
    const resp = (await dbxApi<{ entries: FolderEntry[]; has_more: boolean; cursor: string }>(
      endpoint,
      creds,
      body,
    ));
    entries.push(...resp.entries);
    hasMore = resp.has_more;
    cursor = resp.cursor;
  }
  return entries;
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

  await dbxApi<unknown>('/2/files/create_folder_batch_v2', creds, {
    paths: [clientPath, basePath],
    autorename: false,
    force_async: false,
  });

  return { path: clientPath };
}
```

- [ ] **Step 2: Type check**

Run:
```bash
cd /Users/hany/workzone/codetax-macro/jeeves/server && npx tsc --noEmit
```
Expected: exit 0.

- [ ] **Step 3: Run existing tests still pass**

Run:
```bash
cd /Users/hany/workzone/codetax-macro/jeeves/server && npm test 2>&1 | tail -10
```
Expected: 15 tests pass (pure function tests unaffected).

- [ ] **Step 4: Commit**

```bash
cd /Users/hany/workzone/codetax-macro
git add jeeves/server/plugins/new-client/dropbox.ts
git commit -m "feat(new-client): add dropbox API client (token, list, create)"
```

---

## Task 8: Submit handler — wire dropbox creation

**Files:**
- Modify: `jeeves/server/plugins/new-client/routes.ts`

- [ ] **Step 1: Import dropbox helpers**

In `jeeves/server/plugins/new-client/routes.ts` top imports, add:
```ts
import { setDropboxFolderPath, mergeChecklist } from './storage';
import { createClientFolders, extractCreds } from './dropbox';
```
(Note: `mergeChecklist` is already imported — check before duplicating.)

- [ ] **Step 2: Extend submit handler**

In the `/api/new-client/submit` handler, after the airtable sync block (after the `if (airtableRecordId) { ... }` try block, before the final `return res.json(...)`), insert:

```ts
    let dropboxFolderCreated = false;
    let dropboxFolderPathOut: string | undefined;
    const dropboxCreds = extractCreds(cfg);
    const now = () => new Date().toISOString();
    if (!dropboxCreds) {
      ctx.logError('[new-client] dropbox env missing, skipping folder creation');
      await mergeChecklist(cfg.dataFile, record.id, {
        dropboxFolder: { status: 'error', note: 'DROPBOX_* env 미설정', updatedAt: now() },
      });
    } else {
      try {
        // validated.value.entityType is guaranteed non-undefined here
        // (validate step guarantees it); record.entityType is typed optional
        // only to accommodate legacy records loaded from disk.
        const out = await createClientFolders(
          validated.value.entityType,
          record.businessScope,
          record.companyName,
          dropboxCreds,
        );
        await setDropboxFolderPath(cfg.dataFile, record.id, out.path);
        await mergeChecklist(cfg.dataFile, record.id, {
          dropboxFolder: { status: 'done', updatedAt: now() },
        });
        dropboxFolderCreated = true;
        dropboxFolderPathOut = out.path;
        ctx.log(`[new-client] dropbox folder created: ${out.path}`);
      } catch (err: any) {
        const msg = err?.message ?? String(err);
        ctx.logError(`[new-client] dropbox folder creation failed: ${msg}`);
        await mergeChecklist(cfg.dataFile, record.id, {
          dropboxFolder: { status: 'error', note: msg.slice(0, 500), updatedAt: now() },
        });
      }
    }

    return res.json({
      ok: true,
      id: record.id,
      slackNotified,
      airtableSynced,
      dropboxFolderCreated,
      dropboxFolderPath: dropboxFolderPathOut,
    });
```

And remove the old `return res.json(...)` line that immediately followed the airtable block.

- [ ] **Step 3: Type check**

Run:
```bash
cd /Users/hany/workzone/codetax-macro/jeeves/server && npx tsc --noEmit
```
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
cd /Users/hany/workzone/codetax-macro
git add jeeves/server/plugins/new-client/routes.ts
git commit -m "feat(new-client): create dropbox folder during registration"
```

---

## Task 9: Retry endpoint

**Files:**
- Modify: `jeeves/server/plugins/new-client/routes.ts`

- [ ] **Step 1: Add retry route**

In `jeeves/server/plugins/new-client/routes.ts`, after the existing `/api/new-client/:id/checklist/:itemKey` PATCH handler, add:

```ts
  app.post('/api/new-client/:id/dropbox-folder/retry', async (req, res) => {
    const cfg = loadConfig();
    const now = () => new Date().toISOString();
    try {
      const record = await readOne(cfg.dataFile, req.params.id);
      if (!record) return res.status(404).json({ error: 'not found' });
      if (record.dropboxFolderPath) {
        return res.status(409).json({ error: 'dropbox folder already created', path: record.dropboxFolderPath });
      }
      if (!record.entityType) {
        await mergeChecklist(cfg.dataFile, record.id, {
          dropboxFolder: { status: 'error', note: '기존 레코드 — entityType 없음, 재등록 필요', updatedAt: now() },
        });
        return res.status(400).json({ error: 'record has no entityType (legacy record)' });
      }
      const creds = extractCreds(cfg);
      if (!creds) {
        await mergeChecklist(cfg.dataFile, record.id, {
          dropboxFolder: { status: 'error', note: 'DROPBOX_* env 미설정', updatedAt: now() },
        });
        return res.status(500).json({ error: 'dropbox env missing' });
      }
      const out = await createClientFolders(
        record.entityType,
        record.businessScope,
        record.companyName,
        creds,
      );
      await setDropboxFolderPath(cfg.dataFile, record.id, out.path);
      const newState = { status: 'done', updatedAt: now() };
      await mergeChecklist(cfg.dataFile, record.id, { dropboxFolder: newState });
      ctx.log(`[new-client] dropbox retry ok: id=${record.id} path=${out.path}`);
      res.json({ ok: true, path: out.path, state: newState });
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      ctx.logError(`[new-client] dropbox retry failed: ${msg}`);
      await mergeChecklist(cfg.dataFile, req.params.id, {
        dropboxFolder: { status: 'error', note: msg.slice(0, 500), updatedAt: now() },
      });
      res.status(500).json({ error: msg });
    }
  });
```

- [ ] **Step 2: Type check**

Run:
```bash
cd /Users/hany/workzone/codetax-macro/jeeves/server && npx tsc --noEmit
```
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
cd /Users/hany/workzone/codetax-macro
git add jeeves/server/plugins/new-client/routes.ts
git commit -m "feat(new-client): add dropbox folder retry endpoint"
```

---

## Task 10: Client types — mirror server changes

**Files:**
- Modify: `jeeves/client/src/plugins/new-client/types.ts`

- [ ] **Step 1: Add ENTITY_TYPES and fields**

In `jeeves/client/src/plugins/new-client/types.ts`, right after `export type BizRegStatus = ...`, add:
```ts
export const ENTITY_TYPES = ['개인', '법인'] as const;
export type EntityType = typeof ENTITY_TYPES[number];
```

Extend `NewClientInput`:
```ts
export interface NewClientInput {
  companyName: string;
  businessScope: BusinessScope;
  entityType: EntityType;
  representative: string;
  // ... rest unchanged
}
```

Replace `NewClientRecord` to keep entityType optional (matches server side for old records):
```ts
export interface NewClientRecord extends Omit<NewClientInput, 'entityType'> {
  id: string;
  createdAt: string;
  checklist: ChecklistState;
  entityType?: EntityType;
  dropboxFolderPath?: string;
}
```

- [ ] **Step 2: Update dropboxFolder in CHECKLIST_ITEMS**

Find the `dropboxFolder` entry in `CHECKLIST_ITEMS` (~line 106 in this file):
```ts
  { key: 'dropboxFolder', label: '드롭박스 생성', step: 3, kind: 'binary',
    states: ['none', 'done'],
    description: '드롭박스 기장 거래처 폴더 생성 (2.기장/업체명)' },
```

Replace with:
```ts
  { key: 'dropboxFolder', label: '드롭박스 생성', step: 3, kind: 'enum',
    states: ['none', 'done', 'error'],
    doneStates: ['done'],
    description: '등록 시 자동 생성 (실패 시 error + 재시도 버튼)' },
```

- [ ] **Step 3: Type check**

Run:
```bash
cd /Users/hany/workzone/codetax-macro/jeeves/client && npx tsc --noEmit
```
Expected: exit 0 (NewClientForm will still pass since it uses `NewClientFormValues` locally — updated in next task).

- [ ] **Step 4: Commit**

```bash
cd /Users/hany/workzone/codetax-macro
git add jeeves/client/src/plugins/new-client/types.ts
git commit -m "feat(new-client): mirror entityType and dropboxFolder states on client"
```

---

## Task 11: NewClientForm — entityType radio

**Files:**
- Modify: `jeeves/client/src/plugins/new-client/components/NewClientForm.tsx`

- [ ] **Step 1: Add entityType to form values**

In `jeeves/client/src/plugins/new-client/components/NewClientForm.tsx`, add `EntityType` re-export at top, extend `NewClientFormValues`, extend `EMPTY`.

Replace top-level type declarations (keep existing BusinessScope etc.) — add:
```ts
import { INDUSTRIES, ENTITY_TYPES, type Industry, type EntityType } from '../types';
```

Extend `NewClientFormValues`:
```ts
export interface NewClientFormValues {
  companyName: string;
  businessScope: BusinessScope;
  entityType: EntityType;
  representative: string;
  // ... rest unchanged
}
```

Extend `EMPTY`:
```ts
const EMPTY: NewClientFormValues = {
  companyName: '',
  businessScope: '기장',
  entityType: '개인',
  representative: '',
  // ... rest unchanged
};
```

- [ ] **Step 2: Add form UI — entityType radio**

In the form JSX, after the `업무 범위` select div (the one with `values.businessScope`), add:
```tsx
      <div>
        <label className="block text-sm font-medium mb-1">사업자 형태 *</label>
        <div className="flex gap-4">
          {ENTITY_TYPES.map((et) => (
            <label key={et} className="inline-flex items-center gap-1">
              <input
                type="radio"
                name="entityType"
                value={et}
                checked={values.entityType === et}
                onChange={() => set('entityType', et)}
                disabled={submitting}
              />
              <span className="text-sm">{et}</span>
            </label>
          ))}
        </div>
      </div>
```

- [ ] **Step 3: Type check**

Run:
```bash
cd /Users/hany/workzone/codetax-macro/jeeves/client && npx tsc --noEmit
```
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
cd /Users/hany/workzone/codetax-macro
git add jeeves/client/src/plugins/new-client/components/NewClientForm.tsx
git commit -m "feat(new-client): add entityType radio to registration form"
```

---

## Task 12: Retry hook

**Files:**
- Modify: `jeeves/client/src/plugins/new-client/hooks/useChecklistUpdate.ts`

- [ ] **Step 1: Add retry hook**

In `jeeves/client/src/plugins/new-client/hooks/useChecklistUpdate.ts`, at the bottom of the file add:
```ts
export function useDropboxRetry(clientId: string | null) {
  const api = useApi();
  const [pending, setPending] = useState(false);

  const retry = useCallback(async () => {
    if (!clientId) throw new Error('no client');
    setPending(true);
    try {
      return await api.post<{ ok: true; path: string; state: { status: string; updatedAt: string } }>(
        `/new-client/${clientId}/dropbox-folder/retry`,
        {},
      );
    } finally {
      setPending(false);
    }
  }, [api, clientId]);

  return { retry, pending };
}
```

- [ ] **Step 2: Type check**

Run:
```bash
cd /Users/hany/workzone/codetax-macro/jeeves/client && npx tsc --noEmit
```
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
cd /Users/hany/workzone/codetax-macro
git add jeeves/client/src/plugins/new-client/hooks/useChecklistUpdate.ts
git commit -m "feat(new-client): add useDropboxRetry hook"
```

---

## Task 13: ChecklistItemRow — dropboxFolder specialized rendering

**Files:**
- Modify: `jeeves/client/src/plugins/new-client/components/ChecklistItemRow.tsx`
- Modify: `jeeves/client/src/plugins/new-client/components/ChecklistTable.tsx`

- [ ] **Step 1: Accept extra clientId prop in ChecklistItemRow**

In `jeeves/client/src/plugins/new-client/components/ChecklistItemRow.tsx`, update `Props`:
```ts
interface Props {
  def: ChecklistItemDefinition;
  state: ChecklistItemState | undefined;
  pending: boolean;
  clientId: string | null;
  onUpdate: (payload: ChecklistUpdateInput) => Promise<void>;
  onDropboxUpdate?: (next: ChecklistItemState) => void;
}
```

Import the retry hook at top:
```ts
import { useDropboxRetry } from '../hooks/useChecklistUpdate';
```

- [ ] **Step 2: Branch dropboxFolder rendering**

Inside the `ChecklistItemRow` function, before the `return (<tr ...>)`, add specialized logic. Replace the existing return block. Full updated function body (replace from `export function ChecklistItemRow({ ... }: Props) {` through the end of that function's closing `}`):

```tsx
export function ChecklistItemRow({ def, state, pending, clientId, onUpdate, onDropboxUpdate }: Props) {
  const done = isItemDone(def, state);
  const [localValue, setLocalValue] = useState<string>(state?.value ?? '');
  const [localNote, setLocalNote] = useState<string>(state?.note ?? '');
  const [err, setErr] = useState<string | null>(null);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const { retry: retryDropbox, pending: dropboxRetrying } = useDropboxRetry(clientId);

  useEffect(() => {
    setLocalValue(state?.value ?? '');
    setLocalNote(state?.note ?? '');
  }, [state?.value, state?.note]);

  async function copyTemplate(idx: number, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIdx(idx);
      window.setTimeout(() => {
        setCopiedIdx((cur) => (cur === idx ? null : cur));
      }, 1500);
    } catch {
      setErr('복사 실패 (브라우저 권한 확인)');
    }
  }

  async function submitStatus(next: string) {
    setErr(null);
    try { await onUpdate({ status: next }); }
    catch (e: any) { setErr(e.message ?? 'failed'); }
  }
  async function submitValue(next: string) {
    if ((state?.value ?? '') === next) return;
    setErr(null);
    try { await onUpdate({ value: next }); }
    catch (e: any) { setErr(e.message ?? 'failed'); }
  }
  async function submitNote(next: string) {
    if ((state?.note ?? '') === next) return;
    setErr(null);
    try { await onUpdate({ note: next }); }
    catch (e: any) { setErr(e.message ?? 'failed'); }
  }

  async function handleDropboxRetry() {
    setErr(null);
    try {
      const res = await retryDropbox();
      onDropboxUpdate?.({ status: res.state.status, updatedAt: res.state.updatedAt });
    } catch (e: any) {
      setErr(e.message ?? 'retry failed');
    }
  }

  return (
    <tr className={`border-b border-border ${done ? 'bg-surface2/40' : ''}`}>
      <td className="py-2 pr-3 text-xs text-muted whitespace-nowrap">
        {def.step ? `STEP ${def.step}` : ''}
      </td>
      <td className="py-2 pr-3 font-medium whitespace-nowrap">{def.label}</td>
      <td className="py-2 pr-3 text-xs text-muted">
        <div>{def.description ?? ''}</div>
        {def.key === 'katalkRoom' && (
          <div className="flex gap-1 mt-1 flex-wrap">
            {KATALK_TEMPLATES.map((t, i) => (
              <button
                key={t.label}
                type="button"
                onClick={() => copyTemplate(i, t.text)}
                className={`px-2 py-0.5 rounded text-[11px] border transition-colors ${
                  copiedIdx === i
                    ? 'border-success text-success bg-success/10'
                    : 'border-border text-text hover:bg-surface2'
                }`}
              >
                {copiedIdx === i ? '복사됨 ✓' : t.label}
              </button>
            ))}
          </div>
        )}
      </td>
      <td className="py-2 pr-3">
        {def.key === 'dropboxFolder'
          ? renderDropboxCell(state, dropboxRetrying, handleDropboxRetry)
          : renderEditor(def, state, localValue, setLocalValue, submitStatus, submitValue)}
        {err && <div className="text-danger text-xs mt-1">{err}</div>}
      </td>
      <td className="py-2 pr-3">
        <input
          value={localNote}
          onChange={(e) => setLocalNote(e.target.value)}
          onBlur={() => submitNote(localNote)}
          placeholder="메모"
          className="w-full px-2 py-1 rounded border border-border bg-surface text-xs"
        />
      </td>
      <td className="py-2 pr-3 text-xs text-muted whitespace-nowrap">
        {pending ? '저장 중...' : formatKst(state?.updatedAt)}
      </td>
    </tr>
  );
}

function renderDropboxCell(
  state: ChecklistItemState | undefined,
  retrying: boolean,
  onRetry: () => void,
) {
  const status = state?.status ?? 'none';
  if (status === 'done') {
    return <span className="text-xs text-success">✓ 생성됨</span>;
  }
  if (status === 'error') {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-danger">❌ 실패</span>
        <button
          type="button"
          onClick={onRetry}
          disabled={retrying}
          className="px-2 py-0.5 text-xs border border-border rounded hover:bg-surface2 disabled:opacity-50"
        >
          {retrying ? '재시도 중...' : '재시도'}
        </button>
      </div>
    );
  }
  return <span className="text-xs text-muted">대기</span>;
}
```

- [ ] **Step 3: Update ChecklistTable to pass clientId and onDropboxUpdate**

In `jeeves/client/src/plugins/new-client/components/ChecklistTable.tsx`, extend `Props` and usage:
```tsx
interface Props {
  checklist: ChecklistState;
  pendingKey: ChecklistItemKey | null;
  clientId: string | null;
  onUpdate: (itemKey: ChecklistItemKey, payload: ChecklistUpdateInput) => Promise<void>;
  onDropboxStateUpdate?: (next: ChecklistItemState) => void;
}

export function ChecklistTable({ checklist, pendingKey, clientId, onUpdate, onDropboxStateUpdate }: Props) {
  const sorted = [...CHECKLIST_ITEMS].sort((a, b) => (a.step ?? 99) - (b.step ?? 99));
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-muted text-left">
            <th className="py-2 pr-3">STEP</th>
            <th className="py-2 pr-3">항목</th>
            <th className="py-2 pr-3">설명</th>
            <th className="py-2 pr-3">상태</th>
            <th className="py-2 pr-3">메모</th>
            <th className="py-2 pr-3">갱신</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((def) => (
            <ChecklistItemRow
              key={def.key}
              def={def}
              state={checklist[def.key]}
              pending={pendingKey === def.key}
              clientId={clientId}
              onUpdate={(payload) => onUpdate(def.key, payload)}
              onDropboxUpdate={def.key === 'dropboxFolder' ? onDropboxStateUpdate : undefined}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

Make sure to import `ChecklistItemState` at the top:
```tsx
import type {
  ChecklistItemKey,
  ChecklistItemState,
  ChecklistState,
  ChecklistUpdateInput,
} from '../types';
```

- [ ] **Step 4: Pass clientId in NewClientPage DetailView**

In `jeeves/client/src/plugins/new-client/NewClientPage.tsx`, find the `<ChecklistTable>` usage in `DetailView`:
```tsx
        <ChecklistTable
          checklist={record.checklist}
          pendingKey={pending}
          onUpdate={handleUpdate}
        />
```

Replace with:
```tsx
        <ChecklistTable
          checklist={record.checklist}
          pendingKey={pending}
          clientId={clientId}
          onUpdate={handleUpdate}
          onDropboxStateUpdate={(next) => {
            setRecord((prev) =>
              prev ? { ...prev, checklist: { ...prev.checklist, dropboxFolder: next } } : prev,
            );
            onListReloadNeeded();
          }}
        />
```

- [ ] **Step 5: Type check**

Run:
```bash
cd /Users/hany/workzone/codetax-macro/jeeves/client && npx tsc --noEmit
```
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
cd /Users/hany/workzone/codetax-macro
git add jeeves/client/src/plugins/new-client/components/ChecklistItemRow.tsx jeeves/client/src/plugins/new-client/components/ChecklistTable.tsx jeeves/client/src/plugins/new-client/NewClientPage.tsx
git commit -m "feat(new-client): specialized dropboxFolder row with retry button"
```

---

## Task 14: InfoCard — dropboxFolderPath display

**Files:**
- Modify: `jeeves/client/src/plugins/new-client/NewClientPage.tsx`

- [ ] **Step 1: Show dropbox path in InfoCard**

In `jeeves/client/src/plugins/new-client/NewClientPage.tsx`, find the `InfoCard` function. After the existing `fields.push` conditional block for `transferReason`, add:
```ts
  if (record.dropboxFolderPath) {
    fields.push(['Dropbox', record.dropboxFolderPath]);
  }
```

- [ ] **Step 2: Type check**

Run:
```bash
cd /Users/hany/workzone/codetax-macro/jeeves/client && npx tsc --noEmit
```
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
cd /Users/hany/workzone/codetax-macro
git add jeeves/client/src/plugins/new-client/NewClientPage.tsx
git commit -m "feat(new-client): show dropboxFolderPath in detail info card"
```

---

## Task 15: End-to-end verification

**Files:** (none — manual testing)

- [ ] **Step 1: Build client**

Run:
```bash
cd /Users/hany/workzone/codetax-macro/jeeves/client && npm run build 2>&1 | tail -5
```
Expected: `✓ built in ...ms`, no TypeScript errors.

- [ ] **Step 2: Restart server**

Check if server is running (`ps aux | grep "tsx index.ts" | grep -v grep`). If yes, kill it:
```bash
pkill -f "tsx index.ts" || true
```
Then:
```bash
cd /Users/hany/workzone/codetax-macro/jeeves/server
npm run dev > /tmp/jeeves-server.log 2>&1 &
sleep 3
tail -20 /tmp/jeeves-server.log
```
Expected: server started on port 3001, no errors about missing DROPBOX_* env.

- [ ] **Step 3: Run full test suite**

Run:
```bash
cd /Users/hany/workzone/codetax-macro/jeeves/server && npm test 2>&1 | tail -10
```
Expected: all tests pass (4 validate + 11 dropbox pure function = 15 total).

- [ ] **Step 4: Manual E2E — register a test client**

Open browser to http://localhost:3001. Navigate to `📋 신규 수임처 등록`.

Click `+ 신규 등록` and fill form with a clearly-test company name (e.g. `테스트_2026-04-23`):
- businessScope: `기장`
- **entityType: `개인`** (verify the new radio exists)
- representative: `테스트`
- startDate: today
- industry: `서비스업`
- fees: 0/0
- inflowRoute: `소개1`
- transferStatus: `신규`
- bizRegStatus: `기존`

Submit. Expected toast: `등록 완료 — Slack 알림 전송됨` (or warn).

Then navigate to the detail page for this client. Expected:
- Checklist row `드롭박스 생성`: status `✓ 생성됨`
- InfoCard: new row `Dropbox` showing path like `/세무법인의 팀 폴더/2.기장/개인/일반기장/NNN. 테스트_2026-04-23`

Verify on Dropbox web UI: folder exists, `1. 기초자료` subfolder exists inside.

- [ ] **Step 5: Manual E2E — clean up test client**

Delete the test folder from Dropbox web UI (both the client folder and its contents). Leave the Jeeves record for now — can be manually removed via `jeeves/server/data/new-clients.json` if needed.

- [ ] **Step 6: Manual E2E — failure + retry**

Temporarily break auth: edit `.env`, set `DROPBOX_REFRESH_TOKEN=invalid`. Restart server. Register another test client.

Expected:
- Registration succeeds, toast shows success (Slack) or warn, but NOT an error
- Detail page: `드롭박스 생성` row shows `❌ 실패` with `재시도` button
- Click 재시도: still fails (auth still broken)

Restore `.env` to the real refresh token. Restart server. Click 재시도 again. Expected: state becomes `✓ 생성됨`.

Clean up the test folder from Dropbox.

- [ ] **Step 7: Kill background server**

```bash
pkill -f "tsx index.ts" || true
```

- [ ] **Step 8: No commit — manual verification only**

Task complete when all manual steps pass.

---

## Self-Review Checklist

- [x] **Spec coverage**: entityType field (T1, T10, T11), dropboxFolderPath field (T1, T4, T14), checklist states (T3, T10), Dropbox API module (T5, T6, T7), submit handler extension (T8), retry endpoint (T9), error UX (T13), entityType validation (T2)
- [x] **No placeholders**: all code blocks contain full implementations, no "add error handling" stubs
- [x] **Type consistency**: `EntityType`, `resolveParentPath`, `createClientFolders`, `extractCreds` signatures consistent across tasks; `ChecklistItemState` imports added where used
- [x] **Test coverage**: 4 validation tests + 11 pure function tests (resolveParentPath × 4, parseLeadingNumber × 5, formatFolderName × 2)
