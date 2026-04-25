# Layer 1-A: Airtable 자동 동기화 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 신규 수임처 등록 시 Airtable `거래처` 테이블에 자동으로 레코드를 생성한다. 등록 폼의 업종 필드를 enum dropdown 으로 변경하고, 이관여부=이관일 때 이관사무실/이관사유를 입력받을 수 있게 한다.

**Architecture:** 기존 `new-client` 플러그인 내부에 `airtable.ts` 를 추가, 기존 Slack side-effect 패턴과 동일하게 submit 핸들러에서 호출. 실패해도 저장·Slack 은 유지. 폼 필드 확장은 서버/클라 타입을 함께 변경.

**Tech Stack:** `airtable` npm (이미 설치됨), Express, tsx, React 19

**Spec:** [`../specs/2026-04-22-airtable-sync-design.md`](../specs/2026-04-22-airtable-sync-design.md)

**참고:** 이 프로젝트는 자동화 테스트 인프라가 없다. 검증은 `tsc --noEmit`, `tsx -e` 인라인 실행, `curl`, 그리고 최종적으로 실제 Airtable 베이스 조회로 수행.

---

## File Structure

### 서버 (수정)
```
jeeves/server/plugins/new-client/
  types.ts              확장 — INDUSTRIES enum + 2개 이관 필드
  validate.ts           확장 — industry enum 검증 + 이관 필드 허용
  config.ts             확장 — AIRTABLE_NEW_CLIENT_* 3개 env 로드
  airtable.ts           신규 — createAirtableRecord + 필드 매핑
  routes.ts             확장 — submit 에서 Airtable 호출 + 응답 확장
jeeves/.env.example     확장 — 신규 env 3개 추가
```

### 클라이언트 (수정)
```
jeeves/client/src/plugins/new-client/
  types.ts                          확장 — INDUSTRIES, 2개 이관 필드
  components/NewClientForm.tsx      수정 — industry dropdown, 조건부 이관 필드
  NewClientPage.tsx                 수정 — InfoCard 에 이관 필드 표시
```

---

## Task 1: 서버 types.ts 확장

**Files:**
- Modify: `jeeves/server/plugins/new-client/types.ts`

`INDUSTRIES` 상수와 `Industry` 타입 추가. `NewClientInput` 에 `industry` 타입 변경 + 이관 필드 2개 추가.

- [ ] **Step 1: types.ts 수정**

현재 `INFLOW_ROUTES` 정의 블록 뒤에 아래를 추가:

```typescript
export const INDUSTRIES = [
  '건설업',
  '제조업',
  '도소매업',
  '음식점업',
  '부동산업',
  '서비스업',
  '정보통신업',
] as const;
export type Industry = typeof INDUSTRIES[number];
```

그리고 `NewClientInput` 의 `industry: string` 을 `industry: Industry` 로 변경. 마지막에 2필드 추가:

```typescript
  transferSourceOffice?: string;
  transferReason?: string;
```

- [ ] **Step 2: 서버 typecheck**

Run:
```bash
cd /Users/hany/workzone/codetax-macro/jeeves/server && npx tsc --noEmit
```

`validate.ts` 에서 `industry: string` 을 `Industry` 로 assign 하는 부분이 에러날 수 있음 (Task 2에서 해결). Task 2 완료 전까지는 에러 예상.

- [ ] **Step 3: 커밋**

```bash
cd /Users/hany/workzone/codetax-macro && git add jeeves/server/plugins/new-client/types.ts && git commit -m "feat(new-client): add INDUSTRIES enum and transfer-source fields

- 7-item industry enum matching Airtable '홈택스 업종' choices
- Optional transferSourceOffice, transferReason for transferStatus='이관'

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: 서버 validate.ts 확장

**Files:**
- Modify: `jeeves/server/plugins/new-client/validate.ts`

industry enum 검증 + 이관 필드 선택 처리.

- [ ] **Step 1: import 확장**

`import { ... } from './types'` 에 `INDUSTRIES` 추가.

- [ ] **Step 2: industry 검증 변경**

기존 `const industry = requireString('industry'); if (!industry) return { ok: false, error: 'missing: industry' };` 블록을 다음으로 교체:

```typescript
  const industry = b.industry;
  if (typeof industry !== 'string' || !INDUSTRIES.includes(industry as any)) {
    return { ok: false, error: 'invalid industry' };
  }
