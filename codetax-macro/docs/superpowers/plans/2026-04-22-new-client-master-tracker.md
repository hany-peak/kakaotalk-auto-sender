# 신규 수임처 마스터 트래커 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기존 `new-client` 플러그인을 확장하여 신규 수임처별 19개 체크리스트를 저장·조회·갱신할 수 있는 마스터 트래커를 구현한다. 서버에 목록/상세/항목 갱신 REST API를 추가하고, 클라이언트에 목록 페이지와 상세(체크리스트) 페이지를 구현한다.

**Architecture:** 기존 `new-client` 플러그인 구조를 유지한 채 파일을 확장한다. 체크리스트 항목 정의는 `checklist-config.ts` 에 선언형으로 모으고, 각 항목은 `binary` / `enum` / `value` 세 가지 kind 로 추상화된다. 레코드는 JSON 파일(`data/new-clients.json`) 단일 배열 구조를 유지하고, `readAll()` 은 기존 레코드(checklist 필드 없는)를 자동 보정한다. 클라이언트 플러그인은 단일 `Page` 컴포넌트 내에서 내부 상태로 목록/상세/등록 뷰를 전환한다.

**Tech Stack:** Express, tsx, TypeScript, @slack/web-api (기존), React 19, Vite, Tailwind CSS, react-router-dom (최상위 라우팅만)

**Spec:** [`docs/superpowers/specs/2026-04-22-new-client-master-tracker-design.md`](../specs/2026-04-22-new-client-master-tracker-design.md)

**참고:** 이 프로젝트는 자동화 테스트 인프라가 없다(spec 기준). 따라서 검증은 `tsc --noEmit`, `tsx -e '...'` 인라인 실행, `curl` 기반 수동 API 테스트, 브라우저 수동 테스트로 수행한다.

---

## File Structure

### 서버 (수정/추가)

```
jeeves/server/plugins/new-client/
  checklist-config.ts   (신규) — 19개 항목 정의 + 진행률 헬퍼
  types.ts              (확장) — ChecklistItemKey/State 타입, NewClientRecord.checklist
  storage.ts            (확장) — normalize, updateChecklistItem, append의 checklist 초기화
  validate.ts           (확장) — validateChecklistUpdate
  routes.ts             (확장) — GET /:id, PATCH /:id/checklist/:itemKey, list 응답 강화
```

### 클라이언트 (신규)

```
jeeves/client/src/plugins/new-client/
  index.tsx                          — 플러그인 등록
  NewClientPage.tsx                  — 상위 컨테이너 (내부 상태로 list/detail/register 뷰 전환)
  types.ts                           — 클라이언트 타입 (서버 타입과 동기)
  hooks/
    useNewClients.ts                 — 목록/상세 fetch
    useChecklistUpdate.ts            — PATCH 호출
  components/
    NewClientForm.tsx                — 등록 양식 (9개 필드)
    ClientListTable.tsx              — 목록 테이블
    ProgressPill.tsx                 — 진행률 표시 (x/19 + 얇은 바)
    ChecklistTable.tsx               — 19개 항목 표 래퍼
    ChecklistItemRow.tsx             — 개별 항목 편집 행 (binary/enum/value 분기)

jeeves/client/src/plugins/index.tsx  (수정) — newClientPlugin 등록
```

---

## Task 1: 서버 — 체크리스트 항목 config

**Files:**
- Create: `jeeves/server/plugins/new-client/checklist-config.ts`

체크리스트 항목 정의와 완료/진행률 헬퍼를 한 파일에 배치한다. 타입은 Task 2에서 `types.ts` 로 이동시키지 않고, 여기서 직접 export 한다(항목 정의와 타입이 같이 있는 편이 읽기 쉽다).

- [ ] **Step 1: Create `checklist-config.ts` with full item definitions**

```typescript
// jeeves/server/plugins/new-client/checklist-config.ts

export type ChecklistItemKey =
  | 'katalkRoom'
  | 'businessLicense'
  | 'transferData'
  | 'hometaxCredentials'
  | 'wehago'
  | 'bookkeepingFeeConfirmed'
  | 'contract'
  | 'feeBillingDate'
  | 'paymentMethod'
  | 'cms'
  | 'hometaxDelegation'
  | 'ediDelegation'
  | 'businessAccount'
  | 'creditCard'
  | 'cashReceiptStore'
  | 'assignee'
  | 'wemembers'
  | 'semoreport'
  | 'onboardingComplete';

export type ItemKind = 'binary' | 'enum' | 'value';
export type ValueKind = 'text' | 'date';

export interface ChecklistItemDefinition {
  key: ChecklistItemKey;
  label: string;
  step?: number;
  kind: ItemKind;
  states?: string[]; // binary/enum 전용. binary는 ['none', 'done']
  valueKind?: ValueKind; // value 전용
  description?: string;
}

export interface ChecklistItemState {
  status?: string;
  value?: string;
  note?: string;
  updatedAt: string;
}

export type ChecklistState = Partial<Record<ChecklistItemKey, ChecklistItemState>>;

export const CHECKLIST_ITEMS: ChecklistItemDefinition[] = [
  { key: 'katalkRoom', label: '카톡방', step: 1, kind: 'binary',
    states: ['none', 'done'],
    description: '단톡방 개설 후 체크 (정세무사님+과장님+지원팀)' },
  { key: 'businessLicense', label: '사업자등록증', step: 2, kind: 'enum',
    states: ['none', '자료요청', '접수완료', '발급완료'],
    description: '사업자등록 신청·발급 진행 상태' },
  { key: 'transferData', label: '이관자료', step: 3, kind: 'enum',
    states: ['none', '신규', '요청', '백업완료'],
    description: '신규/요청/백업완료 — 드롭박스 기장 거래처 폴더 생성' },
  { key: 'hometaxCredentials', label: '홈택스 ID/PW', kind: 'binary',
    states: ['none', 'done'],
    description: '거래처에게 전달받아 기재, 정상 로그인 확인' },
  { key: 'wehago', label: '위하고', step: 4, kind: 'binary',
    states: ['none', 'done'],
    description: '위하고 업체 생성 확인 후 체크' },
  { key: 'bookkeepingFeeConfirmed', label: '기장료', kind: 'binary',
    states: ['none', 'done'],
    description: '정세무사님 기장료 확인 완료 (금액은 등록 시 입력됨)' },
  { key: 'contract', label: '기장계약서', step: 6, kind: 'binary',
    states: ['none', 'done'],
    description: '기장계약서 거래처 전달 완료' },
  { key: 'feeBillingDate', label: '수수료 청구일', kind: 'value',
    valueKind: 'date',
    description: 'CMS 출금일. 매월 25일 고정이 기본' },
  { key: 'paymentMethod', label: '결제방식', kind: 'enum',
    states: ['none', 'CMS', '계좌이체', '해당없음'],
    description: 'CMS 자동이체 / 직접 입금 / 신고대리' },
  { key: 'cms', label: 'CMS', step: 7, kind: 'enum',
    states: ['none', '등록대기', '등록완료'],
    description: '더빌 자동출금 등록 상태' },
  { key: 'hometaxDelegation', label: '홈택스 수임', step: 8, kind: 'binary',
    states: ['none', 'done'],
    description: '홈택스 수임동의 완료' },
  { key: 'ediDelegation', label: 'EDI 수임', step: 9, kind: 'binary',
    states: ['none', 'done'],
    description: '국민연금/건강보험공단 EDI 수임등록 완료' },
  { key: 'businessAccount', label: '사업용계좌', step: 10, kind: 'enum',
    states: ['none', '등록대기', '등록완료'],
    description: '홈택스 사업용계좌 등록 상태' },
  { key: 'creditCard', label: '신용카드', step: 10, kind: 'enum',
    states: ['none', '등록대기', '등록완료'],
    description: '사업용카드 등록 상태' },
  { key: 'cashReceiptStore', label: '현영가맹점', step: 11, kind: 'enum',
    states: ['none', '등록대기', '등록완료'],
    description: '현금영수증 가맹점 등록 상태' },
  { key: 'assignee', label: '실무자', kind: 'value',
    valueKind: 'text',
    description: '담당자 이름 또는 "미배정"' },
  { key: 'wemembers', label: '위멤버스', step: 12, kind: 'binary',
    states: ['none', 'done'],
    description: '위멤버스 수임처 거래처 등록 완료' },
  { key: 'semoreport', label: '세모리포트', step: 13, kind: 'binary',
    states: ['none', 'done'],
    description: '세모리포트 등록 완료' },
  { key: 'onboardingComplete', label: '수임완료', kind: 'binary',
    states: ['none', 'done'],
    description: '위 절차가 모두 완료되면 체크' },
];

export const CHECKLIST_ITEM_MAP: Record<ChecklistItemKey, ChecklistItemDefinition> =
  Object.fromEntries(CHECKLIST_ITEMS.map((item) => [item.key, item])) as Record<
    ChecklistItemKey,
    ChecklistItemDefinition
  >;

export function isItemDone(
  def: ChecklistItemDefinition,
  state: ChecklistItemState | undefined,
): boolean {
  if (!state) return false;
  if (def.kind === 'value') {
    return typeof state.value === 'string' && state.value.trim() !== '';
  }
  const states = def.states!;
  return state.status === states[states.length - 1];
}

export function computeProgress(
  checklist: ChecklistState,
): { done: number; total: number } {
  let done = 0;
  for (const def of CHECKLIST_ITEMS) {
    if (isItemDone(def, checklist[def.key])) done++;
  }
  return { done, total: CHECKLIST_ITEMS.length };
}

export function latestChecklistUpdate(
  checklist: ChecklistState,
): string | undefined {
  let latest: string | undefined;
  for (const state of Object.values(checklist)) {
    if (!state) continue;
    if (!latest || state.updatedAt > latest) latest = state.updatedAt;
  }
  return latest;
}
```

