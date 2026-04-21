# 신규 수임처 마스터 트래커 설계

- 프로젝트: codetax-macro / jeeves
- 작성일: 2026-04-22
- 상태: Draft (pending user review)
- 선행 문서: `codetax-web-page/docs/superpowers/specs/2026-04-22-new-client-slack-notify-design.md` (등록 양식 + Slack 알림)

## 배경

Notion "✅ 신규 거래처 수임 스토리보드"는 신규 수임처 온보딩을 19개 체크리스트 + 13개 STEP으로 정의한다. 전체 자동화는 외부 시스템(홈택스, 위하고, 더빌, EDI 등) 13개 이상의 독립 하위 프로젝트로 분해되며, 이 스펙은 그 **첫 번째 하위 프로젝트 — 마스터 트래커**를 다룬다.

이후 STEP별 자동화 플러그인(Layer 1~5)은 본 트래커의 REST API를 호출해 항목 상태를 갱신한다.

## 목적

Jeeves 내에서 신규 수임처별 19개 체크리스트 상태를 **수동 등록/조회/갱신**할 수 있게 한다. 기존 `new-client` 플러그인(등록 양식 + Slack 알림)을 확장하여 체크리스트 기능을 추가한다.

## 요구사항

### 기능

- 신규 수임처 등록 시 기본 체크리스트가 자동 부여됨 (모든 항목 미완료 상태)
- 거래처 목록 페이지: 등록된 전체 거래처와 각자의 진행률을 한눈에 표시
- 거래처 상세 페이지: 19개 항목의 상태를 조회하고 수동으로 갱신 가능
- 항목 상태 변경 시 `updatedAt` 타임스탬프 자동 기록
- REST API로 항목 단위 갱신 노출 — 향후 자동화 플러그인의 공통 훅 지점

### 비기능

- 기존 `new-client` 플러그인 구조와 JSON 파일 저장 패턴 유지
- 기존 플러그인 아키텍처(`thebill-sync`, `kakao-send`)와 동일 패턴 준수
- 기존 레코드(체크리스트 필드 없는) 호환 — 읽기 시 자동 보정

### 범위 제외 (YAGNI)

- 다음 할 일 추천 / 워크플로우 의존성 로직
- 상태 변경 이력(history) 저장
- Slack 일일 요약 리포트
- 통계 대시보드
- 경합 락(lockfile)
- 수임완료 전환 시 별도 Slack 알림
- 외부 시스템(홈택스/위하고/더빌 등)과의 실제 동기화

## 아키텍처

### 서버 파일 구조 (기존 `new-client` 플러그인 확장)

```
jeeves/server/plugins/new-client/
  index.ts              (기존)
  routes.ts             확장: GET /:id, PATCH /:id/checklist/:itemKey 추가
  storage.ts            확장: readOne, updateChecklistItem 추가 + 마이그레이션 보정
  slack.ts              (기존 — 등록 시 알림만. 체크리스트 변경 알림은 범위 제외)
  config.ts             (기존)
  types.ts              확장: ChecklistItemKey, ChecklistItemState, ChecklistState 추가
  validate.ts           (기존) + validateChecklistUpdate 추가
  checklist-config.ts   신규: 19개 항목 정의 (CHECKLIST_ITEMS 배열)
```

### 클라이언트 파일 구조 (신규 — 현재 클라이언트 쪽은 미구현 상태)

```
jeeves/client/src/plugins/new-client/
  index.tsx                  플러그인 등록
  NewClientPage.tsx          거래처 목록 + 등록 양식 (탭 또는 모달)
  NewClientDetailPage.tsx    단일 거래처 상세 + 체크리스트
  components/
    NewClientForm.tsx        등록 양식 (기존 스펙 참조)
    ClientListTable.tsx      목록 테이블
    ChecklistTable.tsx       19개 항목 표
    ChecklistItemRow.tsx     항목별 편집 행 (binary/enum/value 분기)
    ProgressBar.tsx          완료율 표시
  hooks/
    useNewClients.ts         목록/상세 API 호출
    useChecklistUpdate.ts    PATCH 호출
```

### 저장 위치

- 데이터 파일: `jeeves/server/data/new-clients.json` (기존 유지, 스키마 확장)
- `.gitignore` 등록 상태 유지

## 데이터 모델

### 체크리스트 항목 3종 분류