```

- [ ] **Step 3: 이관 필드 처리 추가**

`contractNote` 블록 직전(또는 직후, 어디든 반환 전)에:

```typescript
  const transferSourceOfficeRaw = b.transferSourceOffice;
  const transferSourceOffice =
    typeof transferSourceOfficeRaw === 'string' && transferSourceOfficeRaw.trim() !== ''
      ? transferSourceOfficeRaw.trim()
      : undefined;

  const transferReasonRaw = b.transferReason;
  const transferReason =
    typeof transferReasonRaw === 'string' && transferReasonRaw.trim() !== ''
      ? transferReasonRaw.trim()
      : undefined;
```

최종 `return` 의 `value` 객체에:

```typescript
      industry: industry as Industry,
      transferSourceOffice,
      transferReason,
```

(기존 `industry` 키는 바꾸고, 이관 필드 2개는 신규 추가)

그리고 import 에 `Industry` 타입도 추가.

- [ ] **Step 4: typecheck**

```bash
cd /Users/hany/workzone/codetax-macro/jeeves/server && npx tsc --noEmit
```

Expected: exit code 0.

- [ ] **Step 5: sanity check**

```bash
cd /Users/hany/workzone/codetax-macro/jeeves/server && npx tsx -e "
import { validateInput } from './plugins/new-client/validate';

const base = {
  companyName: 'Test', businessScope: '기장', representative: 'X',
  startDate: '2026-05-01', bookkeepingFee: 100000, adjustmentFee: 0,
  inflowRoute: '블로그', transferStatus: '신규', bizRegStatus: '기존',
};

console.log('valid industry:', validateInput({ ...base, industry: '제조업' }).ok);
console.log('invalid industry:', validateInput({ ...base, industry: '반도체제조업' }));
console.log('with transfer fields:', JSON.stringify(validateInput({ ...base, industry: '제조업', transferStatus: '이관', transferSourceOffice: '이전세무사', transferReason: '가격 인하' }), null, 2));
"
```

Expected:
```
valid industry: true
invalid industry: { ok: false, error: 'invalid industry' }
with transfer fields: { ok: true, value: { ..., transferSourceOffice: '이전세무사', transferReason: '가격 인하' } }
```

- [ ] **Step 6: 커밋**

```bash
cd /Users/hany/workzone/codetax-macro && git add jeeves/server/plugins/new-client/validate.ts && git commit -m "feat(new-client): validate industry enum and optional transfer fields

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: 서버 config.ts 확장

**Files:**
- Modify: `jeeves/server/plugins/new-client/config.ts`

Airtable 신규 env 3개 추가.

- [ ] **Step 1: config.ts 수정**

`NewClientConfig` 인터페이스와 `loadConfig` 함수를 확장:

```typescript
export interface NewClientConfig {
  slackBotToken: string | undefined;
  slackChannel: string | undefined;
  dataFile: string;
  airtableNewClientPat: string | undefined;
  airtableNewClientBaseId: string | undefined;
  airtableNewClientTableName: string;
}

export function loadConfig(): NewClientConfig {
  return {
    slackBotToken: process.env.SLACK_BOT_TOKEN,
    slackChannel: process.env.SLACK_NEW_CLIENT_CHANNEL,
    dataFile: path.resolve(__dirname, '../../data/new-clients.json'),
    airtableNewClientPat: process.env.AIRTABLE_NEW_CLIENT_PAT,
    airtableNewClientBaseId: process.env.AIRTABLE_NEW_CLIENT_BASE_ID,
    airtableNewClientTableName: process.env.AIRTABLE_NEW_CLIENT_TABLE_NAME || '거래처',
  };
}
```