- [ ] **Step 2: Verify file compiles and helpers work (inline sanity check)**

Run:
```bash
cd /Users/hany/workzone/codetax-macro/jeeves/server && npx tsx -e "
import { CHECKLIST_ITEMS, CHECKLIST_ITEM_MAP, computeProgress, isItemDone } from './plugins/new-client/checklist-config';
console.log('items:', CHECKLIST_ITEMS.length);
console.log('map keys:', Object.keys(CHECKLIST_ITEM_MAP).length);
console.log('empty progress:', computeProgress({}));
console.log('one done progress:', computeProgress({ katalkRoom: { status: 'done', updatedAt: '2026-01-01T00:00:00.000Z' } }));
console.log('value done:', isItemDone(CHECKLIST_ITEM_MAP['assignee'], { value: '홍길동', updatedAt: '2026-01-01' }));
console.log('value empty:', isItemDone(CHECKLIST_ITEM_MAP['assignee'], { value: '   ', updatedAt: '2026-01-01' }));
console.log('enum done:', isItemDone(CHECKLIST_ITEM_MAP['businessLicense'], { status: '발급완료', updatedAt: '2026-01-01' }));
console.log('enum not done:', isItemDone(CHECKLIST_ITEM_MAP['businessLicense'], { status: '접수완료', updatedAt: '2026-01-01' }));
"
```

Expected output:
```
items: 19
map keys: 19
empty progress: { done: 0, total: 19 }
one done progress: { done: 1, total: 19 }
value done: true
value empty: false
enum done: true
enum not done: false
```

- [ ] **Step 3: Commit**

```bash
cd /Users/hany/workzone/codetax-macro && git add jeeves/server/plugins/new-client/checklist-config.ts && git commit -m "feat(new-client): add checklist config with 19 items and progress helpers

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: 서버 — types.ts 확장

**Files:**
- Modify: `jeeves/server/plugins/new-client/types.ts`

`NewClientRecord` 에 `checklist` 필드를 추가하고, 체크리스트 관련 타입은 `checklist-config.ts` 에서 re-export 한다.

- [ ] **Step 1: Extend types.ts**

현재 파일 전체를 다음으로 교체:

```typescript
// jeeves/server/plugins/new-client/types.ts

import type { ChecklistState } from './checklist-config';

export { CHECKLIST_ITEMS, CHECKLIST_ITEM_MAP } from './checklist-config';
export type {
  ChecklistItemKey,
  ChecklistItemDefinition,
  ChecklistItemState,
  ChecklistState,
  ItemKind,
  ValueKind,
} from './checklist-config';

export const BUSINESS_SCOPES = ['기장', '신고대리'] as const;
export type BusinessScope = typeof BUSINESS_SCOPES[number];

export const INFLOW_ROUTES = ['소개1', '소개2', '블로그'] as const;
export type InflowRoute = typeof INFLOW_ROUTES[number];

export interface NewClientInput {
  companyName: string;
  businessScope: BusinessScope;
  representative: string;
  startDate: string; // YYYY-MM-DD
  industry: string;
  bookkeepingFee: number;
  adjustmentFee: number;
  inflowRoute: InflowRoute;
  contractNote?: string;
}

export interface NewClientRecord extends NewClientInput {
  id: string;
  createdAt: string; // ISO 8601
  checklist: ChecklistState;
}

export interface SubmitResponse {
  ok: true;
  id: string;
  slackNotified: boolean;
}

export interface ErrorResponse {
  error: string;
}
```

- [ ] **Step 2: Run typecheck on server**

Run:
```bash
cd /Users/hany/workzone/codetax-macro/jeeves/server && npx tsc --noEmit
```

Expected: exit code 0, no output. (storage.ts 에서 `record.checklist` 를 참조하지 않으므로 아직 호환됨)

- [ ] **Step 3: Commit**

```bash
cd /Users/hany/workzone/codetax-macro && git add jeeves/server/plugins/new-client/types.ts && git commit -m "feat(new-client): extend NewClientRecord with checklist field

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: 서버 — storage.ts 확장

**Files:**
- Modify: `jeeves/server/plugins/new-client/storage.ts`

`readAll()` 이 기존 레코드를 `checklist: {}` 로 보정하고, `append()` 가 체크리스트를 초기화하며, 새 `updateChecklistItem()` 함수가 단일 항목을 갱신한다.

- [ ] **Step 1: Replace storage.ts content**

현재 파일 전체를 다음으로 교체:

```typescript
// jeeves/server/plugins/new-client/storage.ts

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
  const record: NewClientRecord = {
    ...input,
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    checklist: {},
  };

  await fs.promises.mkdir(path.dirname(file), { recursive: true });
  const existing = await readAll(file);
  existing.push(record);
  await fs.promises.writeFile(file, JSON.stringify(existing, null, 2), 'utf-8');

  return record;
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
    next.value = updates.value;
  } else {
    next.status = updates.status;
  }
  if (nextNote !== undefined) next.note = nextNote;

  record.checklist[itemKey] = next;
  all[idx] = record;

  await fs.promises.writeFile(file, JSON.stringify(all, null, 2), 'utf-8');
  return next;
}
```

- [ ] **Step 2: Typecheck**

Run:
```bash
cd /Users/hany/workzone/codetax-macro/jeeves/server && npx tsc --noEmit
```

Expected: exit code 0.

- [ ] **Step 3: Inline sanity check — round-trip storage**

Run:
```bash
cd /Users/hany/workzone/codetax-macro/jeeves/server && npx tsx -e "
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { readAll, readOne, append, updateChecklistItem } from './plugins/new-client/storage';

async function main() {
  const tmp = path.join(os.tmpdir(), 'new-clients-test-' + Date.now() + '.json');

  // 1) append with empty checklist
  const rec = await append(tmp, {
    companyName: '테스트', businessScope: '기장', representative: '홍길동',
    startDate: '2026-05-01', industry: '제조업',
    bookkeepingFee: 300000, adjustmentFee: 500000, inflowRoute: '블로그',
  });
  console.log('appended:', rec.id, 'checklist keys:', Object.keys(rec.checklist).length);

  // 2) readOne
  const one = await readOne(tmp, rec.id);
  console.log('readOne found:', one?.companyName);

  // 3) update binary item
  const state1 = await updateChecklistItem(tmp, rec.id, 'katalkRoom', { status: 'done' }, 'binary');
  console.log('binary update:', state1?.status);

  // 4) update value item with note
  const state2 = await updateChecklistItem(tmp, rec.id, 'assignee', { value: '김다원', note: '4월 배정' }, 'value');
  console.log('value update:', state2?.value, 'note:', state2?.note);

  // 5) migration: write a record without checklist, then read
  const rawOld = JSON.stringify([{ id: 'old-1', createdAt: '2026-01-01', companyName: 'OLD',
    businessScope: '기장', representative: 'X', startDate: '2026-01-01', industry: 'X',
    bookkeepingFee: 0, adjustmentFee: 0, inflowRoute: '블로그' }], null, 2);
  fs.writeFileSync(tmp, rawOld);
  const migrated = await readAll(tmp);
  console.log('migrated checklist type:', typeof migrated[0].checklist, 'keys:', Object.keys(migrated[0].checklist).length);

  // cleanup
  fs.unlinkSync(tmp);
}
main().catch((e) => { console.error(e); process.exit(1); });
"
```

