# 기장계약서 문서 생성 & 다운로드 (new-client STEP 7)

**Date**: 2026-04-25
**Scope**: jeeves/new-client 플러그인
**Goal**: Airtable 거래처 데이터와 `server/references/sheet.xlsx` 템플릿으로 기장계약서/CMS/수임동의/EDI 문서 세트를 생성해 STEP 7(기장계약서)에서 다운로드.

---

## 1. 배경

`references/sheet.xlsx`는 `입력시트` 1개 + 출력 시트 7개(`기장계약서표지`, `기장계약서 1`, `기장계약서 2`, `CMS`, `수임동의`, `국민 EDI`, `건강 EDI`)로 구성된다. 출력 시트들은 `입력시트!C3:C14`의 12개 값을 수식으로 참조해 자동 채워진다.

현재 실무자는 이 파일을 수동으로 열어 값을 입력하고 인쇄한다. 거래처 정보는 Airtable에 이미 있으므로 자동화할 수 있다.

## 2. 입력시트 매핑

| 셀 | 항목 | Airtable 소스 | 변환 |
|---|---|---|---|
| C3 | 대표자명 | `대표자` | raw |
| C4 | 개인대표자명 OR 법인명 | entityType 분기 | 법인 → `업체명`, 개인 → `대표자` |
| C5 | 예금주명 | C4와 동일 자동 유도 (법인 → `업체명`, 개인 → `대표자`) | raw |
| C6 | 주민등록번호 | `fetchRepRrn` | raw |
| C7 | 상호명 | `업체명` | raw |
| C8 | 사업자등록번호 | `사업자번호` | 하이픈 제거 |
| C9 | 법인등록번호 | `법인등록번호` | 하이픈 제거, 개인이면 공란 |
| C10 | 휴대폰번호 | `전화번호` | raw |
| C11 | 은행명 | **aux 입력** (`은행명` 신규 필드) | raw |
| C12 | 계좌번호 | **aux 입력** (`계좌번호` 신규 필드) | raw |
| C13 | 기장료 | `기장료` | raw (number) |
| C14 | 사업장소재지 | `사업장주소` | raw |

입력 C15 이하 및 열 C 이외는 템플릿 내부 주석/헬퍼로 건드리지 않는다.

## 3. 데이터 모델

### Airtable 거래처 테이블
- 신규 필드 2개: `은행명`, `계좌번호` (singleLineText).
- `개업일`은 기존 필드 그대로 활용.
- 예금주명은 C4와 동일한 자동 유도이므로 Airtable 필드 불필요.

### NewClientRecord 타입 확장
```ts
// types.ts
export interface NewClientRecord {
  // ... existing
  bankName?: string;         // 은행명
  accountNumber?: string;    // 계좌번호
}
```

### airtable.ts
- `airtableToRecord`: `은행명`/`계좌번호` 필드 읽기 추가.
- `updateAirtableAuxFields(recordId, { openDate?, bankName?, accountNumber? }, cfg, logError)` 신규 함수.

## 4. 클라이언트 UI

### 4.1 AuxInputsPanel (신규)
**위치**: [NewClientPage.tsx](jeeves/client/src/plugins/new-client/NewClientPage.tsx) 내 `ChecklistTable` 바로 위.

**필드 3개**:
- `개업연월일` (`<input type="date">`)
- `은행명` (`<input type="text">`)
- `계좌번호` (`<input type="text">`)

**동작**:
- Prefill: `record.openDate / bankName / accountNumber`.
- Save-on-blur: 값 변경 시 `PATCH /api/new-client/:id/aux` 호출.
- 상태 표시 (필드 옆 작은 라벨): 기본 hidden → "저장 중…" → "저장됨" (2초 후 fade) → 오류 시 "저장 실패, 재시도".
- 낙관적 업데이트: 로컬 state 즉시 반영, 서버 응답으로 record 갱신.