- [ ] **Step 2: .env.example 확장**

`jeeves/.env.example` 의 `# 에어테이블` 섹션 하단에 추가:

```
# 에어테이블 - 신규 수임처 등록 전용 (Layer 1-A)
AIRTABLE_NEW_CLIENT_PAT=
AIRTABLE_NEW_CLIENT_BASE_ID=
AIRTABLE_NEW_CLIENT_TABLE_NAME=거래처
```

- [ ] **Step 3: typecheck**

```bash
cd /Users/hany/workzone/codetax-macro/jeeves/server && npx tsc --noEmit
```

Expected: exit code 0.

- [ ] **Step 4: 커밋**

```bash
cd /Users/hany/workzone/codetax-macro && git add jeeves/server/plugins/new-client/config.ts jeeves/.env.example && git commit -m "feat(new-client): add Airtable config for new-client sync

Separate PAT/baseId from existing thebill-sync Airtable env to keep
the two integrations independent.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: 서버 airtable.ts 신규 생성

**Files:**
- Create: `jeeves/server/plugins/new-client/airtable.ts`

필드 매핑 함수 `buildAirtableFields` 와 메인 `syncToAirtable` 함수.

- [ ] **Step 1: airtable.ts 작성**

```typescript
import Airtable from 'airtable';
import type { NewClientConfig } from './config';
import type { BusinessScope, BizRegStatus, NewClientRecord } from './types';

const BUSINESS_SCOPE_MAP: Record<BusinessScope, string> = {
  '기장': '1.기장',
  '신고대리': '2.신고대리',
};

const BIZ_REG_MAP: Record<BizRegStatus, string> = {
  '기존': '기존발급',
  '신규생성': '자료요청',
};

export function buildAirtableFields(r: NewClientRecord): Record<string, unknown> {
  const fields: Record<string, unknown> = {
    '업체명': r.companyName,
    '대표자': r.representative,
    '업무착수일': r.startDate,
    '기장료': r.bookkeepingFee,
    '유입경로': r.inflowRoute,
    '상태': '2.계약중',
    '업무범위': BUSINESS_SCOPE_MAP[r.businessScope],
    '사업자등록증': BIZ_REG_MAP[r.bizRegStatus],
    '홈택스 업종': [r.industry],
  };

  if (r.contractNote && r.contractNote.trim() !== '') {
    fields['계약특이사항'] = r.contractNote;
  }

  if (r.transferStatus === '이관') {
    if (r.transferSourceOffice && r.transferSourceOffice.trim() !== '') {
      fields['이관사무실'] = r.transferSourceOffice;
    }
    if (r.transferReason && r.transferReason.trim() !== '') {
      fields['이관사유'] = r.transferReason;
    }
  }

  return fields;
}

/**
 * Creates a new record in the configured Airtable base/table. Returns true on
 * success, false on any failure (missing config, network, Airtable API error).
 * Never throws.
 */