Expected output:
```
appended: <uuid> checklist keys: 0
readOne found: 테스트
binary update: done
value update: 김다원 note: 4월 배정
migrated checklist type: object keys: 0
```

- [ ] **Step 4: Commit**

```bash
cd /Users/hany/workzone/codetax-macro && git add jeeves/server/plugins/new-client/storage.ts && git commit -m "feat(new-client): extend storage with checklist init, read-normalize, updateChecklistItem

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: 서버 — validate.ts 확장

**Files:**
- Modify: `jeeves/server/plugins/new-client/validate.ts`

`validateChecklistUpdate(itemKey, body)` 를 추가한다. 항목 kind별 규칙에 따라 요청 바디를 검증하고 정규화된 payload를 반환한다.

- [ ] **Step 1: Append validateChecklistUpdate to validate.ts**

현재 `validate.ts` 파일의 끝에 아래 코드를 추가한다. (기존 `validateInput` 함수는 변경하지 않음)

기존 import 블록을 다음으로 교체:

```typescript
import {
  BUSINESS_SCOPES,
  INFLOW_ROUTES,
  type NewClientInput,
} from './types';
import {
  CHECKLIST_ITEM_MAP,
  type ChecklistItemKey,
  type ChecklistItemDefinition,
} from './checklist-config';
```

파일 끝에 추가:

```typescript

const DATE_RE_CHECKLIST = /^\d{4}-\d{2}-\d{2}$/;

export interface ChecklistUpdatePayload {
  status?: string;
  value?: string;
  note?: string;
}

export type ChecklistValidationResult =
  | { ok: true; def: ChecklistItemDefinition; payload: ChecklistUpdatePayload }
  | { ok: false; status: 400 | 404; error: string };

export function validateChecklistUpdate(
  itemKey: string,
  body: unknown,
): ChecklistValidationResult {
  const def = CHECKLIST_ITEM_MAP[itemKey as ChecklistItemKey];
  if (!def) {
    return { ok: false, status: 400, error: `unknown item: ${itemKey}` };
  }

  if (typeof body !== 'object' || body === null) {
    return { ok: false, status: 400, error: 'body must be an object' };
  }
  const b = body as Record<string, unknown>;

  const hasStatus = typeof b.status === 'string';
  const hasValue = typeof b.value === 'string';
  const hasNote = typeof b.note === 'string';

  if (!hasStatus && !hasValue && !hasNote) {
    return { ok: false, status: 400, error: 'no update fields' };
  }

  const payload: ChecklistUpdatePayload = {};
  if (hasNote) payload.note = (b.note as string).trim();

  if (def.kind === 'binary' || def.kind === 'enum') {
    if (!hasStatus) {
      // status 없이 note만 보낸 경우도 허용 — 상태는 기존 유지
      return { ok: true, def, payload };
    }
    const status = b.status as string;
    if (!def.states || !def.states.includes(status)) {
      return {
        ok: false,
        status: 400,
        error: `invalid status for ${itemKey}: ${status}`,
      };
    }
    payload.status = status;
    return { ok: true, def, payload };
  }

  // def.kind === 'value'
  if (!hasValue) {
    // value 없이 note만 보낸 경우도 허용
    return { ok: true, def, payload };
  }
  const value = (b.value as string).trim();
  if (def.valueKind === 'date' && value !== '' && !DATE_RE_CHECKLIST.test(value)) {
    return {
      ok: false,
      status: 400,
      error: `invalid date format for ${itemKey} (expected YYYY-MM-DD)`,
    };
  }
  payload.value = value;
  return { ok: true, def, payload };
}
```

- [ ] **Step 2: Typecheck**

Run:
```bash
cd /Users/hany/workzone/codetax-macro/jeeves/server && npx tsc --noEmit
```

Expected: exit code 0.

- [ ] **Step 3: Inline sanity check — validation rules**

Run:
```bash
cd /Users/hany/workzone/codetax-macro/jeeves/server && npx tsx -e "
import { validateChecklistUpdate } from './plugins/new-client/validate';

const cases = [
  ['unknown', { status: 'done' }],
  ['katalkRoom', { status: 'done' }],
  ['katalkRoom', { status: 'bogus' }],
  ['businessLicense', { status: '발급완료' }],
  ['businessLicense', { status: 'unknown-state' }],
  ['assignee', { value: '홍길동' }],
  ['assignee', { status: 'done' }],      // value kind에 status만 → note 없으니 400? 'no update fields' 아님. note도 없으니 ok=true with empty payload? 확인 필요
  ['feeBillingDate', { value: '2026-05-25' }],
  ['feeBillingDate', { value: '2026/05/25' }],
  ['katalkRoom', {}],
  ['katalkRoom', { note: '비고만 업데이트' }],
];
for (const [k, body] of cases) {
  const r = validateChecklistUpdate(k as string, body);
  console.log(k, JSON.stringify(body), '→', r.ok ? ('OK payload=' + JSON.stringify(r.payload)) : ('ERR[' + r.status + '] ' + r.error));
}
"
```

Expected output:
```
unknown {"status":"done"} → ERR[400] unknown item: unknown
katalkRoom {"status":"done"} → OK payload={"status":"done"}
katalkRoom {"status":"bogus"} → ERR[400] invalid status for katalkRoom: bogus
businessLicense {"status":"발급완료"} → OK payload={"status":"발급완료"}
businessLicense {"status":"unknown-state"} → ERR[400] invalid status for businessLicense: unknown-state
assignee {"value":"홍길동"} → OK payload={"value":"홍길동"}
assignee {"status":"done"} → OK payload={}
feeBillingDate {"value":"2026-05-25"} → OK payload={"value":"2026-05-25"}
feeBillingDate {"value":"2026/05/25"} → ERR[400] invalid date format for feeBillingDate (expected YYYY-MM-DD)
katalkRoom {} → ERR[400] no update fields
katalkRoom {"note":"비고만 업데이트"} → OK payload={"note":"비고만 업데이트"}
```

(Note: `assignee` with `{status: 'done'}` returns empty payload because status is ignored for value kind. The route layer treats empty payload as no-op and returns the existing state unchanged — we'll see this in Task 5.)

- [ ] **Step 4: Commit**

```bash
cd /Users/hany/workzone/codetax-macro && git add jeeves/server/plugins/new-client/validate.ts && git commit -m "feat(new-client): add validateChecklistUpdate with kind-aware rules

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: 서버 — routes.ts 확장

**Files:**
- Modify: `jeeves/server/plugins/new-client/routes.ts`

세 개의 엔드포인트를 확장/추가한다:
- `GET /api/new-client/list` — 진행률을 포함한 경량 목록 응답
- `GET /api/new-client/:id` — 단일 레코드 전체
- `PATCH /api/new-client/:id/checklist/:itemKey` — 항목 상태 갱신

- [ ] **Step 1: Replace routes.ts content**

현재 파일 전체를 다음으로 교체:

