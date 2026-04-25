# Layer 1-A: Airtable 자동 동기화 설계

- 프로젝트: codetax-macro / jeeves
- 작성일: 2026-04-22
- 상태: Approved (pending implementation)
- 선행: Layer 0 마스터 트래커 (`2026-04-22-new-client-master-tracker-design.md`)

## 목적

신규 수임처 등록 시 Airtable `거래처` 테이블에 자동으로 새 레코드를 생성한다. Notion 워크플로우 STEP 0 ("에어테이블에 입력") 의 수동 단계를 완전히 제거한다.

## 요구사항

### 기능
- `POST /api/new-client/submit` 성공 후 Airtable 레코드 자동 생성
- 등록 폼의 11개 필드를 Airtable `거래처` 테이블의 대응 컬럼으로 매핑
- 상태 컬럼은 자동으로 `2.계약중` 로 세팅
- 실패 시 JSON 저장과 Slack 알림은 유지 (Airtable만 스킵)
- 응답에 `airtableSynced: boolean` 추가

### 비기능
- 기존 `new-client` 플러그인 내부에 통합 (Slack 패턴과 동일한 side-effect)
- 기존 `AIRTABLE_PAT` (thebill-sync용) 와 분리된 신규 환경변수
- `airtable` npm 패키지 재사용 (이미 설치됨)

### 범위 제외 (YAGNI)
- Airtable 레코드 업데이트 (수정된 경우 다시 생성만)
- Airtable 삭제 동기화
- Airtable 변경을 jeeves 쪽에 역동기화
- 대량 일괄 import

## 결정 사항 (사용자 확정)

1. **업종(industry) 처리**: 자유텍스트 → **7개 선택형 dropdown** 으로 변경
   - 값: `건설업` / `제조업` / `도소매업` / `음식점업` / `부동산업` / `서비스업` / `정보통신업`
2. **이관 정보**: 폼에 `이관사무실`, `이관사유` 2개 선택 필드 추가 (transferStatus='이관' 일 때만 표시)
3. **환경변수**: 기존 `AIRTABLE_PAT` 과 분리한 **신규 env 추가**

## 필드 매핑

### 직접 매핑 (단순 복사)

| jeeves 필드 | Airtable 필드 | 타입 |
|---|---|---|
| companyName | 업체명 | singleLineText |
| representative | 대표자 | singleLineText |
| startDate | 업무착수일 | date |
| bookkeepingFee | 기장료 | currency |
| inflowRoute | 유입경로 | singleSelect (값 일치) |
| contractNote | 계약특이사항 | multilineText (빈 문자열이면 생략) |
| industry | 홈택스 업종 | multipleSelects → `[industry]` 배열로 전송 |

### 변환 매핑

| jeeves 필드 | Airtable 필드 | 변환 규칙 |
|---|---|---|
| businessScope | 업무범위 | `기장` → `1.기장`, `신고대리` → `2.신고대리` |
| bizRegStatus | 사업자등록증 | `기존` → `기존발급`, `신규생성` → `자료요청` |

### 고정값

| Airtable 필드 | 값 | 이유 |
|---|---|---|
| 상태 | `2.계약중` | 신규 등록 시 항상 |

### 조건부 필드 (transferStatus === '이관' 일 때만)

| jeeves 필드 | Airtable 필드 | 비고 |
|---|---|---|
| transferSourceOffice | 이관사무실 | 선택 입력, 비었으면 생략 |
| transferReason | 이관사유 | 선택 입력, 비었으면 생략 |

### Airtable 전용 필드 (매핑 없음 — 공란으로 시작)

adjustmentFee(조정료) 는 `거래처` 테이블에 필드가 없음 — 매핑 대상 외. 조정료는 이미 jeeves JSON 에만 저장된다.

## 데이터 모델 변경

### 서버 types.ts 확장

```typescript
export const INDUSTRIES = [
  '건설업', '제조업', '도소매업', '음식점업',
  '부동산업', '서비스업', '정보통신업',
] as const;
export type Industry = typeof INDUSTRIES[number];

export interface NewClientInput {
  companyName: string;
  businessScope: BusinessScope;
  representative: string;
  startDate: string;
  industry: Industry;                   // text → enum 으로 변경
  bookkeepingFee: number;
  adjustmentFee: number;
  inflowRoute: InflowRoute;
  contractNote?: string;
  transferStatus: TransferStatus;
  bizRegStatus: BizRegStatus;
  transferSourceOffice?: string;        // 신규
  transferReason?: string;              // 신규
}
```

### 마이그레이션 고려

**기존 레코드 호환:** jeeves 의 스토리지 레이어는 JSON 을 타입 체크하지 않고 그대로 저장/반환한다. 따라서 기존 레코드(자유텍스트 industry, 이관 필드 없음)도 `readAll()` 에서 문제없이 읽힌다. 

**Airtable 동기화는 신규 레코드만 대상.** 기존 JSON 레코드를 Airtable 로 소급 전송하는 기능은 이번 스코프 제외.

## 환경변수

### 신규 추가

```
AIRTABLE_NEW_CLIENT_PAT=pat...         # 신규 수임처 전용 PAT
AIRTABLE_NEW_CLIENT_BASE_ID=appGLQdwsGXyeoYji
AIRTABLE_NEW_CLIENT_TABLE_NAME=거래처   # 기본값 (env 미설정 시 '거래처')
```