export async function syncToAirtable(
  record: NewClientRecord,
  cfg: NewClientConfig,
  logError: (msg: string) => void,
): Promise<boolean> {
  if (!cfg.airtableNewClientPat) {
    logError('[new-client] AIRTABLE_NEW_CLIENT_PAT not set — skipping airtable sync');
    return false;
  }
  if (!cfg.airtableNewClientBaseId) {
    logError('[new-client] AIRTABLE_NEW_CLIENT_BASE_ID not set — skipping airtable sync');
    return false;
  }

  try {
    const fields = buildAirtableFields(record);
    const base = new Airtable({ apiKey: cfg.airtableNewClientPat }).base(cfg.airtableNewClientBaseId);
    await base(cfg.airtableNewClientTableName).create([{ fields }]);
    return true;
  } catch (err: any) {
    logError(`[new-client] airtable sync failed: ${err.message || err}`);
    return false;
  }
}
```

- [ ] **Step 2: typecheck**

```bash
cd /Users/hany/workzone/codetax-macro/jeeves/server && npx tsc --noEmit
```

Expected: exit code 0.

- [ ] **Step 3: sanity check — buildAirtableFields**

```bash
cd /Users/hany/workzone/codetax-macro/jeeves/server && npx tsx -e "
import { buildAirtableFields } from './plugins/new-client/airtable';
const r = {
  id: 'x', createdAt: '2026-01-01', companyName: 'TEST',
  businessScope: '기장', representative: '홍길동', startDate: '2026-05-01',
  industry: '제조업', bookkeepingFee: 300000, adjustmentFee: 500000,
  inflowRoute: '블로그', transferStatus: '이관', bizRegStatus: '기존',
  transferSourceOffice: '이전세무사', transferReason: '가격 인하',
  checklist: {},
};
console.log(JSON.stringify(buildAirtableFields(r as any), null, 2));
"
```

Expected: 모든 매핑 필드가 올바르게 나오고, `홈택스 업종` 이 `['제조업']` 배열, `상태` 가 `'2.계약중'`, `업무범위` 가 `'1.기장'`, `사업자등록증` 이 `'기존발급'`, 이관사무실/이관사유 포함.

- [ ] **Step 4: 커밋**

```bash
cd /Users/hany/workzone/codetax-macro && git add jeeves/server/plugins/new-client/airtable.ts && git commit -m "feat(new-client): add Airtable sync with field mapping

- buildAirtableFields translates NewClientRecord to 거래처 table schema
- syncToAirtable is non-throwing and returns a success boolean
- Handles missing env and API errors gracefully

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: 서버 routes.ts 통합

**Files:**
- Modify: `jeeves/server/plugins/new-client/routes.ts`

submit 핸들러에서 Airtable 호출 추가, 응답에 `airtableSynced` 추가.

- [ ] **Step 1: routes.ts 수정**

import 블록에 추가:
```typescript
import { syncToAirtable } from './airtable';
```

submit 핸들러의 `notifyNewClient` 호출 직후 바로 아래에 Airtable 호출을 추가하고, 응답 객체도 확장:

```typescript
    ctx.log(`[new-client] registered: ${record.companyName}`);
    const slackNotified = await notifyNewClient(record, cfg, ctx.logError);
    const airtableSynced = await syncToAirtable(record, cfg, ctx.logError);
    return res.json({ ok: true, id: record.id, slackNotified, airtableSynced });
```

- [ ] **Step 2: typecheck**

```bash
cd /Users/hany/workzone/codetax-macro/jeeves/server && npx tsc --noEmit
```

Expected: exit code 0.

- [ ] **Step 3: 커밋**

```bash
cd /Users/hany/workzone/codetax-macro && git add jeeves/server/plugins/new-client/routes.ts && git commit -m "feat(new-client): call Airtable sync after Slack notify

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: 클라이언트 types.ts 확장

**Files:**
- Modify: `jeeves/client/src/plugins/new-client/types.ts`

서버와 동기: INDUSTRIES + 이관 필드 2개 + Industry 타입.

- [ ] **Step 1: types.ts 수정**

`InflowRoute` 정의 뒤에 추가:

```typescript
export const INDUSTRIES = [
  '건설업', '제조업', '도소매업', '음식점업',
  '부동산업', '서비스업', '정보통신업',
] as const;
export type Industry = typeof INDUSTRIES[number];
```

`NewClientInput` 의 `industry: string` 을 `industry: Industry` 로 변경. 맨 마지막에 2필드 추가:
```typescript
  transferSourceOffice?: string;
  transferReason?: string;
```

- [ ] **Step 2: typecheck**

```bash
cd /Users/hany/workzone/codetax-macro/jeeves/client && npx tsc -b --noEmit
```

Expected: exit code 0.

- [ ] **Step 3: 커밋**

```bash
cd /Users/hany/workzone/codetax-macro && git add jeeves/client/src/plugins/new-client/types.ts && git commit -m "feat(new-client): mirror INDUSTRIES enum and transfer fields on client

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: 등록 폼 확장 — industry dropdown + 조건부 이관 필드