```typescript
// jeeves/server/plugins/new-client/routes.ts

import type { Express } from 'express';
import type { ServerContext } from '../types';
import { loadConfig } from './config';
import { validateInput, validateChecklistUpdate } from './validate';
import {
  readAll,
  readOne,
  append,
  updateChecklistItem,
} from './storage';
import { notifyNewClient } from './slack';
import {
  computeProgress,
  latestChecklistUpdate,
  type ChecklistItemKey,
} from './checklist-config';

export function registerNewClientRoutes(app: Express, ctx: ServerContext): void {
  app.post('/api/new-client/submit', async (req, res) => {
    const validated = validateInput(req.body);
    if (!validated.ok) {
      return res.status(400).json({ error: validated.error });
    }

    const cfg = loadConfig();
    let record;
    try {
      record = await append(cfg.dataFile, validated.value);
    } catch (err: any) {
      ctx.logError(`[new-client] storage failed: ${err.message || err}`);
      return res.status(500).json({ error: 'failed to save submission' });
    }

    ctx.log(`[new-client] registered: ${record.companyName}`);
    const slackNotified = await notifyNewClient(record, ctx.logError);
    return res.json({ ok: true, id: record.id, slackNotified });
  });

  app.get('/api/new-client/list', async (_req, res) => {
    const cfg = loadConfig();
    try {
      const records = await readAll(cfg.dataFile);
      const list = records.map((r) => ({
        id: r.id,
        companyName: r.companyName,
        representative: r.representative,
        industry: r.industry,
        startDate: r.startDate,
        createdAt: r.createdAt,
        progress: computeProgress(r.checklist),
        checklistUpdatedAt: latestChecklistUpdate(r.checklist),
      }));
      res.json(list);
    } catch (err: any) {
      ctx.logError(`[new-client] list failed: ${err.message || err}`);
      res.status(500).json({ error: 'failed to read records' });
    }
  });

  app.get('/api/new-client/:id', async (req, res) => {
    const cfg = loadConfig();
    try {
      const record = await readOne(cfg.dataFile, req.params.id);
      if (!record) return res.status(404).json({ error: 'not found' });
      res.json(record);
    } catch (err: any) {
      ctx.logError(`[new-client] read failed: ${err.message || err}`);
      res.status(500).json({ error: 'failed to read record' });
    }
  });

  app.patch('/api/new-client/:id/checklist/:itemKey', async (req, res) => {
    const validation = validateChecklistUpdate(req.params.itemKey, req.body);
    if (!validation.ok) {
      return res.status(validation.status).json({ error: validation.error });
    }

    const cfg = loadConfig();
    try {
      const updated = await updateChecklistItem(
        cfg.dataFile,
        req.params.id,
        req.params.itemKey as ChecklistItemKey,
        validation.payload,
        validation.def.kind,
      );
      if (!updated) return res.status(404).json({ error: 'not found' });
      ctx.log(
        `[new-client] checklist updated: id=${req.params.id} item=${req.params.itemKey} ` +
          (validation.def.kind === 'value'
            ? `value=${updated.value ?? ''}`
            : `status=${updated.status ?? ''}`),
      );
      res.json({ ok: true, itemKey: req.params.itemKey, state: updated });
    } catch (err: any) {
      ctx.logError(`[new-client] checklist update failed: ${err.message || err}`);
      res.status(500).json({ error: 'failed to update checklist' });
    }
  });
}
```

- [ ] **Step 2: Typecheck**

Run:
```bash
cd /Users/hany/workzone/codetax-macro/jeeves/server && npx tsc --noEmit
```

Expected: exit code 0.

- [ ] **Step 3: Start dev server**

Run in a separate terminal (or background):
```bash
cd /Users/hany/workzone/codetax-macro/jeeves && npm run dev
```

Wait until console prints "server listening" or equivalent (tsx watch output). If Slack env vars missing, that's OK for these tests — slackNotified will be false but storage still works.

- [ ] **Step 4: Manual API verification**

Run the following curl commands in order and check output:

```bash
# 1. Register a new client (should return 200)
curl -s -X POST http://localhost:3001/api/new-client/submit \
  -H 'Content-Type: application/json' \
  -d '{"companyName":"테스트거래처","businessScope":"기장","representative":"홍길동","startDate":"2026-05-01","industry":"제조업","bookkeepingFee":300000,"adjustmentFee":500000,"inflowRoute":"블로그"}'
```
Expected: `{"ok":true,"id":"<uuid>","slackNotified":<bool>}`

Save the `id` to a shell variable for subsequent steps:
```bash
ID=$(curl -s http://localhost:3001/api/new-client/list | python3 -c "import json,sys; d=json.load(sys.stdin); print(d[-1]['id'])")
echo "ID=$ID"
```

```bash
# 2. List — progress should be 0/19
curl -s http://localhost:3001/api/new-client/list | python3 -m json.tool
```
Expected: last element has `"progress": {"done": 0, "total": 19}`.

```bash
# 3. Detail — checklist should be empty object
curl -s http://localhost:3001/api/new-client/$ID | python3 -m json.tool
```
Expected: `"checklist": {}` in response.

```bash
# 4. Update binary item (katalkRoom → done)
curl -s -X PATCH http://localhost:3001/api/new-client/$ID/checklist/katalkRoom \
  -H 'Content-Type: application/json' -d '{"status":"done"}'
```
Expected: `{"ok":true,"itemKey":"katalkRoom","state":{"updatedAt":"...","status":"done"}}`

```bash
# 5. Update enum item (businessLicense → 발급완료)
curl -s -X PATCH http://localhost:3001/api/new-client/$ID/checklist/businessLicense \
  -H 'Content-Type: application/json' -d '{"status":"발급완료"}'
```
Expected: status reflected.

```bash
# 6. Update value item (assignee → 김다원)
curl -s -X PATCH http://localhost:3001/api/new-client/$ID/checklist/assignee \
  -H 'Content-Type: application/json' -d '{"value":"김다원"}'
```
Expected: value reflected.

```bash
# 7. Update value item with date (feeBillingDate → 2026-05-25)
curl -s -X PATCH http://localhost:3001/api/new-client/$ID/checklist/feeBillingDate \
  -H 'Content-Type: application/json' -d '{"value":"2026-05-25"}'
```
Expected: value reflected.

```bash
# 8. Error: unknown itemKey
curl -s -w '\nHTTP %{http_code}\n' -X PATCH http://localhost:3001/api/new-client/$ID/checklist/bogus \
  -H 'Content-Type: application/json' -d '{"status":"done"}'
```
Expected: 400 + `{"error":"unknown item: bogus"}`

```bash
# 9. Error: invalid status
curl -s -w '\nHTTP %{http_code}\n' -X PATCH http://localhost:3001/api/new-client/$ID/checklist/katalkRoom \
  -H 'Content-Type: application/json' -d '{"status":"bogus"}'
```
Expected: 400 + `invalid status for katalkRoom: bogus`

```bash
# 10. Error: invalid date
curl -s -w '\nHTTP %{http_code}\n' -X PATCH http://localhost:3001/api/new-client/$ID/checklist/feeBillingDate \
  -H 'Content-Type: application/json' -d '{"value":"2026/05/25"}'
```
Expected: 400 + `invalid date format`

```bash
# 11. Error: unknown client ID
curl -s -w '\nHTTP %{http_code}\n' -X PATCH http://localhost:3001/api/new-client/nope/checklist/katalkRoom \
  -H 'Content-Type: application/json' -d '{"status":"done"}'
```
Expected: 404 + `not found`

```bash
# 12. Final list — progress should be 4/19 (katalkRoom, businessLicense, assignee, feeBillingDate)
curl -s http://localhost:3001/api/new-client/list | python3 -m json.tool
```
Expected: `"progress": {"done": 4, "total": 19}` on the test client.

- [ ] **Step 5: Stop dev server, commit**

```bash
cd /Users/hany/workzone/codetax-macro && git add jeeves/server/plugins/new-client/routes.ts && git commit -m "feat(new-client): add list progress, detail, and checklist PATCH endpoints

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: 클라이언트 — 플러그인 스캐폴드 + 타입 + hooks

**Files:**
- Create: `jeeves/client/src/plugins/new-client/types.ts`
- Create: `jeeves/client/src/plugins/new-client/hooks/useNewClients.ts`
- Create: `jeeves/client/src/plugins/new-client/hooks/useChecklistUpdate.ts`
- Create: `jeeves/client/src/plugins/new-client/NewClientPage.tsx` (placeholder)
- Create: `jeeves/client/src/plugins/new-client/index.tsx`
- Modify: `jeeves/client/src/plugins/index.tsx`

서버 타입을 클라이언트로 복제하고, API를 호출하는 hooks와 플러그인 등록 스캐폴드를 만든다.

- [ ] **Step 1: Create client types**

```typescript
// jeeves/client/src/plugins/new-client/types.ts
//
// NOTE: 이 타입은 서버 측 jeeves/server/plugins/new-client/checklist-config.ts 및
// types.ts 와 동기화되어야 한다. 향후 공유 패키지로 추출 검토.

