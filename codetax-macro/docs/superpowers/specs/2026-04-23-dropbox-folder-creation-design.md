# Dropbox 거래처 폴더 자동 생성 — 설계

**작성일:** 2026-04-23
**플러그인:** `new-client`
**스코프:** 신규 수임처 등록 시 Dropbox 팀 폴더에 거래처 폴더 + `1. 기초자료/` 서브폴더를 Dropbox API로 자동 생성

## 배경

현재 신규 수임처를 등록하면 Slack 알림과 Airtable 싱크는 자동으로 동작하지만, Dropbox 거래처 폴더는 직원이 수동으로 생성한다. 체크리스트에 `dropboxFolder` 항목이 있고 상태가 `binary('none' | 'done')`지만, 실제 생성 로직은 없다.

이 스펙은 Dropbox API를 사용해 거래처 폴더와 `1. 기초자료/` 서브폴더를 등록 시 자동 생성하는 기능을 정의한다. 서류 존재 여부 검증(다음 기능)은 범위 외.

## 현재 Dropbox 폴더 구조

```
세무법인의 팀 폴더/2.기장/
├── 개인/
│   ├── 신고대리/
│   │   └── 99 전태빈_50,000원 신고/
│   └── 일반기장/
│       └── 334. 메이저랩/
└── 법인/
    ├── 000 신고대리/
    │   └── 001 주식회사 아펠리온헬스케어/
    └── 096 (주)힐스타/    (법인·기장은 2.기장/법인 바로 아래 평평)
```

팀 namespace: `11439656593` (`.env: DROPBOX_TEAM_ROOT_NS_ID`)

## 경로 결정 로직

`entityType × businessScope` 2차원 매트릭스:

| entityType | businessScope | parent path |
|---|---|---|
| 개인 | 기장 | `/세무법인의 팀 폴더/2.기장/개인/일반기장` |
| 개인 | 신고대리 | `/세무법인의 팀 폴더/2.기장/개인/신고대리` |
| 법인 | 기장 | `/세무법인의 팀 폴더/2.기장/법인` |
| 법인 | 신고대리 | `/세무법인의 팀 폴더/2.기장/법인/000 신고대리` |

생성 결과:
- `<parent>/NNN. <업체명>/`
- `<parent>/NNN. <업체명>/1. 기초자료/`

## 번호 규칙

1. `/2/files/list_folder`로 parent 아래 폴더 목록 조회
2. 각 폴더명의 **선두 숫자**(정규식 `^\d+`)를 추출
3. 숫자 없는 폴더는 무시
4. max + 1, zero-padded 3자리로 포맷 (`95 → 096`, `334 → 335`)
5. 최종 폴더명: `NNN. <업체명>`

예:
- 개인/일반기장: `334. 메이저랩` 존재 → max 334 → 새 폴더 `335. <업체명>`
- 법인: `000 신고대리`, `096 (주)힐스타` → max 96 → `097. <업체명>` (`000 신고대리`는 컨테이너지만 숫자 추출되어 포함되어도 max 계산에 영향 없음)

## 데이터 모델 변경

**`NewClientInput` 확장 (client/server 동기):**
```ts
entityType: '개인' | '법인';    // NEW — 폼에 필드 추가
```

**`NewClientRecord` 확장:**
```ts
dropboxFolderPath?: string;    // NEW — 생성 성공 시 '<parent>/NNN. 업체명' 저장
```

**`dropboxFolder` 체크리스트 상태 변경 (binary → enum):**
```ts
states: ['none', 'done', 'error']
doneStates: ['done']
```
`error` 상태일 때 `ChecklistItemState.note`에 에러 메시지 저장.

## 아키텍처

### 서버 (`jeeves/server/plugins/new-client/`)

**새 파일: `dropbox.ts`** — Dropbox API wrapper
- `getAccessToken(): Promise<string>` — refresh_token으로 short-lived access token 발급 (14400초 유효, 캐싱)
- `listFolder(path): Promise<Entry[]>` — `/2/files/list_folder`, Path-Root 헤더 포함
- `createFolders(paths: string[]): Promise<void>` — `/2/files/create_folder_batch_v2`로 일괄 생성. autorename: false, 중복 시 에러.
- `resolveParentPath(entityType, businessScope): string` — 매트릭스에서 경로 반환
- `nextFolderNumber(parentPath): Promise<number>` — listFolder + 정규식 파싱 + max+1
- `createClientFolders(entityType, businessScope, companyName): Promise<{path: string}>` — 메인 진입점. 위 함수들 조합. 실패 시 throw.

**`routes.ts` 수정 — submit 핸들러 확장:**
```
Slack 알림 → Airtable 싱크 → Dropbox 폴더 생성
  성공: checklist.dropboxFolder = { status: 'done' }, record.dropboxFolderPath = path
  실패: checklist.dropboxFolder = { status: 'error', note: err.message }
  어느 쪽이든 응답 200 OK (등록은 성공)
```