**Files:**
- Modify: `jeeves/client/src/plugins/new-client/components/NewClientForm.tsx`

industry 를 text → select 로 변경, transferStatus='이관' 일 때 이관사무실/이관사유 입력 표시.

- [ ] **Step 1: import 에 INDUSTRIES 추가 + 타입 확장**

`NewClientFormValues` 인터페이스 수정:
- `industry: string` → `industry: Industry`
- 추가: `transferSourceOffice: string; transferReason: string;`

파일 상단에 추가:
```typescript
import type { Industry } from '../types';
import { INDUSTRIES } from '../types';
```

`EMPTY` 객체:
- `industry: ''` → `industry: '제조업'`
- 추가: `transferSourceOffice: '', transferReason: ''`

기존 타입 export (`BusinessScope`, `InflowRoute`) 옆에 `TransferStatus`, `BizRegStatus` 이미 있음. 유지.

- [ ] **Step 2: industry 입력을 select 로 교체**

기존 `<input type="text" ... value={values.industry} ...>` 블록 전체를 다음으로 교체:

```tsx
      <div>
        <label className="block text-sm font-medium mb-1">업종 *</label>
        <select
          className="w-full border border-border rounded px-3 py-2 bg-surface"
          value={values.industry}
          onChange={(e) => set('industry', e.target.value as Industry)}
          disabled={submitting}
        >
          {INDUSTRIES.map((ind) => (
            <option key={ind} value={ind}>{ind}</option>
          ))}
        </select>
      </div>
```

- [ ] **Step 3: 이관여부 select 바로 아래에 조건부 필드 추가**

`이관여부/사업자 생성여부` 두 select 의 `</div>` 바깥, 그러니까 해당 `grid-cols-2` 블록 바로 뒤에 추가:

```tsx
      {values.transferStatus === '이관' && (
        <div className="space-y-4 border-l-2 border-accent pl-4">
          <div>
            <label className="block text-sm font-medium mb-1">이관사무실</label>
            <input
              type="text"
              className="w-full border border-border rounded px-3 py-2 bg-surface"
              value={values.transferSourceOffice}
              onChange={(e) => set('transferSourceOffice', e.target.value)}
              disabled={submitting}
              placeholder="예: 코드세무회계"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">이관사유</label>
            <textarea
              className="w-full border border-border rounded px-3 py-2 bg-surface"
              rows={2}
              value={values.transferReason}
              onChange={(e) => set('transferReason', e.target.value)}
              disabled={submitting}
              placeholder="예: 가격 인하, 위치 편의성"
            />
          </div>
        </div>
      )}
```

- [ ] **Step 4: validate() 함수 확장**

`if (!values.industry.trim()) return '업종을 입력하세요';` 라인을 다음으로 교체:

```typescript
    if (!values.industry) return '업종을 선택하세요';
```

(enum 이므로 trim 필요 없음)

- [ ] **Step 5: typecheck**

```bash
cd /Users/hany/workzone/codetax-macro/jeeves/client && npx tsc -b --noEmit
```

Expected: exit code 0.

- [ ] **Step 6: 커밋**