export type ChecklistItemKey =
  | 'katalkRoom' | 'businessLicense' | 'transferData' | 'hometaxCredentials'
  | 'wehago' | 'bookkeepingFeeConfirmed' | 'contract' | 'feeBillingDate'
  | 'paymentMethod' | 'cms' | 'hometaxDelegation' | 'ediDelegation'
  | 'businessAccount' | 'creditCard' | 'cashReceiptStore' | 'assignee'
  | 'wemembers' | 'semoreport' | 'onboardingComplete';

export type ItemKind = 'binary' | 'enum' | 'value';
export type ValueKind = 'text' | 'date';

export interface ChecklistItemDefinition {
  key: ChecklistItemKey;
  label: string;
  step?: number;
  kind: ItemKind;
  states?: string[];
  valueKind?: ValueKind;
  description?: string;
}

export interface ChecklistItemState {
  status?: string;
  value?: string;
  note?: string;
  updatedAt: string;
}

export type ChecklistState = Partial<Record<ChecklistItemKey, ChecklistItemState>>;

export type BusinessScope = '기장' | '신고대리';
export type InflowRoute = '소개1' | '소개2' | '블로그';

export interface NewClientInput {
  companyName: string;
  businessScope: BusinessScope;
  representative: string;
  startDate: string;
  industry: string;
  bookkeepingFee: number;
  adjustmentFee: number;
  inflowRoute: InflowRoute;
  contractNote?: string;
}

export interface NewClientRecord extends NewClientInput {
  id: string;
  createdAt: string;
  checklist: ChecklistState;
}

export interface NewClientListItem {
  id: string;
  companyName: string;
  representative: string;
  industry: string;
  startDate: string;
  createdAt: string;
  progress: { done: number; total: number };
  checklistUpdatedAt?: string;
}

export interface ChecklistUpdateInput {
  status?: string;
  value?: string;
  note?: string;
}

export interface ChecklistUpdateResponse {
  ok: true;
  itemKey: ChecklistItemKey;
  state: ChecklistItemState;
}

// Client-side copy of CHECKLIST_ITEMS (keep in sync with server)
export const CHECKLIST_ITEMS: ChecklistItemDefinition[] = [
  { key: 'katalkRoom', label: '카톡방', step: 1, kind: 'binary',
    states: ['none', 'done'], description: '단톡방 개설 후 체크' },
  { key: 'businessLicense', label: '사업자등록증', step: 2, kind: 'enum',
    states: ['none', '자료요청', '접수완료', '발급완료'],
    description: '사업자등록 신청·발급 진행 상태' },
  { key: 'transferData', label: '이관자료', step: 3, kind: 'enum',
    states: ['none', '신규', '요청', '백업완료'],
    description: '드롭박스 기장 거래처 폴더 생성' },
  { key: 'hometaxCredentials', label: '홈택스 ID/PW', kind: 'binary',
    states: ['none', 'done'], description: '거래처에게 전달받아 기재' },
  { key: 'wehago', label: '위하고', step: 4, kind: 'binary',
    states: ['none', 'done'], description: '위하고 업체 생성 확인 후 체크' },
  { key: 'bookkeepingFeeConfirmed', label: '기장료', kind: 'binary',
    states: ['none', 'done'], description: '정세무사님 기장료 확인 완료' },
  { key: 'contract', label: '기장계약서', step: 6, kind: 'binary',
    states: ['none', 'done'], description: '기장계약서 거래처 전달 완료' },
  { key: 'feeBillingDate', label: '수수료 청구일', kind: 'value',
    valueKind: 'date', description: 'CMS 출금일 (기본 매월 25일)' },
  { key: 'paymentMethod', label: '결제방식', kind: 'enum',
    states: ['none', 'CMS', '계좌이체', '해당없음'] },
  { key: 'cms', label: 'CMS', step: 7, kind: 'enum',
    states: ['none', '등록대기', '등록완료'], description: '더빌 자동출금 등록 상태' },
  { key: 'hometaxDelegation', label: '홈택스 수임', step: 8, kind: 'binary',
    states: ['none', 'done'], description: '홈택스 수임동의 완료' },
  { key: 'ediDelegation', label: 'EDI 수임', step: 9, kind: 'binary',
    states: ['none', 'done'], description: '연금/건강공단 EDI 수임등록' },
  { key: 'businessAccount', label: '사업용계좌', step: 10, kind: 'enum',
    states: ['none', '등록대기', '등록완료'] },
  { key: 'creditCard', label: '신용카드', step: 10, kind: 'enum',
    states: ['none', '등록대기', '등록완료'] },
  { key: 'cashReceiptStore', label: '현영가맹점', step: 11, kind: 'enum',
    states: ['none', '등록대기', '등록완료'] },
  { key: 'assignee', label: '실무자', kind: 'value', valueKind: 'text',
    description: '담당자 이름 또는 "미배정"' },
  { key: 'wemembers', label: '위멤버스', step: 12, kind: 'binary',
    states: ['none', 'done'] },
  { key: 'semoreport', label: '세모리포트', step: 13, kind: 'binary',
    states: ['none', 'done'] },
  { key: 'onboardingComplete', label: '수임완료', kind: 'binary',
    states: ['none', 'done'], description: '위 절차가 모두 완료되면 체크' },
];

export function isItemDone(
  def: ChecklistItemDefinition,
  state: ChecklistItemState | undefined,
): boolean {
  if (!state) return false;
  if (def.kind === 'value') {
    return typeof state.value === 'string' && state.value.trim() !== '';
  }
  const states = def.states!;
  return state.status === states[states.length - 1];
}
```

- [ ] **Step 2: Create useNewClients hook**

```typescript
// jeeves/client/src/plugins/new-client/hooks/useNewClients.ts

import { useCallback, useEffect, useState } from 'react';
import { useApi } from '../../../core/hooks/useApi';
import type { NewClientListItem, NewClientRecord } from '../types';

export function useClientList() {
  const api = useApi();
  const [list, setList] = useState<NewClientListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<NewClientListItem[]>('/new-client/list');
      setList(data);
    } catch (e: any) {
      setError(e.message ?? 'failed to load');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { list, loading, error, reload };
}