| kind | 의미 | 완료 판정 |
|------|------|----------|
| `binary` | 단순 체크 (⬜/✅) | `status === 'done'` |
| `enum` | 여러 단계 중 하나 | `status === states[states.length - 1]` |
| `value` | 자유 입력 (텍스트/날짜) | `value` 가 비어있지 않음 |

### 항목 키

```typescript
export type ChecklistItemKey =
  | 'katalkRoom'              // 카톡방
  | 'businessLicense'         // 사업자등록증
  | 'transferData'            // 이관자료
  | 'hometaxCredentials'      // 홈택스 ID/PW
  | 'wehago'                  // 위하고
  | 'bookkeepingFeeConfirmed' // 기장료 (정세무사 확인)
  | 'contract'                // 기장계약서
  | 'feeBillingDate'          // 수수료 청구일
  | 'paymentMethod'           // 결제방식
  | 'cms'                     // 더빌 CMS
  | 'hometaxDelegation'       // 홈택스 수임
  | 'ediDelegation'           // EDI 수임
  | 'businessAccount'         // 사업용계좌
  | 'creditCard'              // 신용카드
  | 'cashReceiptStore'        // 현영가맹점
  | 'assignee'                // 실무자
  | 'wemembers'               // 위멤버스
  | 'semoreport'              // 세모리포트
  | 'onboardingComplete';     // 수임완료
```

### 항목 정의 타입

```typescript
export type ItemKind = 'binary' | 'enum' | 'value';
export type ValueKind = 'text' | 'date';

export interface ChecklistItemDefinition {
  key: ChecklistItemKey;
  label: string;              // UI 표시 한글 라벨
  step?: number;              // Notion STEP 번호 (UI 그룹/정렬용, 선택)
  kind: ItemKind;
  states?: string[];          // binary/enum 전용. binary는 ['none', 'done']
  valueKind?: ValueKind;      // value 전용
  description?: string;       // UI 힌트 텍스트
}
```

### 19개 항목 정의 (`checklist-config.ts`)

```typescript
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
  Object.fromEntries(CHECKLIST_ITEMS.map(item => [item.key, item])) as Record<ChecklistItemKey, ChecklistItemDefinition>;
```

### 항목 상태 타입

```typescript
export interface ChecklistItemState {
  status?: string;      // binary/enum 전용. 항목 정의의 states 중 하나. value kind에는 저장하지 않음
  value?: string;       // value kind 전용 (예: '2026-05-25', '홍길동')
  note?: string;        // 자유 메모 (모든 kind 공통)
  updatedAt: string;    // ISO 8601
}

export type ChecklistState = Partial<Record<ChecklistItemKey, ChecklistItemState>>;
```

**kind별 필드 사용 규칙:**
- `binary` / `enum`: `status` 필드만 사용 (`value` 무시)
- `value`: `value` 필드만 사용 (`status` 무시)
- `note` 는 모든 kind에서 선택적으로 기록 가능

### 확장된 레코드 타입

```typescript
export interface NewClientRecord extends NewClientInput {
  id: string;
  createdAt: string;
  checklist: ChecklistState;   // 신규 필드
}
```

### 마이그레이션 전략

`storage.readAll` 이 레코드를 읽을 때 `checklist` 필드가 없으면 `{}` 로 채워 반환한다. 파일 자체는 다음 쓰기 시점에 업데이트된다. 별도 마이그레이션 스크립트 불필요.

```typescript
// storage.ts 내부 보정 로직 (의사코드)
function normalize(record: any): NewClientRecord {
  return { ...record, checklist: record.checklist ?? {} };
}
```

## API

### 기존 엔드포인트

| Method | Path | 설명 |
|--------|------|------|
| POST | `/api/new-client/submit` | 신규 등록 (기존, `checklist: {}` 로 초기화되도록 내부 수정) |