```bash
cd /Users/hany/workzone/codetax-macro && git add jeeves/client/src/plugins/new-client/components/NewClientForm.tsx && git commit -m "feat(new-client): industry dropdown and conditional transfer fields

- Industry: free-text input replaced with 7-option select matching
  Airtable's 홈택스 업종 choices
- When 이관여부='이관', show optional 이관사무실 and 이관사유 inputs
  with accent-bordered panel

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: 상세 페이지 InfoCard 확장

**Files:**
- Modify: `jeeves/client/src/plugins/new-client/NewClientPage.tsx`

`InfoCard` 컴포넌트의 `fields` 배열에 이관사무실/이관사유 조건부 추가.

- [ ] **Step 1: InfoCard 수정**

현재:
```typescript
  const fields: Array<[string, string]> = [
    ['업무 범위', record.businessScope],
    ['업종', record.industry],
    ['업무착수일', record.startDate],
    ['기장료', `${record.bookkeepingFee.toLocaleString('en-US')}원`],
    ['조정료', `${record.adjustmentFee.toLocaleString('en-US')}원`],
    ['유입경로', record.inflowRoute],
    ['이관여부', record.transferStatus],
    ['사업자 생성여부', record.bizRegStatus],
  ];
```

`fields` 배열 선언 직후에 추가:
```typescript
  if (record.transferSourceOffice) {
    fields.push(['이관사무실', record.transferSourceOffice]);
  }
  if (record.transferReason) {
    fields.push(['이관사유', record.transferReason]);
  }
```

- [ ] **Step 2: typecheck**

```bash
cd /Users/hany/workzone/codetax-macro/jeeves/client && npx tsc -b --noEmit
```

Expected: exit code 0.

- [ ] **Step 3: 커밋**

```bash
cd /Users/hany/workzone/codetax-macro && git add jeeves/client/src/plugins/new-client/NewClientPage.tsx && git commit -m "feat(new-client): show transfer office and reason in detail InfoCard

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: .env 값 설정 + 서버 기동 확인

**Files:**
- Modify: `jeeves/.env` (커밋 X)

사용자가 전달한 실제 PAT/Base ID를 .env에 추가.

- [ ] **Step 1: .env 에 수동 추가**

`jeeves/.env` 파일을 열고 다음 3줄 추가:
```
AIRTABLE_NEW_CLIENT_PAT=patG5vrGJbjIlikC4.be0f1d224506ec890c25c87dae029c617c770ce3f205e2bc2d53c4a8b75a9902
AIRTABLE_NEW_CLIENT_BASE_ID=appGLQdwsGXyeoYji
AIRTABLE_NEW_CLIENT_TABLE_NAME=거래처
```

(.env 는 이미 .gitignore 되어 있음 — 커밋 대상 아님)

- [ ] **Step 2: 서버 재시작 확인**

tsx watch 가 구동 중이면 자동 리로드. 안 되어 있으면:
```bash
cd /Users/hany/workzone/codetax-macro/jeeves && npm run dev
```

서버 로그에서 Airtable 환경변수 관련 에러 없는지 확인.

- [ ] **Step 3: (커밋 없음)**

---

## Task 10: E2E 검증 — curl 기반

**Files:** 없음 (검증만)

- [ ] **Step 1: 신규 등록 curl 테스트 (이관 = 신규)**

```bash
curl -s -X POST http://localhost:3001/api/new-client/submit \
  -H 'Content-Type: application/json' \
  -d '{
    "companyName":"에어테이블테스트1",
    "businessScope":"기장",
    "representative":"홍길동",
    "startDate":"2026-05-01",
    "industry":"제조업",
    "bookkeepingFee":300000,
    "adjustmentFee":500000,
    "inflowRoute":"블로그",
    "transferStatus":"신규",
    "bizRegStatus":"기존"
  }'
```

Expected: `{"ok":true,"id":"...","slackNotified":true/false,"airtableSynced":true}`

- [ ] **Step 2: 이관 케이스 curl 테스트**

```bash
curl -s -X POST http://localhost:3001/api/new-client/submit \
  -H 'Content-Type: application/json' \
  -d '{
    "companyName":"에어테이블테스트2",
    "businessScope":"신고대리",
    "representative":"김대리",
    "startDate":"2026-05-15",
    "industry":"도소매업",
    "bookkeepingFee":0,
    "adjustmentFee":300000,
    "inflowRoute":"소개1",
    "transferStatus":"이관",
    "bizRegStatus":"신규생성",
    "transferSourceOffice":"이전세무사",
    "transferReason":"가격 인하"
  }'
```