### 4.2 STEP 6 (위하고) 정리
[ChecklistItemRow.tsx:156](jeeves/client/src/plugins/new-client/components/ChecklistItemRow.tsx#L156)의 "개업 연월일" 입력 제거.
- localStorage-per-clientId 저장 로직도 제거.
- 위하고 자동 등록 호출 시 `record.openDate`를 직접 사용.

### 4.3 STEP 7 (기장계약서) 다운로드 버튼
현재 STEP 7은 `kind: 'enum'`으로 상태 셀렉터 하나. 그 옆/아래에 버튼 2개 추가:
- `엑셀 다운로드` — `GET /api/new-client/:id/contract-download?format=xlsx`
- `PDF 묶음` — `GET /api/new-client/:id/contract-download?format=pdf-zip`

**필수값 검증(클라이언트)**:
- 다음 중 하나라도 없으면 두 버튼 모두 disabled + 툴팁 "누락: 개업연월일/은행명/계좌번호/주민번호 등":
  - `openDate`, `bankName`, `accountNumber`, `대표자`, `업체명`, `사업자번호`, `전화번호`, `기장료`, `사업장주소`
  - 주민번호는 클라이언트에서 보이지 않으므로 검증 제외(서버가 판단).
- 법인이면 `법인등록번호`도 필수.

**다운로드 처리**: `fetch` → blob → `URL.createObjectURL` → `<a download>` 클릭 유도 → revoke.

## 5. 서버

### 5.1 신규 엔드포인트

#### `PATCH /api/new-client/:id/aux`
Body: `{ openDate?, bankName?, accountNumber? }`
- `airtable.ts`의 `updateAirtableAuxFields` 호출.
- 성공 시 최신 record 재조회해 응답.
- 실패 시 502 + 메시지.

#### `GET /api/new-client/:id/contract-download?format=xlsx|pdf-zip`
플로우:
1. `fetchAirtableRecord(id, cfg, logError)` → `NewClientRecord`.
2. `fetchRepRrn(id, cfg, logError)` → `string | null`.
3. 입력시트 12개 값 매핑 (§2). 누락 항목 수집 → 있으면 `400 { missing: string[] }`.
4. `references/sheet.xlsx` 로드 → 입력시트 C3..C14 write → 메모리 버퍼 or temp file.
5. 분기:
   - `xlsx`: 버퍼 그대로 응답.
     - `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
     - `Content-Disposition: attachment; filename="{업체명}_기장계약서세트.xlsx"`
   - `pdf-zip`: §5.2 참조.

### 5.2 PDF 묶음 생성

문서 묶음 4개:
- `기장계약서.pdf` ← 시트 `기장계약서표지` + `기장계약서 1` + `기장계약서 2`
- `CMS.pdf` ← 시트 `CMS`
- `수임동의.pdf` ← 시트 `수임동의`
- `EDI.pdf` ← 시트 `국민 EDI` + `건강 EDI`

각 묶음 처리:
1. §5.1에서 만든 값-주입된 workbook 버퍼 복제.
2. 입력시트는 `sheetState='hidden'`으로 변경 (수식 참조 보존, PDF 렌더 제외).
3. 해당 묶음에 속하지 않는 시트 제거.
4. temp file에 저장.
5. `soffice --headless --convert-to pdf --outdir <tmpdir> <file>` 실행 (timeout 60s).
6. 결과 PDF path 수집.

모두 완료 후:
- 4개 PDF를 zip 아카이브로 묶음 (`jszip` 사용).
- 응답:
  - `Content-Type: application/zip`
  - `Content-Disposition: attachment; filename="{업체명}_기장계약서묶음.zip"`

파일명 내 업체명은 OS/zip 안전성을 위해 `sanitize` (공백→`_`, 특수문자 제거).

### 5.3 의존성

- **`xlsx` (SheetJS)**: 이미 jeeves에 존재 → 재사용.
- **`jszip`**: 신규 추가 (archiver보다 의존성 가벼움).
- **LibreOffice `soffice`**: 시스템 설치 필요 (`brew install --cask libreoffice`). 환경변수 `NEW_CLIENT_SOFFICE_PATH`로 경로 override 가능, 기본 `soffice` (PATH 탐색).

### 5.4 에러 처리

| 상황 | 응답 |
|---|---|
| Airtable 미설정 | 500, 로그 |
| Airtable 레코드 없음 | 404 |
| 필수 입력값 누락 | 400 `{ missing: [...] }` |
| xlsx 템플릿 누락 | 500 `"템플릿 파일 없음 — server/references/sheet.xlsx"` |
| soffice 미설치 | 500 `"LibreOffice 미설치 — PDF 변환 불가. xlsx로 다운로드하세요."` |
| soffice timeout | 500 `"PDF 변환 시간 초과"` |
| 기타 | 500 + 로그 |

## 6. 디렉토리/파일 구조

### 서버
```
jeeves/server/plugins/new-client/
├── airtable.ts         (기존, aux 필드 확장)
├── contract.ts         (신규) — 입력시트 매핑, xlsx fill
├── contract-pdf.ts     (신규) — 묶음 분할 + soffice 호출 + zip
├── routes.ts           (기존, 2개 라우트 추가)
└── references/
    └── sheet.xlsx      (기존)
```

### 클라이언트
```
jeeves/client/src/plugins/new-client/
├── NewClientPage.tsx   (기존, AuxInputsPanel 렌더)
├── components/
│   ├── AuxInputsPanel.tsx    (신규)
│   ├── ChecklistItemRow.tsx  (기존, STEP 6 개업일 input 제거)
│   ├── ChecklistTable.tsx    (기존, props로 record 전달 시 STEP 7 다운로드 버튼 렌더)
│   └── ContractDownloadButtons.tsx (신규)
└── hooks/
    └── useAuxInputs.ts       (신규) — debounce + save state
```

## 7. 테스트

### 단위
- `contract.ts` `buildInputSheetValues(record, rrn)`:
  - 법인 케이스 — C4/C5 = 업체명, 법인등록번호 채움. (C5가 C4 규칙으로 자동 유도되는지 확인)
  - 개인 케이스 — C4/C5 = 대표자, C9 = 공란.
  - 하이픈 제거 검증 (123-45-67890 → 1234567890).
  - 필수값 누락 → missing 배열 반환.
- `airtable.ts` `updateAirtableAuxFields`:
  - 부분 업데이트 (openDate만 보내도 나머지 필드 건드리지 않음).

### 통합
- `contract.ts` `fillXlsx(template, values)`:
  - 실제 `references/sheet.xlsx` 로드 → 값 주입 → 재로드해 C3..C14 검증.
- `contract-pdf.ts` `splitWorkbookForBundle(wb, group)`:
  - CMS 그룹 호출 시 기장계약서/수임동의/EDI 시트가 제거되고 CMS만 남는지, 입력시트가 hidden인지.

### 수동
- 실제 거래처 1건(법인, 개인 각각)으로 xlsx 다운 → 엑셀에서 열어 출력 시트 값 정상 확인.
- PDF 묶음 다운 → 4개 PDF 개별 확인 + 수식 계산 결과 확인.

## 8. 범위 제외

- 문서 전자서명 연동.
- 출력 시트 템플릿 자체의 수식 변경.
- 파일을 Dropbox에 자동 업로드 (별도 스펙).
- 다중 거래처 일괄 생성.

## 9. 마이그레이션

- Airtable 필드 2개 수동 추가 (`은행명`, `계좌번호`) — singleLineText.
- 기존 거래처 record들은 이 필드가 빈 상태로 존재 → aux 패널에서 입력하면 저장됨.
- STEP 6 개업일 input 제거 후, 과거 localStorage 값은 첫 열람 시 무시되고 Airtable `개업일`로 대체. 마이그레이션 코드 불필요.
