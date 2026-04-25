# 더빌 CMS → 에어테이블 → 미수업체 카톡 워크플로우 설계

- 프로젝트: codetax-macro / jeeves
- 작성일: 2026-04-25
- 상태: Draft (review pending)
- 출처: Notion 스토리보드 [세금계산서 더빌CMS 과 에어테이블, 슬랙 연동하기](https://www.notion.so/33d09c2d32e580fda6e0d1c131176a0a)
- 선행: `2026-04-22-airtable-sync-design.md` (Airtable 거래처 동기화 — `appGLQdwsGXyeoYji` Base 사용)

## 목적

매월 더빌 CMS의 자동이체 출금/재출금 결과를 Airtable 수수료 테이블에 자동 반영하고, 미수 발생 거래처에 익월 10일 카카오톡으로 입금 요청 메시지를 일괄 발송한다. Notion 스토리보드의 STEP 2~4 (월 단위 반복 작업) 자동화가 범위.

> **STEP 1 (수임 시 더빌 CMS 자동이체 등록)** 은 본 스펙 범위 외 — 수임 프로세스(`new-client` 플러그인) 확장에서 별도 처리.

## 요구사항

### 기능 — STEP 2: 출금결과 에어테이블 반영 (매월 26일)

- 더빌 CMS `[자동이체] - [출금결과조회]` 메뉴에서 출금일(매월 25일, 공휴일은 직전 영업일) 결과 엑셀 다운로드
- 엑셀 파싱: 사업자번호, 상태(승인성공/실패, 출금성공/실패), 회원명, 금액
- Airtable 수수료 테이블 `[N월] 세금계산서 및 입금현황` 뷰(N = 실행 월)에서 사업자번호로 매칭
  - 더빌 상태 = 출금/승인 **성공** → Airtable `출금상태` = `출금성공`
  - 더빌 상태 = 승인실패 / 출금실패 → Airtable `출금상태` = `자동재출금`
- 매칭 실패 행은 로그에 누적, Slack 요약 알림
- 자동 cron 스케줄 (매월 26일 09:00, 26일이 공휴일이면 다음 영업일)

### 기능 — STEP 3: 재출금결과 에어테이블 반영 (매월 25일+8영업일)

- 더빌 CMS `[자동이체] - [회원상태/출금설정]` 메뉴에서 출금일 기간(26일 ~ 25일+8영업일, 공휴일 제외) 엑셀 다운로드
- 파싱/매칭은 STEP 2 와 동일
- Airtable 매핑:
  - 재출금 **성공** → `출금상태` = `출금성공`
  - 재출금 **실패** → `출금상태` = `출금실패`
- 자동 cron 스케줄 (매일 09:00 체크 → 25일+8영업일에만 실행)

### 기능 — STEP 4: 미수업체 입금요청 카톡 발송 (익월 10일)

- Airtable 수수료 테이블 `[전월] 세금계산서 및 입금현황` 뷰에서 `출금상태 = 출금실패` 행 조회
- 거래처 정보(대표자명, 카톡 발송용 이름, 기장료) 수집
- 멘트 템플릿에 변수 치환:
  - `{귀속월}` = 실행일 기준 전월 (예: 5/10 실행 → `"04"`)
  - `{금액}` = `기장료` 필드 (천단위 콤마)
- **사람 검토 필수** — UI 미리보기 화면에서 대상 리스트 + 완성된 멘트를 보여주고, 사용자가 검토 후 [발송] 버튼 클릭
- 발송 엔진: 기존 `kakao-send` 플러그인의 nut-js PC 카톡 자동화 재사용
- 발송 성공한 행 → Airtable `출금상태` = `입금요청` 자동 변경 (재발송 방지)
- 발송 실패 행은 상태 그대로, 로그/Slack 알림

### 비기능

- 기존 `thebill-sync` 플러그인 확장 (STEP 2/3) — 새 플러그인 만들지 않음
- `payment-reminder` 신규 플러그인 (STEP 4) — `kakao-send` 재사용하되 별 메뉴
- 환경변수 분리: 신규 수임 동기화 (`AIRTABLE_NEW_CLIENT_*`) 와 충돌 없도록 `AIRTABLE_FEE_*` 신규 추가
- 더빌 CMS 로그인 세션 재사용 (`logs/thebill-sync/state.json`) — 기존 패턴 그대로
- 공휴일 데이터: 외부 API 의존 없는 정적 JSON (`holidays.ts`, 1년치, 매년 수동 갱신)

### 범위 제외 (YAGNI)

- 카카오 알림톡 API 연동 (사업자 발송, 비용/템플릿 승인 필요 — 향후 검토)
- STEP 1 (수임 시 자동이체 등록) — 별도 스펙
- Airtable → 더빌 역동기화
- 거래처별 멘트 개별 커스터마이징
- 발송 후 응답 추적

## 결정 사항 (사용자 확정)

1. **플러그인 분리**: STEP 2·3 = `thebill-sync` 확장 / STEP 4 = `payment-reminder` 신규 (옵션 C 채택)
2. **매칭 키**: 사업자번호 (개인사업자=주민번호 앞6자리, 법인=사업자번호 10자리)
3. **Airtable Base/Table**: `appGLQdwsGXyeoYji` Base / `tblghdSYIU17yLg6d` (수수료) — `거래처` 동기화와 같은 Base
4. **출금상태 옵션** (single select): `출금성공` / `출금실패` / `자동재출금` / `입금요청` / `해당없음`
5. **상태 전이**:
   - STEP 2: 성공 → `출금성공`, 실패 → `자동재출금`
   - STEP 3: 성공 → `출금성공`, 실패 → `출금실패`
   - STEP 4: 발송 성공 → `입금요청`
6. **출금일 기간 입력**: 자동 계산 + 수동 오버라이드 (옵션 C)
7. **카톡 멘트 대상 월**: 실행일 기준 전월 (Airtable `[N월]` 뷰와 일치)
8. **카톡 발송 채널**: 기존 `kakao-send` nut-js 엔진 재사용 (가정, 변경 시 알려주세요)
9. **검토 흐름**: STEP 4 는 발송 전 미리보기 + 수동 [발송] 클릭 (자동 발송 금지)
10. **스케줄**: STEP 2·3 자동 cron / STEP 4 수동 트리거

## [확인 필요] 항목

> 구현 착수 전 사용자 확인이 필요한 항목. 스펙 단계에서 명시.

1. **수수료 테이블 필드명** — 실제 컬럼명 검증 필요:
   - 사업자번호 필드명 (예: `사업자번호` / `사업자등록번호`)
   - 기장료/금액 필드명
   - 거래처명 / 대표자명 필드 (멘트에 "대표님"으로 일괄 사용하지만 발송 식별용)
2. **카톡 발송용 식별자** — 수수료 테이블 또는 거래처 테이블에서 카톡 친구 매칭에 쓸 필드(이름, 전화번호 등)
   - 기존 `kakao-send` 는 카톡 PC앱 친구 검색을 사용 — 검색에 쓸 필드 확정 필요
3. **사업자번호 포맷** — 더빌 엑셀의 사업자번호 vs Airtable 의 사업자번호 포맷이 일치하는지 (하이픈 유무 등). 다르면 정규화 함수 필요
4. **더빌 CMS 셀렉터** — 첫 실행 시 실제 페이지 markup 보고 selector 확정 (Playwright 코드 placeholder 상태)
5. **계좌번호 멘트** — `카카오뱅크 / 3333367093297` 가 고정인지, 거래처별로 다른지 (일단 고정 가정)
6. **자동 스케줄 활성화 시점** — STEP 2·3 자동 cron 을 첫 배포부터 켤지, 수동 트리거로 검증 후 활성화할지 (안전을 위해 후자 추천)

## 아키텍처

### 서버 파일 구조

```
jeeves/server/plugins/
├── thebill-sync/                          [확장]
│   ├── config.ts                          AIRTABLE_FEE_* 추가
│   ├── scraper.ts                         재작성 — 모드 분리 (withdrawal | reWithdrawal)
│   ├── parser.ts                          확장 — 사업자번호/상태/금액 추출, 정규화
│   ├── airtable.ts                        재작성 — 수수료 테이블 매칭/업데이트
│   ├── pipeline.ts                        재작성 — 모드별 파이프라인
│   ├── slack.ts                           기존 (요약 알림)
│   ├── business-day.ts                    [신규] 영업일 계산
│   ├── holidays.ts                        [신규] 한국 공휴일 정적 JSON
│   └── index.ts                           2개 schedule 등록 (STEP 2 / STEP 3)
│
└── payment-reminder/                      [신규]
    ├── config.ts                          AIRTABLE_FEE_* 재사용 + 멘트 설정
    ├── airtable.ts                        대상 조회 (출금상태=출금실패) + 발송 후 입금요청 업데이트
    ├── message.ts                         멘트 템플릿 + {귀속월}/{금액} 치환
    ├── sender.ts                          ../kakao-send/sender.ts 재사용 (또는 import)
    ├── pipeline.ts                        대상 조회 → 멘트 생성 → 미리보기 응답
    ├── routes.ts                          GET /preview, POST /send
    └── index.ts
```

### 클라이언트 파일 구조

```
jeeves/client/src/plugins/
├── thebill-sync/                              [확장]
│   ├── ThebillSyncPage.tsx                    수정 — 두 모드 표시, 날짜 미리채움 input
│   └── components/
│       ├── ScheduleSettingsCard.tsx           기존
│       └── ModeRunCard.tsx                    [신규] 모드별 실행 카드
│
└── payment-reminder/                          [신규]
    ├── PaymentReminderPage.tsx                대상 미리보기 + 발송
    ├── components/
    │   ├── TargetTable.tsx                    대상 거래처 리스트
    │   └── MessagePreview.tsx                 멘트 미리보기 (행별)
    └── index.ts
```

## 환경변수

### 신규 추가

```
# Airtable 수수료 테이블 (STEP 2/3/4 공통)
AIRTABLE_FEE_PAT=pat...                       # 수수료 테이블 권한 PAT
AIRTABLE_FEE_BASE_ID=appGLQdwsGXyeoYji
AIRTABLE_FEE_TABLE_ID=tblghdSYIU17yLg6d
AIRTABLE_FEE_BIZNO_FIELD=사업자번호           # [확인필요] 실제 컬럼명
AIRTABLE_FEE_AMOUNT_FIELD=기장료              # [확인필요]
AIRTABLE_FEE_STATUS_FIELD=출금상태
AIRTABLE_FEE_NAME_FIELD=거래처명              # [확인필요] 카톡 발송 검색용

# STEP 4 멘트
PAYMENT_REMINDER_BANK_ACCOUNT=카카오뱅크 / 3333367093297
```

### 기존 (재사용)

```
THEBILL_CMS_LOGIN_URL=https://www.thebill.co.kr/main.jsp
THEBILL_CMS_USERNAME=30057194
THEBILL_CMS_PASSWORD=codetax4046
SLACK_BOT_TOKEN=
SLACK_CHANNEL=
```

## 데이터 흐름

### STEP 2 (매월 26일 09:00 자동, 영업일 보정)

```
[scheduler tick — 매월 26일]
  ↓
businessDay.adjust(today, direction='backward', target='25일') → 25일 직전 영업일
  ↓
scraper.downloadResult({ mode: 'withdrawal', from: 영업일, to: 영업일 })
  → 더빌 [자동이체] [출금결과조회] 진입
  → 출금일 기간 input 채움
  → 조회 → 엑셀다운로드
  → savePath 반환
  ↓
parser.parse(savePath) → ThebillRow[]
  // { bizNo: '1234567890' | '880101', status: '출금성공'|'승인실패'|...,
  //   memberName, amount, drawDate }
  ↓
parser.normalizeBizNo(row.bizNo) → '1234567890' (하이픈 제거 등)
  ↓
airtable.updateFeeTable(rows, mode='withdrawal')
  for each row:
    Airtable [N월] 뷰 (N=현재월) 에서 사업자번호 매칭
    if (status == 성공): 출금상태 = '출금성공'
    elif (status == 실패): 출금상태 = '자동재출금'
    if (no match): result.unmatched.push(row.bizNo)
  ↓
slack.notifySummary({
  total, success, autoRetry, unmatched, durationMs
})
```

### STEP 3 (매월 25일+8영업일 자동)

같은 흐름, 차이만 명시:

```
businessDay.addBusinessDays(25일, 8) → 종료일 산출
scraper.downloadResult({
  mode: 'reWithdrawal',
  from: 26일,
  to: 25일+8영업일,
})
  → 더빌 [자동이체] [회원상태/출금설정] 진입

airtable.updateFeeTable(rows, mode='reWithdrawal')
  if (status == 성공): 출금상태 = '출금성공'
  elif (status == 실패): 출금상태 = '출금실패'
```

### STEP 4 (수동 트리거)

```
[사용자가 PaymentReminderPage 진입]
  ↓
GET /api/payment-reminder/preview
  ↓
airtable.fetchUnpaid()
  → [전월] 뷰에서 출금상태='출금실패' 필터
  → 행 배열 + 거래처명 + 사업자번호 + 기장료
  ↓
message.buildMessages(rows, { 귀속월: '04', 계좌: env })
  → [{ recordId, name, bizNo, amount, message }]
  ↓
[프론트] 미리보기 화면 — 대상 리스트 + 멘트 표시
  사용자가 [발송] 클릭
  ↓
POST /api/payment-reminder/send
  body: { selectedRecordIds: [...] }
  ↓
sender.sendBatch(targets) — kakao-send 엔진
  for each target:
    카톡 PC앱 검색 → 메시지 입력 → 발송
    if (success):
      airtable.updateStatus(recordId, '입금요청')
      stats.success++
    else:
      stats.failed++
  ↓
slack.notifySummary(stats)
return { stats }
```

## 모듈 인터페이스

### `business-day.ts`

```typescript
export function isBusinessDay(date: Date): boolean;
export function adjustToBusinessDay(
  date: Date,
  direction: 'forward' | 'backward',
): Date;
export function addBusinessDays(date: Date, days: number): Date;
```

### `holidays.ts`

```typescript
export const KOREAN_HOLIDAYS_2026: string[]; // ['2026-01-01', ...]
export const KOREAN_HOLIDAYS_2027: string[];
export function isHoliday(date: Date): boolean;
```

### `thebill-sync/scraper.ts`

```typescript
export type ScrapeMode = 'withdrawal' | 'reWithdrawal';

export interface ScrapeOptions {
  mode: ScrapeMode;
  from: Date;
  to: Date;
}

export async function downloadResult(
  ctx: ServerContext,
  opts: ScrapeOptions,
): Promise<string>; // xlsx file path
```

### `thebill-sync/parser.ts`

```typescript
export interface ThebillRow {
  bizNo: string;        // 정규화된 사업자번호 (하이픈 제거)
  memberName: string;
  amount: number;
  status: '출금성공' | '승인실패' | '출금실패' | string; // 더빌 원본 상태
  drawDate: string;     // YYYY-MM-DD
}

export function parse(xlsxPath: string): ThebillRow[];
export function normalizeBizNo(raw: string): string;
export function classifyStatus(rawStatus: string): 'success' | 'failure';
```

### `thebill-sync/airtable.ts`

```typescript
export type UpdateMode = 'withdrawal' | 'reWithdrawal';

export interface UpdateResult {
  total: number;
  successUpdated: number;
  failureUpdated: number;
  unmatched: string[]; // 사업자번호 목록
  errors: { bizNo: string; error: string }[];
}

export async function updateFeeTable(
  rows: ThebillRow[],
  mode: UpdateMode,
  cfg: ThebillConfig,
): Promise<UpdateResult>;
```

### `payment-reminder/airtable.ts`

```typescript
export interface UnpaidRecord {
  recordId: string;
  name: string;        // 거래처명 (카톡 검색용)
  bizNo: string;
  amount: number;
}

export async function fetchUnpaid(
  yearMonth: string,    // 'YYYY-MM' (전월)
  cfg: FeeConfig,
): Promise<UnpaidRecord[]>;

export async function markAsRequested(
  recordId: string,
  cfg: FeeConfig,
): Promise<void>;
```

### `payment-reminder/message.ts`

```typescript
export interface MessageContext {
  yearMonth: string;   // 'YYYY-MM'
  bankAccount: string;
}

export function buildMessage(
  record: UnpaidRecord,
  ctx: MessageContext,
): string;
```

## API

### `GET /api/payment-reminder/preview`

```typescript
// query: ?month=2026-04  (생략 시 현재 실행 시점 기준 전월)
{
  yearMonth: string;
  targets: Array<{
    recordId: string;
    name: string;
    bizNo: string;
    amount: number;
    message: string;
  }>;
}
```

### `POST /api/payment-reminder/send`

```typescript
// body
{
  yearMonth: string;
  recordIds: string[]; // 선택된 대상
}

// response
{
  stats: {
    total: number;
    success: number;
    failed: number;
    skipped: number;
  };
  errors: { recordId: string; error: string }[];
}
```

### 기존 `/api/scheduler/thebill-sync/*` (재사용)

- 모드별 trigger: `POST /api/scheduler/thebill-sync/run` body `{ mode: 'withdrawal' | 'reWithdrawal', from?, to? }`

## 멘트 템플릿

```
안녕하세요 대표님.
{귀속월}월 기장료 {금액}원(부가세포함)이 잔액부족으로 출금이 실패된 것으로 확인됩니다.
아래 계좌로 입금 후 말씀한번 부탁드립니다.
{계좌번호}

CMS 자동이체 계좌 변경이나 별도 협의가 필요하신 경우, 편하게 연락 주시면 빠르게 도와드리겠습니다.
감사합니다.
```

치환 규칙:
- `{귀속월}` = 실행일 기준 전월 두자리 (예: `04`)
- `{금액}` = `Intl.NumberFormat('ko-KR').format(amount)` (예: `110,000`)
- `{계좌번호}` = `PAYMENT_REMINDER_BANK_ACCOUNT` env

## UI 화면

### `ThebillSyncPage` (확장)

기존 페이지 레이아웃 유지하되, 실행 카드를 **두 모드**로 분리:

```
📊 더빌 CMS → 에어테이블 동기화

[모드 1: 출금결과 반영 (매월 26일)]
  출금일 (자동 계산):  [2026-04-25] (수정 가능)
  [실행]  [스케줄 설정]

[모드 2: 재출금결과 반영 (매월 25+8영업일)]
  기간 (자동 계산):  [2026-04-26] ~ [2026-05-08]
  [실행]  [스케줄 설정]

최근 실행 이력 (테이블, 모드 컬럼 포함)
실시간 로그
```

### `PaymentReminderPage` (신규)

```
💬 미수업체 입금요청 카톡

대상 월: [2026-04 ▼]  [미리보기 새로고침]

대상 거래처 (3건):
☑ ABC세무 / 1234567890 / 110,000원
☑ XYZ상사 / 9876543210 /  88,000원
☐ 김대표 / 880101  / 132,000원   ← 사용자가 선택 해제 가능

[멘트 미리보기 — 첫 거래처 기준]
  안녕하세요 대표님.
  04월 기장료 110,000원(부가세포함)이 ...

[발송 (선택 2건)]
```

## 에러 처리

| 상황 | 동작 |
|---|---|
| 더빌 로그인 실패 | Slack 알림, 작업 중단 (기존 동일) |
| 엑셀 다운로드 실패 (셀렉터 변경 등) | Slack 알림, 작업 중단 |
| 엑셀 파싱 실패 | Slack 알림, 작업 중단 |
| Airtable 매칭 실패 (사업자번호 미존재) | 행별 누적, Slack 요약에 unmatched 목록 포함 |
| Airtable update 실패 | 행별 에러 누적, 다른 행은 계속 진행 |
| 카톡 발송 실패 (특정 거래처) | 로그/Slack, Airtable 상태 업데이트 안 함 (재시도 가능 상태 유지) |
| 카톡 PC앱 미실행 / 친구 검색 실패 | sender 가 throw → Slack 알림, 사용자 수동 처리 |
| AIRTABLE_FEE_PAT 미설정 | 시작 시 ThebillConfigError 로 fail-fast |

### 동시성

- Airtable Rate Limit 5 req/s/base — 거래처 수십 건 수준에서는 무관
- 카톡 발송은 nut-js 특성상 순차 — 기존 `kakao-send` 의 sleep/retry 패턴 그대로

### 재실행 안전성 (idempotency)

- STEP 2/3 은 같은 상태 값을 다시 쓰는 것이므로 재실행 안전
- STEP 4 는 발송 후 `입금요청` 으로 바뀌므로 자연 멱등 (재실행 시 대상 0건)

## 테스트 전략

### 단위 테스트 (vitest)

- `business-day.test.ts` — 평일/공휴일/주말 케이스, addBusinessDays 양수/음수
- `parser.test.ts` — 더빌 엑셀 샘플 파일로 정상 파싱, 사업자번호 정규화, 상태 분류
- `message.test.ts` — 멘트 변수 치환, 금액 포맷

### 통합 테스트 (수동 — golden path)

1. 더빌 CMS 테스트 계정으로 로그인 → 엑셀 다운로드 (셀렉터 검증)
2. 다운로드된 엑셀로 `parser.parse` → row 구조 확인
3. Airtable 테스트 환경에서 `updateFeeTable` 실행 → 상태 변경 확인
4. STEP 4: preview API → UI 검토 → send API → Airtable 상태 변경 + Slack 알림 확인

### 에러 경로 (수동)

- `AIRTABLE_FEE_PAT` 삭제 → 명확한 에러 메시지
- 사업자번호 매칭 실패 행 → unmatched 목록에 포함
- 카톡 PC앱 종료 상태에서 발송 → 명확한 에러

## 마이그레이션

### 기존 `thebill-sync` 영향

- 기존 placeholder 코드 (downloadResult 의 TODO 주석들) 모두 교체
- 기존 schedule 설정 (`defaultCron: '0 8 * * *'`) → 두 개로 분리
- 기존 환경변수 (`AIRTABLE_PAT`, `AIRTABLE_BASE_ID`, ...) 는 유지하되 신규 `AIRTABLE_FEE_*` 추가
- 기존 실행 이력은 그대로 보존 (LogEntry 형식 동일)

### 점진 활성화 (recommended)

1. 코드 배포 + 환경변수 설정
2. 자동 schedule 은 OFF 로 시작
3. 수동 트리거 (mode=withdrawal) 로 STEP 2 검증 → 결과 확인
4. STEP 3 검증 → 결과 확인
5. STEP 4 미리보기로 대상 검증 → 1~2건 발송 테스트
6. 안정화 후 자동 schedule ON

## 향후 확장 (범위 제외)

- 카카오 알림톡 API 마이그레이션 (사업자 발송, 비용 발생)
- 발송 응답 추적 (입금 확인 → 자동 출금성공 변경)
- 거래처별 멘트 커스터마이징
- STEP 1 자동이체 등록 (수임 프로세스 통합)
- 더빌 CMS 정기 스크래핑 → 자동이체 등록 현황 모니터링