Expected: `airtableSynced: true`.

- [ ] **Step 3: Airtable 베이스에서 직접 확인**

```bash
PAT="patG5vrGJbjIlikC4.be0f1d224506ec890c25c87dae029c617c770ce3f205e2bc2d53c4a8b75a9902"
BASE_ID="appGLQdwsGXyeoYji"
curl -s -H "Authorization: Bearer $PAT" \
  "https://api.airtable.com/v0/$BASE_ID/$(python3 -c 'import urllib.parse; print(urllib.parse.quote("거래처"))')?pageSize=3&sort%5B0%5D%5Bfield%5D=관리번호&sort%5B0%5D%5Bdirection%5D=desc" \
  | python3 -c "
import json, sys
d = json.load(sys.stdin)
for r in d.get('records', []):
    print('---')
    for k in ['업체명','대표자','업무범위','업무착수일','기장료','홈택스 업종','유입경로','상태','사업자등록증','이관사무실','이관사유','계약특이사항']:
        v = r['fields'].get(k)
        if v is not None: print(f'  {k}: {v}')
"
```

Expected: 방금 생성된 2개 레코드가 최신순으로 조회되고, 모든 매핑 필드가 올바름.

- [ ] **Step 4: 에러 케이스 — industry 잘못된 값**

```bash
curl -s -w ' [HTTP %{http_code}]' -X POST http://localhost:3001/api/new-client/submit \
  -H 'Content-Type: application/json' \
  -d '{"companyName":"BAD","businessScope":"기장","representative":"X","startDate":"2026-05-01","industry":"IT","bookkeepingFee":0,"adjustmentFee":0,"inflowRoute":"블로그","transferStatus":"신규","bizRegStatus":"기존"}'
```

Expected: `{"error":"invalid industry"} [HTTP 400]`

- [ ] **Step 5: 에러 케이스 — Airtable PAT 제거 상태 테스트 (선택)**

.env 의 `AIRTABLE_NEW_CLIENT_PAT` 라인을 주석 처리하고 서버 재시작 → 등록하면 `airtableSynced: false`, 저장/Slack 은 정상 동작. 확인 후 원복.

---

## Task 11: 브라우저 E2E 검증 (사용자 확인)

**Files:** 없음

- [ ] **Step 1: 브라우저에서 등록 폼 확인**

`http://localhost:5173/` 접속 → 📋 신규 수임처 → + 신규 등록:
1. 업종 필드가 **dropdown 7개** 로 표시되는지
2. 이관여부를 **이관** 으로 바꾸면 아래쪽에 **이관사무실/이관사유** 2개 필드가 나타나는지
3. **신규** 로 되돌리면 해당 블록이 사라지는지
4. 모두 채워서 등록 → 성공 토스트 → 목록에서 진행률 0/19 행 확인

- [ ] **Step 2: 상세 페이지에서 이관 필드 표시 확인**

등록한 이관 케이스 행 클릭 → InfoCard 에 **이관사무실**, **이관사유** 표시되는지.

- [ ] **Step 3: Airtable 베이스에서 해당 레코드 육안 확인**

browser로 Airtable 열어서 `거래처` 테이블에서 방금 만든 2개 레코드의 모든 필드 확인.

---

## 완료 기준

- 모든 Task 의 `[ ]` 체크박스가 `[x]` 로 채워짐
- 커밋 9개 생성 (Task 9, 10, 11 은 커밋 없음)
- `AIRTABLE_NEW_CLIENT_PAT/BASE_ID` 설정된 상태에서 신규 등록 시 Airtable 에 `2.계약중` 레코드 자동 생성
- 이관 케이스에서 `이관사무실`, `이관사유` 가 Airtable 에도 정확히 반영
- 업종이 enum 7종 외 값이면 400 반환
- Airtable 실패해도 JSON 저장과 Slack 알림은 유지 (`airtableSynced: false`)