### 신규 엔드포인트

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/new-client/list` | 전체 목록 + 각자 진행률 |
| GET | `/api/new-client/:id` | 단일 거래처 상세 (등록 정보 + 체크리스트) |
| PATCH | `/api/new-client/:id/checklist/:itemKey` | 항목 상태 갱신 |

### GET /api/new-client/list

응답:
```typescript
interface NewClientListItem {
  id: string;
  companyName: string;
  representative: string;
  industry: string;
  startDate: string;
  createdAt: string;
  progress: { done: number; total: number }; // 예: { done: 3, total: 19 }
  checklistUpdatedAt?: string;  // 가장 최근 체크리스트 갱신 시각
}
```

### GET /api/new-client/:id

응답: 전체 `NewClientRecord` 를 그대로 반환. 404 if not found.

### PATCH /api/new-client/:id/checklist/:itemKey

요청 바디:
```typescript
interface ChecklistUpdateInput {
  status?: string;   // binary/enum 전용
  value?: string;    // value 전용
  note?: string;     // 선택
}
```

검증 규칙:
- `itemKey` 가 `CHECKLIST_ITEM_MAP` 에 없으면 400 `unknown item`
- item kind 에 따라:
  - `binary`/`enum`: `status` 가 정의된 `states` 에 포함되어야 함. `value` 는 무시되어 저장되지 않음
  - `value`: `value` 가 문자열이어야 함. `valueKind === 'date'` 면 `YYYY-MM-DD` 검사. `status` 는 무시되어 저장되지 않음
- 모든 kind: `note` 는 선택 사항
- `status`/`value`/`note` 셋 다 미제공이면 400 `no update fields`

서버 저장 시 `updatedAt` 은 자동으로 현재 시각으로 설정됨.

응답:
```typescript
interface ChecklistUpdateResponse {
  ok: true;
  itemKey: ChecklistItemKey;
  state: ChecklistItemState;
}
```

## 데이터 흐름

### 신규 등록 (기존 흐름 확장)

1. 프론트 양식 제출 → `POST /api/new-client/submit`
2. 검증 통과 → `append()` 시 `checklist: {}` 로 초기화
3. Slack 알림 (기존)
4. 200 응답 `{ ok, id, slackNotified }`

### 목록 조회

1. `GET /api/new-client/list`
2. `readAll()` → 각 레코드에 대해 `computeProgress(record.checklist)` 계산
3. `NewClientListItem[]` 응답

### 상세 조회

1. `GET /api/new-client/:id`
2. `readAll()` → `find(r => r.id === id)` → 없으면 404

### 항목 갱신

1. 프론트 항목 편집 → `PATCH /api/new-client/:id/checklist/:itemKey` with `{ status }` 또는 `{ value }`
2. 서버 검증 (`validateChecklistUpdate(itemKey, body)`)
3. `updateChecklistItem(file, id, itemKey, updates)`:
   - `readAll()` → 레코드 탐색 → 없으면 404
   - kind에 따라 `record.checklist[itemKey]` 구성:
     - `binary`/`enum`: `{ status, note?, updatedAt: now }`
     - `value`: `{ value, note?, updatedAt: now }`
   - 기존 `note` 가 있고 이번 요청에 `note` 가 미제공이면 기존 `note` 유지
   - 전체 배열 재기록
4. 200 응답

## 진행률 계산

```typescript
function isItemDone(def: ChecklistItemDefinition, state: ChecklistItemState | undefined): boolean {
  if (!state) return false;
  if (def.kind === 'value') return typeof state.value === 'string' && state.value.trim() !== '';
  // binary / enum: 마지막 상태가 완료
  return state.status === def.states![def.states!.length - 1];
}