export function useClientDetail(id: string | null) {
  const api = useApi();
  const [record, setRecord] = useState<NewClientRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!id) {
      setRecord(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<NewClientRecord>(`/new-client/${id}`);
      setRecord(data);
    } catch (e: any) {
      setError(e.message ?? 'failed to load');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { record, loading, error, reload, setRecord };
}
```

- [ ] **Step 3: Create useChecklistUpdate hook**

```typescript
// jeeves/client/src/plugins/new-client/hooks/useChecklistUpdate.ts

import { useCallback, useState } from 'react';
import { useApi } from '../../../core/hooks/useApi';
import type {
  ChecklistItemKey,
  ChecklistUpdateInput,
  ChecklistUpdateResponse,
} from '../types';

export function useChecklistUpdate(clientId: string | null) {
  const api = useApi();
  const [pending, setPending] = useState<ChecklistItemKey | null>(null);
  const [error, setError] = useState<string | null>(null);

  const update = useCallback(
    async (itemKey: ChecklistItemKey, payload: ChecklistUpdateInput) => {
      if (!clientId) throw new Error('no client');
      setPending(itemKey);
      setError(null);
      try {
        const res = await api.patch<ChecklistUpdateResponse>(
          `/new-client/${clientId}/checklist/${itemKey}`,
          payload,
        );
        return res;
      } catch (e: any) {
        setError(e.message ?? 'update failed');
        throw e;
      } finally {
        setPending(null);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [clientId],
  );

  return { update, pending, error };
}
```

- [ ] **Step 4: Create NewClientPage placeholder**

```tsx
// jeeves/client/src/plugins/new-client/NewClientPage.tsx

export function NewClientPage() {
  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">신규 수임처</h1>
      <div className="text-muted">로딩 중...</div>
    </div>
  );
}
```

- [ ] **Step 5: Create plugin index**

```tsx
// jeeves/client/src/plugins/new-client/index.tsx

import type { MacroPagePlugin } from '../types';
import { NewClientPage } from './NewClientPage';

export const newClientPlugin: MacroPagePlugin = {
  id: 'new-client',
  name: '신규 수임처',
  icon: '📋',
  status: 'ready',
  description: '신규 수임처 등록 및 19개 체크리스트 진행 관리',
  Page: NewClientPage,
};
```

- [ ] **Step 6: Register in plugins index**

Edit `jeeves/client/src/plugins/index.tsx`:

Add import near the top with other plugin imports:
```tsx
import { newClientPlugin } from './new-client';
```

Add to the plugins array as the first `ready` entry after `thebillSyncPlugin`:
```tsx
export const plugins: MacroPagePlugin[] = [
  vatNoticePlugin,
  kakaoSendPlugin,
  thebillSyncPlugin,
  newClientPlugin,
  // ... existing coming-soon entries
```

- [ ] **Step 7: Typecheck**

Run:
```bash
cd /Users/hany/workzone/codetax-macro/jeeves/client && npx tsc -b --noEmit
```

Expected: exit code 0.

- [ ] **Step 8: Start client dev, verify plugin appears in sidebar**

Run server (if not running):
```bash
cd /Users/hany/workzone/codetax-macro/jeeves && npm run dev
```

Run client in a separate terminal:
```bash
cd /Users/hany/workzone/codetax-macro/jeeves && npm run dev:client
```

Open `http://localhost:5173/` (or Vite default). Confirm "신규 수임처" appears in the sidebar with 📋 icon. Click it — should show "로딩 중..." placeholder.

- [ ] **Step 9: Commit**

```bash
cd /Users/hany/workzone/codetax-macro && git add jeeves/client/src/plugins/new-client jeeves/client/src/plugins/index.tsx && git commit -m "feat(new-client): add client plugin scaffold with types and api hooks

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: 클라이언트 — 등록 양식

**Files:**
- Create: `jeeves/client/src/plugins/new-client/components/NewClientForm.tsx`

9개 필드 등록 양식. 제출 성공 시 onSuccess 콜백으로 부모에게 알린다.

- [ ] **Step 1: Create NewClientForm**

```tsx
// jeeves/client/src/plugins/new-client/components/NewClientForm.tsx

import { useState, type FormEvent } from 'react';
import { useApi } from '../../../core/hooks/useApi';
import type { BusinessScope, InflowRoute } from '../types';

const BUSINESS_SCOPES: BusinessScope[] = ['기장', '신고대리'];
const INFLOW_ROUTES: InflowRoute[] = ['소개1', '소개2', '블로그'];

interface Props {
  onSuccess: (id: string, slackNotified: boolean) => void;
  onCancel?: () => void;
}

interface SubmitResponse {
  ok: true;
  id: string;
  slackNotified: boolean;
}

export function NewClientForm({ onSuccess, onCancel }: Props) {
  const api = useApi();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [companyName, setCompanyName] = useState('');
  const [businessScope, setBusinessScope] = useState<BusinessScope>('기장');
  const [representative, setRepresentative] = useState('');
  const [startDate, setStartDate] = useState('');
  const [industry, setIndustry] = useState('');
  const [bookkeepingFee, setBookkeepingFee] = useState('');
  const [adjustmentFee, setAdjustmentFee] = useState('');
  const [inflowRoute, setInflowRoute] = useState<InflowRoute>('블로그');
  const [contractNote, setContractNote] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const body = {
        companyName: companyName.trim(),
        businessScope,
        representative: representative.trim(),
        startDate,
        industry: industry.trim(),
        bookkeepingFee: Number(bookkeepingFee) || 0,
        adjustmentFee: Number(adjustmentFee) || 0,
        inflowRoute,
        contractNote: contractNote.trim() || undefined,
      };
      const res = await api.post<SubmitResponse>('/new-client/submit', body);
      onSuccess(res.id, res.slackNotified);
    } catch (e: any) {
      setError(e.message ?? '등록 실패');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
      <h2 className="text-lg font-bold">신규 수임처 등록</h2>

      <Field label="업체명" required>
        <input className={inputCls} value={companyName} onChange={(e) => setCompanyName(e.target.value)} required />
      </Field>

      <Field label="업무 범위" required>
        <select className={inputCls} value={businessScope} onChange={(e) => setBusinessScope(e.target.value as BusinessScope)}>
          {BUSINESS_SCOPES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </Field>

      <Field label="대표자" required>
        <input className={inputCls} value={representative} onChange={(e) => setRepresentative(e.target.value)} required />
      </Field>

      <Field label="업무착수일" required>
        <input type="date" className={inputCls} value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
      </Field>

      <Field label="업종" required>
        <input className={inputCls} value={industry} onChange={(e) => setIndustry(e.target.value)} required />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="기장료 (원)" required>
          <input type="number" min={0} className={inputCls} value={bookkeepingFee} onChange={(e) => setBookkeepingFee(e.target.value)} required />
        </Field>
        <Field label="조정료 (원)" required>
          <input type="number" min={0} className={inputCls} value={adjustmentFee} onChange={(e) => setAdjustmentFee(e.target.value)} required />
        </Field>
      </div>

      <Field label="유입경로" required>
        <select className={inputCls} value={inflowRoute} onChange={(e) => setInflowRoute(e.target.value as InflowRoute)}>
          {INFLOW_ROUTES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </Field>

      <Field label="계약특이사항">
        <textarea className={inputCls} rows={3} value={contractNote} onChange={(e) => setContractNote(e.target.value)} />
      </Field>

      {error && <div className="text-danger text-sm">{error}</div>}

      <div className="flex gap-2">
        <button type="submit" disabled={submitting}
          className="px-4 py-2 rounded bg-accent text-white disabled:opacity-50">
          {submitting ? '등록 중...' : '등록'}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel}
            className="px-4 py-2 rounded border border-border">취소</button>
        )}
      </div>
    </form>
  );
}

const inputCls =
  'w-full px-3 py-2 rounded border border-border bg-surface text-text focus:outline-none focus:border-accent';

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium mb-1">
        {label}{required && <span className="text-danger ml-1">*</span>}
      </span>
      {children}
    </label>
  );
}
```

- [ ] **Step 2: Typecheck**

Run:
```bash
cd /Users/hany/workzone/codetax-macro/jeeves/client && npx tsc -b --noEmit
```

Expected: exit code 0.

- [ ] **Step 3: Commit**

```bash
cd /Users/hany/workzone/codetax-macro && git add jeeves/client/src/plugins/new-client/components/NewClientForm.tsx && git commit -m "feat(new-client): add registration form component

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: 클라이언트 — 진행률 표시 + 목록 테이블

**Files:**
- Create: `jeeves/client/src/plugins/new-client/components/ProgressPill.tsx`
- Create: `jeeves/client/src/plugins/new-client/components/ClientListTable.tsx`

- [ ] **Step 1: Create ProgressPill**

```tsx
// jeeves/client/src/plugins/new-client/components/ProgressPill.tsx

interface Props {
  done: number;
  total: number;
}

export function ProgressPill({ done, total }: Props) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div className="inline-flex items-center gap-2 min-w-[140px]">
      <div className="flex-1 bg-surface2 rounded-full h-2 overflow-hidden">
        <div
          className="h-full bg-accent transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-muted tabular-nums whitespace-nowrap">
        {done}/{total}
      </span>
    </div>
  );
}
```

- [ ] **Step 2: Create ClientListTable**

```tsx
// jeeves/client/src/plugins/new-client/components/ClientListTable.tsx

import { ProgressPill } from './ProgressPill';
import type { NewClientListItem } from '../types';

interface Props {
  items: NewClientListItem[];
  onSelect: (id: string) => void;
}

function formatKst(iso: string | undefined): string {
  if (!iso) return '-';
  const d = new Date(iso);
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return `${kst.getUTCFullYear()}-${String(kst.getUTCMonth() + 1).padStart(2, '0')}-${String(kst.getUTCDate()).padStart(2, '0')} ${String(kst.getUTCHours()).padStart(2, '0')}:${String(kst.getUTCMinutes()).padStart(2, '0')}`;
}

export function ClientListTable({ items, onSelect }: Props) {
  if (items.length === 0) {
    return <div className="text-muted text-sm">등록된 거래처가 없습니다.</div>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-muted text-left">
            <th className="py-2 pr-4">업체명</th>
            <th className="py-2 pr-4">대표자</th>
            <th className="py-2 pr-4">업종</th>
            <th className="py-2 pr-4">업무착수일</th>
            <th className="py-2 pr-4">진행률</th>
            <th className="py-2 pr-4">마지막 갱신</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr
              key={item.id}
              onClick={() => onSelect(item.id)}
              className="border-b border-border hover:bg-surface2 cursor-pointer"
            >
              <td className="py-2 pr-4 font-medium">{item.companyName}</td>
              <td className="py-2 pr-4">{item.representative}</td>
              <td className="py-2 pr-4">{item.industry}</td>
              <td className="py-2 pr-4">{item.startDate}</td>
              <td className="py-2 pr-4">
                <ProgressPill done={item.progress.done} total={item.progress.total} />
              </td>
              <td className="py-2 pr-4 text-muted">{formatKst(item.checklistUpdatedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

Run:
```bash
cd /Users/hany/workzone/codetax-macro/jeeves/client && npx tsc -b --noEmit
```

Expected: exit code 0.

- [ ] **Step 4: Commit**

```bash
cd /Users/hany/workzone/codetax-macro && git add jeeves/client/src/plugins/new-client/components/ProgressPill.tsx jeeves/client/src/plugins/new-client/components/ClientListTable.tsx && git commit -m "feat(new-client): add ProgressPill and ClientListTable components

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: 클라이언트 — 체크리스트 항목 행 + 테이블