**`routes.ts` 새 엔드포인트: `POST /new-client/:id/dropbox-folder/retry`**
- 레코드 읽기 → `createClientFolders` 재시도 → 성공/실패로 체크리스트 갱신 → 200 응답

**`storage.ts` 수정:** `updateRecord`에 `dropboxFolderPath` 저장 지원

**`checklist-config.ts` 수정:** `dropboxFolder` states 배열 업데이트 (위)

**`validateInput` 수정:** `entityType` enum 검증 추가

### 클라이언트 (`jeeves/client/src/plugins/new-client/`)

**`types.ts` 수정:** `EntityType`, `NewClientInput`, `NewClientRecord` 확장. CHECKLIST_ITEMS의 `dropboxFolder` states 업데이트.

**`components/NewClientForm.tsx` 수정:** `entityType` 라디오 버튼 추가 (`businessScope` 바로 옆에 배치)

**`components/ChecklistTable.tsx` 수정:**
- `dropboxFolder` 행 특별 처리: `status === 'error'`이면 빨간 badge + 에러 메시지(`note`) + **"재시도" 버튼** 표시
- 재시도 버튼 클릭 → POST retry 엔드포인트 호출 → 응답으로 체크리스트 상태 갱신

**`NewClientPage.tsx`:** `dropboxFolderPath` 있으면 InfoCard에 "Dropbox 경로" 행 추가 (선택)

### 환경 변수

`.env` (이미 설정 완료):
```
DROPBOX_APP_KEY=1bv65ghct6vmzxs
DROPBOX_APP_SECRET=<secret>
DROPBOX_REFRESH_TOKEN=<token>
DROPBOX_TEAM_ROOT_NS_ID=11439656593
```

`dropbox.ts`는 이 4개 env가 모두 있어야 동작. 없으면 시작 시 경고 로그 + Dropbox 생성 단계를 skip (등록은 정상 진행, 체크리스트는 `error`로 표시하고 note에 "DROPBOX_* env 미설정" 기록).

## 에러 처리

| 시나리오 | 동작 |
|---|---|
| refresh_token 만료/무효 | 에러 로그 + `dropboxFolder` 상태 `error` + note에 "인증 실패, 재설정 필요" |
| 네트워크 에러 | 에러 로그 + `error` 상태 + 재시도 버튼으로 회복 |
| 폴더 이미 존재 (409) | `error` 상태 + note에 "폴더가 이미 존재함" + 경로 기록. 사용자가 수동으로 매핑 확인 |
| scope 부족 (401) | `error` 상태 + note에 "권한 부족, 앱 재인증 필요" |
| entityType/businessScope 조합 잘못됨 | validateInput에서 사전 차단 (여기까지 안 옴) |

모든 에러는 등록 응답 200 OK를 막지 않음.

## 테스트

- **Unit**: `resolveParentPath` 4개 조합 / `nextFolderNumber` 빈 폴더·단일·복수·숫자없는 폴더 혼합
- **Unit**: `validateInput` `entityType` enum 검증
- **Integration**: `createClientFolders` — Dropbox API 호출 mocking (nock 또는 fetch mock)으로 성공/409/401 시나리오
- **Manual (staging)**: 실제 계정에서 test-company로 한번 만들어보고 즉시 삭제 (테스트 전용 `999. __test__` prefix 사용)

## 구현 순서 (힌트, 상세는 plan에서)

1. 서버: `entityType` 필드 추가 + validateInput 확장
2. 서버: `dropbox.ts` 모듈 (mocking으로 unit test 가능)
3. 서버: checklist state 변경 + storage 필드 추가
4. 서버: submit 핸들러 확장 + retry 엔드포인트
5. 클라이언트: `entityType` 폼 필드
6. 클라이언트: 체크리스트 error 상태 UI + 재시도 버튼
7. Integration 테스트 + staging에서 end-to-end 1회 실행

## 마이그레이션 / 하위 호환

- `entityType`은 **신규 등록 요청에만** 필수. 기존에 이미 등록된 레코드(`entityType` 없음)는 그대로 둠 — `NewClientRecord.entityType?: '개인' | '법인'`으로 optional 처리.
- 기존 `dropboxFolder` 상태가 `'done'` 또는 `'none'`인 레코드는 그대로 유지 (new `'error'` 상태는 추가만 됨, 기존 값에 영향 없음).
- 기존 레코드에 Dropbox 폴더를 나중에 만들고 싶다면 backfill은 범위 외 — 수동 또는 별도 스크립트.

## 범위 외 (향후)

- **기초자료 폴더 내 필수서류 존재 검증** — 폴더 생성이 안정화된 뒤 별도 스펙
- **기존 수임처 backfill** — 이미 등록된 거래처의 폴더 생성
- **폴더 rename / 이관** — 업체명 변경 시 Dropbox 폴더명 동기화
- **공유 설정 API** — 필요 시 특정 멤버에게 공유 자동화