### 기존 (thebill-sync 용, 건드리지 않음)

```
AIRTABLE_PAT=...
AIRTABLE_BASE_ID=...
AIRTABLE_TABLE_NAME=...
AIRTABLE_KEY_FIELD=...
```

## 아키텍처

### 서버 파일 구조

```
jeeves/server/plugins/new-client/
  airtable.ts           신규 — createAirtableRecord(record, cfg, logError)
  config.ts             확장 — AIRTABLE_NEW_CLIENT_* 환경변수 로드
  routes.ts             확장 — submit 에서 Airtable 호출, 응답에 airtableSynced 추가
  types.ts              확장 — INDUSTRIES 배열, transferSourceOffice/transferReason 필드
  validate.ts           확장 — industry enum 검증, 이관 선택 필드 허용
  .env.example          확장 — 신규 env 3개 추가
```

### 클라이언트 파일 구조

```
jeeves/client/src/plugins/new-client/
  types.ts                            확장 — INDUSTRIES, transferSourceOffice/transferReason
  components/NewClientForm.tsx        수정 — industry dropdown, 이관 조건부 필드
  NewClientPage.tsx                   수정 — 상세 InfoCard 에 이관사무실/이관사유 표시
```

## 데이터 흐름

```
사용자 제출 (11~13필드)
      ↓
POST /api/new-client/submit
      ↓
validateInput (industry enum, 이관 필드 선택)
      ↓
storage.append (기존 — JSON 저장 + checklist: {})
      ↓
notifyNewClient (기존 — Slack)
      ↓
syncToAirtable (신규 — Airtable create)
   ├─ 환경변수 누락 → skip, log, return false
   ├─ 필드 매핑 → create record
   └─ 실패 → log, return false
      ↓
응답: { ok: true, id, slackNotified, airtableSynced }
```

### Airtable sync 세부 흐름

```typescript
async function syncToAirtable(
  record: NewClientRecord,
  cfg: NewClientConfig,
  logError: (msg: string) => void,
): Promise<boolean> {
  if (!cfg.airtableNewClientPat || !cfg.airtableNewClientBaseId) {
    logError('[new-client] airtable env missing — skip');
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

## API

### POST /api/new-client/submit (수정)

응답 확장:
```typescript
interface SubmitResponse {
  ok: true;
  id: string;
  slackNotified: boolean;
  airtableSynced: boolean;   // 신규
}
```

기존 엔드포인트 그대로, 응답 필드만 추가.

## UI

### 등록 폼 (NewClientForm)

#### industry 필드 변경
- `input type="text"` → `select` (7개 옵션)
- 기본값: `제조업`

#### 이관 조건부 필드
- 이관여부 = `이관` 선택 시 아래 2개 필드 나타남:
  - 이관사무실 (text input)
  - 이관사유 (textarea, 2행)
- 이관여부 = `신규` 로 전환 시: 입력값 내부 상태 유지하되 서버에 전송 안 함 (또는 아예 비움 — 구현 시 결정)

### 상세 페이지 InfoCard

기존 8필드에 2필드 추가:
- 이관사무실 (값 있을 때만 표시)
- 이관사유 (값 있을 때만 표시)

## 에러 처리

| 상황 | 서버 동작 | 클라이언트 |
|---|---|---|
| 잘못된 industry | 400 `invalid industry` | 에러 토스트 |
| AIRTABLE_NEW_CLIENT_PAT 미설정 | 200 + `airtableSynced: false` + 로그 | 경고 토스트 |
| Airtable 네트워크 실패 | 200 + `airtableSynced: false` + 로그 | 경고 토스트 |
| Airtable 필드 검증 실패 (서버 측) | 200 + `airtableSynced: false` + 로그 상세 에러 | 경고 토스트 |
| PAT 권한 부족 | 200 + `airtableSynced: false` + 로그 | 경고 토스트 |

### 동시성
- Airtable API 는 Rate Limit 있음 (5 req/s/base) — 하루 수 건 수준에서는 무관
- 중복 제출 시 Airtable 에 중복 레코드 생성 가능 (현재 scope 에서 검증 제외)

## 테스트 전략

### 수동 테스트 (golden path)

1. `jeeves/.env` 에 3개 신규 env 추가
2. 서버 재시작
3. 프론트에서 신규 등록 (업종 dropdown, 이관여부=이관 선택해 이관사무실/이관사유 채움)
4. 응답에서 `airtableSynced: true` 확인
5. Airtable `거래처` 테이블 확인 — 새 레코드, 상태=`2.계약중`, 모든 매핑 필드 올바른 값

### 수동 테스트 (에러 경로)

- PAT 삭제 후 재등록 → `airtableSynced: false`, 저장·Slack 정상
- 잘못된 BASE_ID → `airtableSynced: false`
- industry 없이 curl 직접 호출 → 400

### 호환성 테스트

- 기존 레코드 (자유텍스트 industry, 이관 필드 없음) 가 `GET /api/new-client/list` 에서 정상 조회되는지
- 기존 레코드가 상세 페이지에서 정상 렌더링되는지

## 향후 확장 (범위 제외)

- 수정/삭제 시 Airtable 역동기화
- 기존 레코드 일괄 Airtable 전송 (마이그레이션 툴)
- Airtable에서 변경된 상태를 jeeves 체크리스트로 역매핑
- Airtable 레코드 ID를 jeeves 레코드에 저장해 update 지원