**Files:**
- Create: `jeeves/client/src/plugins/new-client/components/ChecklistItemRow.tsx`
- Create: `jeeves/client/src/plugins/new-client/components/ChecklistTable.tsx`

- [ ] **Step 1: Create ChecklistItemRow**

```tsx
// jeeves/client/src/plugins/new-client/components/ChecklistItemRow.tsx

import { useEffect, useState } from 'react';
import { isItemDone } from '../types';
import type {
  ChecklistItemDefinition,
  ChecklistItemState,
  ChecklistUpdateInput,
} from '../types';

interface Props {
  def: ChecklistItemDefinition;
  state: ChecklistItemState | undefined;
  pending: boolean;
  onUpdate: (payload: ChecklistUpdateInput) => Promise<void>;
}

function formatKst(iso: string | undefined): string {
  if (!iso) return '-';
  const d = new Date(iso);
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return `${String(kst.getUTCMonth() + 1).padStart(2, '0')}-${String(kst.getUTCDate()).padStart(2, '0')} ${String(kst.getUTCHours()).padStart(2, '0')}:${String(kst.getUTCMinutes()).padStart(2, '0')}`;
}

export function ChecklistItemRow({ def, state, pending, onUpdate }: Props) {
  const done = isItemDone(def, state);
  const [localValue, setLocalValue] = useState<string>(state?.value ?? '');
  const [localNote, setLocalNote] = useState<string>(state?.note ?? '');
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setLocalValue(state?.value ?? '');
    setLocalNote(state?.note ?? '');
  }, [state?.value, state?.note]);

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

  return (
    <tr className={`border-b border-border ${done ? 'bg-surface2/40' : ''}`}>
      <td className="py-2 pr-3 text-xs text-muted whitespace-nowrap">
        {def.step ? `STEP ${def.step}` : ''}
      </td>
      <td className="py-2 pr-3 font-medium whitespace-nowrap">{def.label}</td>
      <td className="py-2 pr-3 text-xs text-muted">{def.description ?? ''}</td>
      <td className="py-2 pr-3">
        {renderEditor(def, state, localValue, setLocalValue, submitStatus, submitValue)}
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

function renderEditor(
  def: ChecklistItemDefinition,
  state: ChecklistItemState | undefined,
  localValue: string,
  setLocalValue: (v: string) => void,
  submitStatus: (v: string) => void,
  submitValue: (v: string) => void,
) {
  if (def.kind === 'binary') {
    const checked = state?.status === 'done';
    return (
      <label className="inline-flex items-center gap-1">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => submitStatus(e.target.checked ? 'done' : 'none')}
        />
        <span className="text-xs">{checked ? '완료' : '대기'}</span>
      </label>
    );
  }
  if (def.kind === 'enum') {
    const current = state?.status ?? 'none';
    return (
      <select
        value={current}
        onChange={(e) => submitStatus(e.target.value)}
        className="px-2 py-1 rounded border border-border bg-surface text-xs"
      >
        {def.states!.map((s) => (
          <option key={s} value={s}>{s === 'none' ? '— 선택 —' : s}</option>
        ))}
      </select>
    );
  }
  // value
  const type = def.valueKind === 'date' ? 'date' : 'text';
  return (
    <input
      type={type}
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={() => submitValue(localValue.trim())}
      placeholder={def.valueKind === 'date' ? 'YYYY-MM-DD' : ''}
      className="px-2 py-1 rounded border border-border bg-surface text-xs"
    />
  );
}
```

- [ ] **Step 2: Create ChecklistTable**

```tsx
// jeeves/client/src/plugins/new-client/components/ChecklistTable.tsx

import { CHECKLIST_ITEMS } from '../types';
import { ChecklistItemRow } from './ChecklistItemRow';
import type {
  ChecklistItemKey,
  ChecklistState,
  ChecklistUpdateInput,
} from '../types';

interface Props {
  checklist: ChecklistState;
  pendingKey: ChecklistItemKey | null;
  onUpdate: (itemKey: ChecklistItemKey, payload: ChecklistUpdateInput) => Promise<void>;
}

export function ChecklistTable({ checklist, pendingKey, onUpdate }: Props) {
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
              onUpdate={(payload) => onUpdate(def.key, payload)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

Run:
```bash
cd /Users/hany/workzone/codetax-macro/jeeves/client && npx tsc -b --noEmit
```

Expected: exit code 0.

- [ ] **Step 4: Commit**

```bash
cd /Users/hany/workzone/codetax-macro && git add jeeves/client/src/plugins/new-client/components/ChecklistItemRow.tsx jeeves/client/src/plugins/new-client/components/ChecklistTable.tsx && git commit -m "feat(new-client): add checklist table and item row editor

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: 클라이언트 — 상위 페이지 통합

**Files:**
- Modify: `jeeves/client/src/plugins/new-client/NewClientPage.tsx` (full rewrite)

내부 상태(`view: 'list' | 'detail' | 'register'`)로 세 가지 뷰를 전환하는 컨테이너 페이지.

- [ ] **Step 1: Replace NewClientPage content**