function computeProgress(checklist: ChecklistState): { done: number; total: number } {
  let done = 0;
  for (const def of CHECKLIST_ITEMS) {
    if (isItemDone(def, checklist[def.key])) done++;
  }
  return { done, total: CHECKLIST_ITEMS.length };
}
```

## 에러 처리

| 상황 | 서버 동작 | 프론트 |
|------|-----------|--------|
| 잘못된 `itemKey` | 400 `{ error: 'unknown item: <key>' }` | 에러 토스트 |
| binary/enum 에 정의되지 않은 `status` | 400 `{ error: 'invalid status for <itemKey>' }` | 에러 토스트 |
| value 항목에 `value` 누락 또는 비문자열 | 400 `{ error: 'value required for <itemKey>' }` | 에러 토스트 |
| valueKind='date' 포맷 위반 | 400 `{ error: 'invalid date format (YYYY-MM-DD)' }` | 에러 토스트 |
| 거래처 ID 없음 | 404 `{ error: 'not found' }` | 에러 토스트 |
| 파일 읽기/쓰기 실패 | 500 + 서버 로그 | 에러 토스트 |
| update 필드가 전혀 없음 | 400 `{ error: 'no update fields' }` | 에러 토스트 |

### 동시성

- 파일 쓰기: `readAll` → 레코드/항목 갱신 → `writeFile` 전체 덮어쓰기 (기존 `append` 패턴과 동일)
- 하루 수 건 수준에서는 락 불필요
- 빈도 증가 시 `proper-lockfile` 도입 고려 (향후)

### 로깅

- 항목 갱신 성공: `log('checklist updated: <companyName> / <itemKey> → <status|value>')` → SSE
- 실패: `logError(...)`

## UI 개요

### 거래처 목록 페이지 (`NewClientPage`)

- 상단: "신규 등록" 버튼 → 등록 양식 모달 또는 별도 탭
- 테이블 컬럼:
  - 업체명 / 대표자 / 업종 / 업무착수일 / 진행률(바 + `3/19`) / 마지막 갱신
- 행 클릭 시 상세 페이지로 이동
- 등록 정보 요약만 표시 (체크리스트 세부 항목은 여기서 편집하지 않음)

### 거래처 상세 페이지 (`NewClientDetailPage`)

- 상단 헤더: 업체명 / 대표자 / 전체 진행률 바
- 등록 정보 카드 (읽기 전용): 업무 범위, 업종, 기장료, 조정료, 유입경로, 계약특이사항
- 체크리스트 표 (19개 항목, `step` 순 정렬):
  - 컬럼: STEP / 라벨 / 설명 / 상태 편집 / 메모 / 마지막 갱신
  - 편집 UI:
    - `binary`: 체크박스 (none ↔ done)
    - `enum`: 드롭다운 (states 목록)
    - `value`: 텍스트 인풋 또는 날짜 인풋
  - 저장: 값 변경 시 자동으로 PATCH (또는 blur 시)
  - 저장 진행 중/완료/실패 인라인 표시

## 테스트 전략

### 수동 테스트 (golden path)

1. 서버/클라 기동 → 목록 페이지 진입 → 빈 상태 확인
2. 신규 거래처 등록 → Slack 알림 확인 + 목록에 0/19 진행률로 표시
3. 상세 페이지 진입 → 19개 항목 모두 미완료 상태
4. 카톡방 체크 → 진행률 1/19
5. 사업자등록증 상태를 '자료요청' → '접수완료' → '발급완료' 순차 변경 → 마지막에 진행률 +1
6. 실무자에 "홍길동" 입력 → 진행률 +1
7. 수수료 청구일을 `2026-05-25` 입력 → 진행률 +1
8. 수임완료 체크 → 항목 완료로 표시
9. `jeeves/server/data/new-clients.json` 열어 checklist 필드 저장 확인

### 수동 테스트 (에러 경로)

- `curl` 로 잘못된 itemKey 로 PATCH → 400 `unknown item`
- enum 항목에 정의되지 않은 status → 400 `invalid status`
- value 항목에 `value` 대신 `status` 만 보냄 → 400
- 존재하지 않는 ID → 404
- `feeBillingDate` 에 `2026/05/25` (잘못된 포맷) → 400

### 기존 레코드 호환성 테스트

1. 기존 스펙 구현분으로 1건 등록 (checklist 필드 없음)
2. 본 스펙 구현 후 목록 API 호출 → `checklist: {}` 로 보정되어 반환되는지
3. PATCH 한 번 실행 후 파일 열어 checklist 필드 정상 저장되는지

### 자동화 테스트

프로젝트 내 기존 테스트 인프라가 없어 수동 테스트로 충분. 필요 시:
- `checklist-config.ts` 의 `isItemDone`, `computeProgress` 단위 테스트
- `validate.ts` 의 `validateChecklistUpdate` 단위 테스트

## 향후 확장 포인트 (범위 제외)

- **자동화 플러그인 훅**: Layer 1~5 자동화 플러그인이 `PATCH /api/new-client/:id/checklist/:itemKey` 를 호출해 상태 갱신. 공통 서비스 함수 `updateChecklistItem` 을 서버 플러그인 간 직접 import 도 가능.
- **상태 변경 이력**: 현재는 `updatedAt` 만 저장. 향후 `history: { status, value, at, by }[]` 추가.
- **다음 할 일 추천**: `checklist-config.ts` 에 `dependsOn?: ChecklistItemKey[]` 추가하여 선후 관계 표현.
- **수임완료 Slack 알림**: `onboardingComplete` 전환 시 Slack 메시지.
- **상여 체계 연동**: `project_bonus_system.md` 메모리 기반 A요소 자동 계산.
- **등록 정보 수정**: 현재는 등록 후 수정 불가. 향후 PATCH 엔드포인트 추가 검토.
- **외부 시스템 동기화**: 홈택스·위하고·더빌·EDI 등 (Layer 2~5).