```tsx
// jeeves/client/src/plugins/new-client/NewClientPage.tsx

import { useState } from 'react';
import { Toast } from '../../core/components/Toast';
import { ClientListTable } from './components/ClientListTable';
import { NewClientForm } from './components/NewClientForm';
import { ChecklistTable } from './components/ChecklistTable';
import { ProgressPill } from './components/ProgressPill';
import { useClientList, useClientDetail } from './hooks/useNewClients';
import { useChecklistUpdate } from './hooks/useChecklistUpdate';
import { isItemDone, CHECKLIST_ITEMS } from './types';
import type { ChecklistItemKey, ChecklistUpdateInput, NewClientRecord } from './types';

type View = 'list' | 'detail' | 'register';

export function NewClientPage() {
  const [view, setView] = useState<View>('list');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const { list, loading: listLoading, error: listError, reload: reloadList } = useClientList();

  return (
    <div className="p-6 space-y-4">
      <Header view={view} onBack={() => { setView('list'); setSelectedId(null); }} onRegister={() => setView('register')} />

      {view === 'list' && (
        <>
          {listError && <div className="text-danger text-sm">{listError}</div>}
          {listLoading ? <div className="text-muted">로딩 중...</div> : (
            <ClientListTable items={list} onSelect={(id) => { setSelectedId(id); setView('detail'); }} />
          )}
        </>
      )}

      {view === 'register' && (
        <NewClientForm
          onSuccess={async (_id, slackNotified) => {
            setToast(slackNotified ? '등록 완료 (Slack 알림 전송됨)' : '등록 완료 (Slack 알림 실패 — 로그 확인)');
            await reloadList();
            setView('list');
          }}
          onCancel={() => setView('list')}
        />
      )}

      {view === 'detail' && selectedId && (
        <DetailView
          clientId={selectedId}
          onToast={setToast}
          onListReloadNeeded={reloadList}
        />
      )}

      <Toast message={toast} onDone={() => setToast(null)} />
    </div>
  );
}

function Header({
  view,
  onBack,
  onRegister,
}: { view: View; onBack: () => void; onRegister: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        {view !== 'list' && (
          <button onClick={onBack} className="text-sm text-muted hover:text-text">← 목록</button>
        )}
        <h1 className="text-xl font-bold">신규 수임처</h1>
      </div>
      {view === 'list' && (
        <button
          onClick={onRegister}
          className="px-3 py-1.5 rounded bg-accent text-white text-sm hover:opacity-90"
        >+ 신규 등록</button>
      )}
    </div>
  );
}

function DetailView({
  clientId,
  onToast,
  onListReloadNeeded,
}: {
  clientId: string;
  onToast: (msg: string) => void;
  onListReloadNeeded: () => Promise<void>;
}) {
  const { record, loading, error, setRecord, reload } = useClientDetail(clientId);
  const { update, pending } = useChecklistUpdate(clientId);

  if (loading && !record) return <div className="text-muted">로딩 중...</div>;
  if (error) return <div className="text-danger text-sm">{error}</div>;
  if (!record) return <div className="text-muted">거래처를 찾을 수 없습니다.</div>;

  async function handleUpdate(itemKey: ChecklistItemKey, payload: ChecklistUpdateInput) {
    try {
      const res = await update(itemKey, payload);
      // optimistic local update — avoid a full refetch on every keystroke
      setRecord((prev) =>
        prev ? { ...prev, checklist: { ...prev.checklist, [itemKey]: res.state } } : prev,
      );
      onListReloadNeeded(); // progress on list page
    } catch (e: any) {
      onToast(`저장 실패: ${e.message ?? 'unknown'}`);
      // refetch to re-sync with server state
      reload();
    }
  }

  const progressDone = CHECKLIST_ITEMS.reduce(
    (n, def) => (isItemDone(def, record.checklist[def.key]) ? n + 1 : n),
    0,
  );

  return (
    <div className="space-y-4">
      <div className="flex items-baseline gap-4">
        <h2 className="text-lg font-bold">{record.companyName}</h2>
        <span className="text-sm text-muted">대표자 {record.representative}</span>
        <div className="ml-auto"><ProgressPill done={progressDone} total={CHECKLIST_ITEMS.length} /></div>
      </div>

      <InfoCard record={record} />

      <div>
        <h3 className="text-sm font-medium mb-2 text-muted">체크리스트</h3>
        <ChecklistTable
          checklist={record.checklist}
          pendingKey={pending}
          onUpdate={handleUpdate}
        />
      </div>
    </div>
  );
}

function InfoCard({ record }: { record: NewClientRecord }) {
  const fields: Array<[string, string]> = [
    ['업무 범위', record.businessScope],
    ['업종', record.industry],
    ['업무착수일', record.startDate],
    ['기장료', `${record.bookkeepingFee.toLocaleString('en-US')}원`],
    ['조정료', `${record.adjustmentFee.toLocaleString('en-US')}원`],
    ['유입경로', record.inflowRoute],
  ];
  return (
    <div className="border border-border rounded p-4 space-y-2 text-sm">
      <div className="grid grid-cols-3 gap-3">
        {fields.map(([k, v]) => (
          <div key={k}>
            <div className="text-xs text-muted">{k}</div>
            <div>{v}</div>
          </div>
        ))}
      </div>
      {record.contractNote && (
        <div>
          <div className="text-xs text-muted">계약특이사항</div>
          <div className="whitespace-pre-wrap">{record.contractNote}</div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run:
```bash
cd /Users/hany/workzone/codetax-macro/jeeves/client && npx tsc -b --noEmit
```

Expected: exit code 0.

- [ ] **Step 3: Commit**

```bash
cd /Users/hany/workzone/codetax-macro && git add jeeves/client/src/plugins/new-client/NewClientPage.tsx && git commit -m "feat(new-client): wire list, register, and detail views in NewClientPage

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: 엔드-투-엔드 수동 검증

**Files:** 없음 (검증만)

- [ ] **Step 1: Start server and client**

Terminal 1:
```bash
cd /Users/hany/workzone/codetax-macro/jeeves && npm run dev
```

Terminal 2:
```bash
cd /Users/hany/workzone/codetax-macro/jeeves && npm run dev:client
```

- [ ] **Step 2: Golden path test**

브라우저에서 Vite dev URL 열기 (보통 `http://localhost:5173/`).

1. 사이드바에서 "신규 수임처" 클릭 → 빈 목록 또는 기존 등록 목록 확인
2. "+ 신규 등록" 클릭 → 9개 필드 양식 표시 확인
3. 모든 필드 입력 (업체명, 업무 범위, 대표자, 업무착수일, 업종, 기장료 300000, 조정료 500000, 유입경로, 계약특이사항) → "등록" 클릭
4. 토스트 메시지 "등록 완료" 확인 → 목록으로 복귀 → 새 거래처 행 진행률 **0/19** 확인
5. 새 거래처 행 클릭 → 상세 페이지 진입 → 상단 진행률 0/19 확인 → 등록 정보 카드 확인 → 체크리스트 19개 행 표시 확인
6. 카톡방 체크박스 체크 → "저장 중..." 후 "갱신 시간" 업데이트 확인 → 상단 진행률 1/19
7. 사업자등록증 드롭다운 → `자료요청` 선택 (진행률 여전히 1/19 — 마지막 상태 아님)
8. 사업자등록증 드롭다운 → `발급완료` 선택 → 진행률 2/19
9. 실무자 텍스트 인풋에 "김다원" 입력 → 다른 곳 클릭(blur) → 진행률 3/19
10. 수수료 청구일 날짜 인풋에 `2026-05-25` 입력 → blur → 진행률 4/19
11. 메모 컬럼 아무 행에 "테스트 메모" 입력 → blur → 메모 저장 확인 (진행률 변화 없음)
12. "← 목록" 클릭 → 목록에서 해당 거래처 진행률 **4/19** 표시 확인, 마지막 갱신 컬럼에 시각 표시 확인

- [ ] **Step 3: Error path test**

브라우저 DevTools Network 탭을 연 상태로:

1. 잘못된 형식 수수료 청구일을 강제로 보내기 — 브라우저 UI에서는 `type="date"` 라 입력 자체가 막힘. 대신 console에서:
```javascript
await fetch('/api/new-client/<ID>/checklist/feeBillingDate', {
  method: 'PATCH', headers: {'Content-Type':'application/json'},
  body: JSON.stringify({ value: '2026/05/25' })
}).then(r => r.json());
```
Expected: `{ error: 'invalid date format for feeBillingDate (expected YYYY-MM-DD)' }` + response status 400.

2. 서버 중지 → 목록 페이지 진입 → "failed to load" 에러 메시지 표시 확인.

- [ ] **Step 4: Legacy record compatibility test**

1. 서버를 끈 상태에서 `jeeves/server/data/new-clients.json` 을 에디터로 열기
2. 아무 레코드에서 `"checklist": {...}` 필드 삭제 후 저장
3. 서버 재시작 → 목록 페이지에서 해당 거래처 진행률이 `0/19` 로 표시되는지 확인
4. 해당 거래처 상세 → 아무 항목 체크 → 파일 다시 열어서 `checklist` 필드 정상 저장 확인

- [ ] **Step 5: Final sanity**

```bash
cd /Users/hany/workzone/codetax-macro/jeeves/server && npx tsc --noEmit
cd /Users/hany/workzone/codetax-macro/jeeves/client && npx tsc -b --noEmit
```

Expected: 둘 다 exit code 0.

- [ ] **Step 6: (선택) 테스트 데이터 정리 커밋 없음**

테스트 중 생성된 거래처는 `jeeves/server/data/new-clients.json` 에 남지만, 해당 파일은 `.gitignore` 등록되어 있어 커밋 대상이 아니다. 현업 데이터와 섞일 위험이 있으면 파일에서 테스트 레코드만 삭제.

---

## 완료 기준

모든 Task의 `- [ ]` 체크박스가 `[x]` 로 채워졌고, 각 Task 말미의 커밋이 생성되었다면 완료. 기대 결과:

1. 서버가 5개 엔드포인트를 제공: POST submit, GET list, GET :id, PATCH checklist/:itemKey, (기존 Slack 알림 유지)
2. 클라이언트에서 등록/목록/상세/체크리스트 편집이 모두 동작
3. 항목 갱신이 서버 JSON 파일에 반영되고, 목록 진행률이 갱신
4. 기존 checklist 필드 없는 레코드도 정상 조회되고 편집 가능
5. 타입체크 및 검증 규칙이 모두 통과

향후 Layer 1+ 자동화 플러그인은 `PATCH /api/new-client/:id/checklist/:itemKey` 를 호출하여 항목 상태를 갱신한다.
