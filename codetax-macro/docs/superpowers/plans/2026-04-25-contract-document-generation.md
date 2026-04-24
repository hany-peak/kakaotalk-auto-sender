# 기장계약서 문서 생성 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Airtable 거래처 데이터로 `references/sheet.xlsx`를 채워 STEP 7에서 xlsx 또는 PDF 묶음으로 다운로드.

**Architecture:** Aux 입력 패널(체크리스트 위)로 `개업연월일/은행명/계좌번호`를 Airtable write-back. 서버는 xlsx 템플릿 로드 → `입력시트!C3:C14` 주입 → xlsx 직접 반환 또는 4개 묶음으로 분할 후 LibreOffice(`soffice`)로 PDF 변환 → zip.

**Tech Stack:** Node.js + Express 서버, React 클라이언트. 기존 라이브러리 `xlsx`(SheetJS) 재사용. 신규 `jszip`. 시스템 `soffice` 호출. 테스트 러너 `node:test`.

---

## File Structure

### Server (jeeves/server/plugins/new-client/)
- **Modify** `types.ts` — `NewClientRecord`에 `bankName?`, `accountNumber?` 추가
- **Modify** `airtable.ts` — `airtableToRecord`에서 `은행명`/`계좌번호` 읽기, `updateAirtableAuxFields()` 신규
- **Create** `contract.ts` — 입력시트 매핑(`buildInputSheetValues`), 검증(`missingRequired`), xlsx 주입(`fillXlsx`)
- **Create** `contract-pdf.ts` — 묶음 분할(`splitForBundle`), soffice 변환(`renderPdf`), zip(`zipFiles`)
- **Create** `contract.test.ts` — 단위 테스트 (매핑/검증)
- **Create** `contract-pdf.test.ts` — 단위 테스트 (분할 로직)
- **Modify** `routes.ts` — `PATCH /api/new-client/:id/aux`, `GET /api/new-client/:id/contract-download`
- **Modify** `jeeves/package.json` — `jszip` 추가

### Client (jeeves/client/src/plugins/new-client/)
- **Modify** `types.ts` — `NewClientRecord`에 `bankName?`, `accountNumber?` 추가
- **Create** `hooks/useAuxInputs.ts` — 저장 상태 + debounce
- **Create** `components/AuxInputsPanel.tsx` — 3개 입력 필드
- **Create** `components/ContractDownloadButtons.tsx` — xlsx/pdf-zip 버튼
- **Modify** `components/ChecklistItemRow.tsx` — STEP 6 openDate 입력/localStorage 제거, STEP 7 행에 `ContractDownloadButtons` 렌더
- **Modify** `components/ChecklistTable.tsx` — `record` prop 추가 (행에 전달)
- **Modify** `NewClientPage.tsx` — 상세 뷰에서 `AuxInputsPanel` 렌더

---

## Task 1: Server — NewClientRecord에 bankName/accountNumber 추가

**Files:**
- Modify: `jeeves/server/plugins/new-client/types.ts:90-96`

- [ ] **Step 1: NewClientRecord 타입 확장**

[types.ts:90-96](jeeves/server/plugins/new-client/types.ts#L90) 기존 "WEHAGO 수임처 신규생성에 사용" 주석 블록에 두 필드 추가:

```ts
  // 추가 필드 — Airtable 에서만 존재, WEHAGO 수임처 신규생성에 사용.
  bizRegNumber?: string;   // 사업자등록번호
  openDate?: string;       // 개업일 (YYYY-MM-DD)
  corpRegNumber?: string;  // 법인등록번호 (법인만)
  bizAddress?: string;     // 사업장주소
  bizPhone?: string;       // 사업장전화번호
  bankName?: string;       // 은행명 (CMS/기장계약서용)
  accountNumber?: string;  // 계좌번호 (CMS/기장계약서용)
```

- [ ] **Step 2: TypeScript 컴파일 확인**

Run: `cd jeeves && npx tsc --noEmit -p server/tsconfig.json 2>&1 | head -20`
Expected: 에러 없음 (또는 기존 에러와 동일)

- [ ] **Step 3: 커밋**

```bash
git add jeeves/server/plugins/new-client/types.ts
git commit -m "feat(new-client): add bankName/accountNumber to NewClientRecord"
```

---

## Task 2: Server — airtable.ts가 은행명/계좌번호 읽기

**Files:**
- Modify: `jeeves/server/plugins/new-client/airtable.ts` (`airtableToRecord` 함수, 약 379줄)

- [ ] **Step 1: airtableToRecord에서 신규 필드 읽기 추가**

[airtable.ts:389-410](jeeves/server/plugins/new-client/airtable.ts#L389)의 `return {` 블록에 2줄 추가:

```ts
    bizAddress: optionalString(fields['사업장주소']),
    bizPhone: optionalString(fields['전화번호']),
    bankName: optionalString(fields['은행명']),
    accountNumber: optionalString(fields['계좌번호']),
    checklist: airtableToChecklist(fields, createdAt),
```

- [ ] **Step 2: TypeScript 컴파일 확인**

Run: `cd jeeves && npx tsc --noEmit -p server/tsconfig.json`
Expected: 에러 없음

- [ ] **Step 3: 커밋**

```bash
git add jeeves/server/plugins/new-client/airtable.ts
git commit -m "feat(new-client): read 은행명/계좌번호 from Airtable"
```

---

## Task 3: Server — updateAirtableAuxFields 함수

**Files:**
- Modify: `jeeves/server/plugins/new-client/airtable.ts` (끝에 함수 추가)

- [ ] **Step 1: airtable.ts 끝에 updateAirtableAuxFields 추가**

```ts
/**
 * Airtable 거래처 레코드의 개업일/은행명/계좌번호를 부분 업데이트한다.
 * `undefined` 필드는 전송하지 않음 (기존 Airtable 값 유지). 빈 문자열은
 * null 로 보내 Airtable 측 값 클리어.
 * 실패 시 false.
 */
export async function updateAirtableAuxFields(
  airtableRecordId: string,
  patch: { openDate?: string; bankName?: string; accountNumber?: string },
  cfg: NewClientConfig,
  logError: (msg: string) => void,
): Promise<boolean> {
  if (!cfg.airtableNewClientPat || !cfg.airtableNewClientBaseId) {
    logError('[new-client] airtable env missing — skip aux update');
    return false;
  }

  const fields: Record<string, unknown> = {};
  if (patch.openDate !== undefined) {
    fields['개업일'] = patch.openDate.trim() === '' ? null : patch.openDate;
  }
  if (patch.bankName !== undefined) {
    fields['은행명'] = patch.bankName.trim() === '' ? null : patch.bankName;
  }
  if (patch.accountNumber !== undefined) {
    fields['계좌번호'] = patch.accountNumber.trim() === '' ? null : patch.accountNumber;
  }
  if (Object.keys(fields).length === 0) return true;

  try {
    const base = new Airtable({ apiKey: cfg.airtableNewClientPat }).base(cfg.airtableNewClientBaseId);
    await base(cfg.airtableNewClientTableName).update([
      { id: airtableRecordId, fields: fields as FieldSet },
    ]);
    return true;
  } catch (err: any) {
    logError(`[new-client] airtable aux update failed: ${err.message || err}`);
    return false;
  }
}
```

- [ ] **Step 2: 컴파일 확인**

Run: `cd jeeves && npx tsc --noEmit -p server/tsconfig.json`
Expected: 에러 없음

- [ ] **Step 3: 커밋**

```bash
git add jeeves/server/plugins/new-client/airtable.ts
git commit -m "feat(new-client): add updateAirtableAuxFields"
```

---

## Task 4: Server — contract.ts 입력시트 매핑 (TDD)

**Files:**
- Create: `jeeves/server/plugins/new-client/contract.ts`
- Create: `jeeves/server/plugins/new-client/contract.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

`jeeves/server/plugins/new-client/contract.test.ts` 신규:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildInputSheetValues, missingRequired } from './contract';
import type { NewClientRecord } from './types';

const baseIndividual: NewClientRecord = {
  id: 'rec1',
  airtableRecordId: 'rec1',
  createdAt: '2026-04-25',
  companyName: '홍길동상점',
  representative: '홍길동',
  startDate: '2026-04-01',
  businessScope: '기장',
  entityType: '개인',
  checklist: {},
  bizRegNumber: '123-45-67890',
  openDate: '2020-01-15',
  bizAddress: '서울시 강남구',
  bizPhone: '010-1234-5678',
  bankName: '국민은행',
  accountNumber: '123-456-789',
  bookkeepingFee: 100000,
};

test('buildInputSheetValues: 개인 케이스 — C4/C5는 대표자명, C9는 공란', () => {
  const v = buildInputSheetValues(baseIndividual, '900101-1234567');
  assert.equal(v.C3, '홍길동');
  assert.equal(v.C4, '홍길동');
  assert.equal(v.C5, '홍길동');
  assert.equal(v.C6, '900101-1234567');
  assert.equal(v.C7, '홍길동상점');
  assert.equal(v.C8, '1234567890'); // 하이픈 제거
  assert.equal(v.C9, ''); // 개인 → 공란
  assert.equal(v.C10, '010-1234-5678');
  assert.equal(v.C11, '국민은행');
  assert.equal(v.C12, '123-456-789');
  assert.equal(v.C13, 100000);
  assert.equal(v.C14, '서울시 강남구');
});

test('buildInputSheetValues: 법인 — C4/C5 업체명, C9 법인등록번호', () => {
  const corp: NewClientRecord = {
    ...baseIndividual,
    entityType: '법인',
    companyName: '(주)길동',
    corpRegNumber: '110111-1234567',
  };
  const v = buildInputSheetValues(corp, '900101-1234567');
  assert.equal(v.C4, '(주)길동');
  assert.equal(v.C5, '(주)길동');
  assert.equal(v.C9, '1101111234567');
});

test('missingRequired: 모든 필수값 있으면 빈 배열', () => {
  assert.deepEqual(missingRequired(baseIndividual, '900101-1234567'), []);
});

test('missingRequired: openDate/bankName/accountNumber 누락 보고', () => {
  const rec = { ...baseIndividual, openDate: undefined, bankName: undefined, accountNumber: '' };
  const missing = missingRequired(rec, '900101-1234567');
  assert.ok(missing.includes('개업일'));
  assert.ok(missing.includes('은행명'));
  assert.ok(missing.includes('계좌번호'));
});

test('missingRequired: 법인 + 법인등록번호 누락', () => {
  const rec: NewClientRecord = {
    ...baseIndividual, entityType: '법인', corpRegNumber: undefined,
  };
  const missing = missingRequired(rec, '900101-1234567');
  assert.ok(missing.includes('법인등록번호'));
});

test('missingRequired: 주민번호 null 누락', () => {
  assert.ok(missingRequired(baseIndividual, null).includes('대표자주민번호'));
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd jeeves && node --test --import tsx server/plugins/new-client/contract.test.ts`
Expected: FAIL — `contract` 모듈 없음.

- [ ] **Step 3: contract.ts 최소 구현**

`jeeves/server/plugins/new-client/contract.ts` 신규:

```ts
import type { NewClientRecord } from './types';

export interface InputSheetValues {
  C3: string;  C4: string;  C5: string;  C6: string;
  C7: string;  C8: string;  C9: string;  C10: string;
  C11: string; C12: string; C13: number | string; C14: string;
}

function stripHyphens(s: string | undefined): string {
  return (s ?? '').replace(/-/g, '');
}

/** 법인이면 업체명, 개인이면 대표자명. (입력시트 C4/C5 공통 규칙) */
function corpOrIndividualName(r: NewClientRecord): string {
  return r.entityType === '법인' ? r.companyName : r.representative;
}

export function buildInputSheetValues(
  record: NewClientRecord,
  rrn: string | null,
): InputSheetValues {
  const nameC4 = corpOrIndividualName(record);
  return {
    C3: record.representative ?? '',
    C4: nameC4,
    C5: nameC4,
    C6: rrn ?? '',
    C7: record.companyName ?? '',
    C8: stripHyphens(record.bizRegNumber),
    C9: record.entityType === '법인' ? stripHyphens(record.corpRegNumber) : '',
    C10: record.bizPhone ?? '',
    C11: record.bankName ?? '',
    C12: record.accountNumber ?? '',
    C13: record.bookkeepingFee ?? '',
    C14: record.bizAddress ?? '',
  };
}

function isBlank(v: unknown): boolean {
  if (v === undefined || v === null) return true;
  if (typeof v === 'string' && v.trim() === '') return true;
  return false;
}

/**
 * 입력시트에 들어갈 필수값 중 누락된 항목의 한국어 레이블 배열 반환.
 * 법인이면 법인등록번호도 필수.
 */
export function missingRequired(record: NewClientRecord, rrn: string | null): string[] {
  const missing: string[] = [];
  if (isBlank(record.representative)) missing.push('대표자');
  if (isBlank(record.companyName)) missing.push('업체명');
  if (isBlank(record.bizRegNumber)) missing.push('사업자번호');
  if (isBlank(record.bizPhone)) missing.push('전화번호');
  if (isBlank(record.bizAddress)) missing.push('사업장주소');
  if (isBlank(record.bookkeepingFee)) missing.push('기장료');
  if (isBlank(record.openDate)) missing.push('개업일');
  if (isBlank(record.bankName)) missing.push('은행명');
  if (isBlank(record.accountNumber)) missing.push('계좌번호');
  if (isBlank(rrn)) missing.push('대표자주민번호');
  if (record.entityType === '법인' && isBlank(record.corpRegNumber)) {
    missing.push('법인등록번호');
  }
  return missing;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd jeeves && node --test --import tsx server/plugins/new-client/contract.test.ts`
Expected: 모든 테스트 PASS.

- [ ] **Step 5: 커밋**

```bash
git add jeeves/server/plugins/new-client/contract.ts jeeves/server/plugins/new-client/contract.test.ts
git commit -m "feat(new-client): contract input sheet mapping + validation"
```

---

## Task 5: Server — contract.ts xlsx 템플릿 주입

**Files:**
- Modify: `jeeves/server/plugins/new-client/contract.ts`

- [ ] **Step 1: fillXlsx 함수 추가**

[contract.ts](jeeves/server/plugins/new-client/contract.ts) 끝에 추가:

```ts
import * as XLSX from 'xlsx';
import { readFile } from 'node:fs/promises';
import * as path from 'node:path';

const TEMPLATE_PATH = path.join(__dirname, 'references', 'sheet.xlsx');
const INPUT_SHEET_NAME = '입력시트';

/**
 * 템플릿 xlsx를 로드해 입력시트 C3..C14 셀을 주입한다.
 * 수식 재계산은 LibreOffice/Excel이 파일을 열 때 처리하므로
 * 여기서는 값만 쓰고 저장한다.
 *
 * @returns 주입된 workbook의 Buffer
 */
export async function fillXlsx(values: InputSheetValues): Promise<Buffer> {
  const raw = await readFile(TEMPLATE_PATH);
  const wb = XLSX.read(raw, { type: 'buffer', cellStyles: true, bookVBA: true });
  const ws = wb.Sheets[INPUT_SHEET_NAME];
  if (!ws) throw new Error(`template missing sheet: ${INPUT_SHEET_NAME}`);

  const cellWrites: Array<[string, unknown]> = [
    ['C3', values.C3], ['C4', values.C4], ['C5', values.C5], ['C6', values.C6],
    ['C7', values.C7], ['C8', values.C8], ['C9', values.C9], ['C10', values.C10],
    ['C11', values.C11], ['C12', values.C12], ['C13', values.C13], ['C14', values.C14],
  ];
  for (const [addr, v] of cellWrites) {
    const t = typeof v === 'number' ? 'n' : 's';
    ws[addr] = { t, v };
  }

  // 계산된 수식 값이 캐시로 들어가 있으면 LibreOffice 가 재계산해도 문제는
  // 없으나, 입력시트 값이 바뀐 것을 확실히 하기 위해 wb에 calcPr를 남기지
  // 않는 것은 xlsx lib 책임. 여기서는 그냥 Buffer로 반환.
  const out = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx', cellStyles: true });
  return out as Buffer;
}
```

- [ ] **Step 2: 통합 테스트 추가**

`contract.test.ts` 끝에 추가:

```ts
import { fillXlsx } from './contract';
import * as XLSX from 'xlsx';

test('fillXlsx: 주입된 xlsx의 입력시트 C3/C7/C13이 값으로 설정됨', async () => {
  const values = buildInputSheetValues(baseIndividual, '900101-1234567');
  const buf = await fillXlsx(values);
  assert.ok(buf.length > 10000, 'xlsx buffer should be non-trivial size');
  const wb = XLSX.read(buf, { type: 'buffer' });
  const ws = wb.Sheets['입력시트'];
  assert.equal(ws['C3']?.v, '홍길동');
  assert.equal(ws['C7']?.v, '홍길동상점');
  assert.equal(ws['C13']?.v, 100000);
});
```

- [ ] **Step 3: 테스트 통과 확인**

Run: `cd jeeves && node --test --import tsx server/plugins/new-client/contract.test.ts`
Expected: 모든 테스트 PASS.

- [ ] **Step 4: 커밋**

```bash
git add jeeves/server/plugins/new-client/contract.ts jeeves/server/plugins/new-client/contract.test.ts
git commit -m "feat(new-client): fill xlsx template from input sheet values"
```

---

## Task 6: Server — contract-pdf.ts 묶음 분할 (TDD)

**Files:**
- Create: `jeeves/server/plugins/new-client/contract-pdf.ts`
- Create: `jeeves/server/plugins/new-client/contract-pdf.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

`jeeves/server/plugins/new-client/contract-pdf.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import { readFile } from 'node:fs/promises';
import * as path from 'node:path';
import { BUNDLE_GROUPS, splitForBundle } from './contract-pdf';

const TEMPLATE = path.join(__dirname, 'references', 'sheet.xlsx');

test('BUNDLE_GROUPS 정의: 4개 묶음, 시트명은 템플릿과 일치', async () => {
  const raw = await readFile(TEMPLATE);
  const wb = XLSX.read(raw, { type: 'buffer' });
  const templateSheets = new Set(wb.SheetNames);
  assert.equal(BUNDLE_GROUPS.length, 4);
  for (const group of BUNDLE_GROUPS) {
    for (const s of group.sheets) {
      assert.ok(templateSheets.has(s), `sheet "${s}" not in template`);
    }
  }
});

test('splitForBundle: CMS 그룹 → 입력시트는 hidden, CMS만 visible', async () => {
  const raw = await readFile(TEMPLATE);
  const wb = XLSX.read(raw, { type: 'buffer' });
  const cms = BUNDLE_GROUPS.find((g) => g.id === 'cms')!;
  const out = splitForBundle(wb, cms);
  assert.deepEqual(out.SheetNames, ['입력시트', 'CMS ']);
  // 입력시트는 hidden (1=hidden in xlsx)
  const wsView = (out.Workbook?.Sheets ?? []).find((s) => s.name === '입력시트');
  assert.equal(wsView?.Hidden, 1);
});

test('splitForBundle: 기장계약서 그룹 → 입력시트 + 표지/1/2 유지', async () => {
  const raw = await readFile(TEMPLATE);
  const wb = XLSX.read(raw, { type: 'buffer' });
  const contract = BUNDLE_GROUPS.find((g) => g.id === 'contract')!;
  const out = splitForBundle(wb, contract);
  assert.deepEqual(
    out.SheetNames,
    ['입력시트', '기장계약서표지 ', '기장계약서 1 ', '기장계약서 2 '],
  );
});
```

> **Note:** 템플릿 시트명 끝의 공백은 `sheet.xlsx`의 실제 이름에 맞춰야 함. 실행 전 `node -e "const X=require('xlsx');const wb=X.readFile('jeeves/server/plugins/new-client/references/sheet.xlsx');console.log(wb.SheetNames)"` 로 확인. 테스트 셋업 시 필요하면 위 기대값 수정.

- [ ] **Step 2: 실패 확인**

Run: `cd jeeves && node --test --import tsx server/plugins/new-client/contract-pdf.test.ts`
Expected: FAIL — `contract-pdf` 모듈 없음.

- [ ] **Step 3: contract-pdf.ts 최소 구현**

```ts
import * as XLSX from 'xlsx';

export interface BundleGroup {
  id: 'contract' | 'cms' | 'consent' | 'edi';
  filename: string;        // 업체명 제외 base, e.g. "기장계약서"
  sheets: string[];        // 이 묶음에 포함할 출력 시트명 (입력시트 제외)
}

export const BUNDLE_GROUPS: BundleGroup[] = [
  { id: 'contract', filename: '기장계약서',
    sheets: ['기장계약서표지 ', '기장계약서 1 ', '기장계약서 2 '] },
  { id: 'cms', filename: 'CMS', sheets: ['CMS '] },
  { id: 'consent', filename: '수임동의', sheets: ['수임동의'] },
  { id: 'edi', filename: 'EDI', sheets: ['국민 EDI', '건강 EDI '] },
];

const INPUT_SHEET = '입력시트';

/**
 * workbook의 얕은 복제본을 만들어 해당 그룹에 속하지 않는 시트를 제거하고,
 * 입력시트는 hidden 상태로 전환한다 (수식 참조를 위해 존재는 유지).
 */
export function splitForBundle(wb: XLSX.WorkBook, group: BundleGroup): XLSX.WorkBook {
  const keep = new Set<string>([INPUT_SHEET, ...group.sheets]);
  const out: XLSX.WorkBook = {
    ...wb,
    SheetNames: wb.SheetNames.filter((n) => keep.has(n)),
    Sheets: Object.fromEntries(
      Object.entries(wb.Sheets).filter(([n]) => keep.has(n)),
    ),
    Workbook: wb.Workbook
      ? {
          ...wb.Workbook,
          Sheets: (wb.Workbook.Sheets ?? [])
            .filter((s) => keep.has(s.name))
            .map((s) => (s.name === INPUT_SHEET ? { ...s, Hidden: 1 as 0 | 1 | 2 } : s)),
        }
      : { Sheets: [{ name: INPUT_SHEET, Hidden: 1 as const }] },
  };
  return out;
}
```

- [ ] **Step 4: 시트명 공백 확인 후 테스트 실행**

Run:
```bash
cd jeeves && node -e "const X=require('xlsx');const wb=X.readFile('server/plugins/new-client/references/sheet.xlsx');console.log(JSON.stringify(wb.SheetNames))"
```

출력된 시트명과 `BUNDLE_GROUPS` 및 테스트 기대값의 공백이 정확히 일치하는지 확인. 불일치 시 코드/테스트 수정.

Run: `cd jeeves && node --test --import tsx server/plugins/new-client/contract-pdf.test.ts`
Expected: 모든 테스트 PASS.

- [ ] **Step 5: 커밋**

```bash
git add jeeves/server/plugins/new-client/contract-pdf.ts jeeves/server/plugins/new-client/contract-pdf.test.ts
git commit -m "feat(new-client): split workbook per PDF bundle group"
```

---

## Task 7: Server — contract-pdf.ts soffice 변환 + zip

**Files:**
- Modify: `jeeves/server/plugins/new-client/contract-pdf.ts`
- Modify: `jeeves/package.json` (jszip 추가)

- [ ] **Step 1: jszip 추가**

Run:
```bash
cd jeeves && npm install jszip
```

Expected: `package.json`에 `jszip` 추가, `node_modules/jszip` 생성.

- [ ] **Step 2: soffice 경로 해결 + 변환 함수 추가**

[contract-pdf.ts](jeeves/server/plugins/new-client/contract-pdf.ts) 끝에 추가:

```ts
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import JSZip from 'jszip';

export function resolveSofficePath(): string {
  const env = process.env.NEW_CLIENT_SOFFICE_PATH;
  if (env && env.trim() !== '') return env;
  // macOS 기본 경로 fallback
  const mac = '/Applications/LibreOffice.app/Contents/MacOS/soffice';
  // existsSync 는 동기, import 없이 require로 해결 회피 — 단순 문자열 반환
  return mac;
}

/**
 * workbook을 임시 xlsx로 저장하고 soffice 로 PDF 변환 → Buffer 반환.
 * 실패 시 throw. soffice 미설치/timeout 도 throw.
 */
export async function renderPdf(
  wb: XLSX.WorkBook,
  baseName: string,
  timeoutMs = 60_000,
): Promise<Buffer> {
  const dir = await mkdtemp(path.join(tmpdir(), 'jeeves-contract-'));
  try {
    const xlsxPath = path.join(dir, `${baseName}.xlsx`);
    const xlsxBuf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx', cellStyles: true }) as Buffer;
    await writeFile(xlsxPath, xlsxBuf);

    await new Promise<void>((resolve, reject) => {
      const proc = spawn(
        resolveSofficePath(),
        ['--headless', '--convert-to', 'pdf', '--outdir', dir, xlsxPath],
        { stdio: ['ignore', 'pipe', 'pipe'] },
      );
      let stderr = '';
      proc.stderr.on('data', (d) => { stderr += d.toString(); });
      const timer = setTimeout(() => {
        proc.kill('SIGKILL');
        reject(new Error(`soffice timeout after ${timeoutMs}ms`));
      }, timeoutMs);
      proc.on('error', (err) => {
        clearTimeout(timer);
        reject(new Error(`soffice spawn failed: ${err.message} (경로: ${resolveSofficePath()})`));
      });
      proc.on('exit', (code) => {
        clearTimeout(timer);
        if (code === 0) resolve();
        else reject(new Error(`soffice exit ${code}: ${stderr.slice(0, 500)}`));
      });
    });

    const pdfPath = path.join(dir, `${baseName}.pdf`);
    return await readFile(pdfPath);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** 파일명을 OS/zip-safe 하게 정리. 공백→`_`, 특수문자 일부 제거. */
export function sanitizeFilename(s: string): string {
  return s.replace(/\s+/g, '_').replace(/[\/\\:*?"<>|]/g, '');
}

/**
 * 이름→Buffer 매핑을 zip으로 압축해 Buffer 반환.
 */
export async function zipFiles(files: Array<{ name: string; data: Buffer }>): Promise<Buffer> {
  const zip = new JSZip();
  for (const f of files) zip.file(f.name, f.data);
  return await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}
```

- [ ] **Step 3: 단위 테스트 — sanitizeFilename만 (soffice는 통합에서)**

`contract-pdf.test.ts` 끝에 추가:

```ts
import { sanitizeFilename } from './contract-pdf';

test('sanitizeFilename: 공백→_, 특수문자 제거', () => {
  assert.equal(sanitizeFilename('(주) 길동/상점'), '(주)_길동상점');
});
```

Run: `cd jeeves && node --test --import tsx server/plugins/new-client/contract-pdf.test.ts`
Expected: PASS.

- [ ] **Step 4: 커밋**

```bash
git add jeeves/server/plugins/new-client/contract-pdf.ts jeeves/server/plugins/new-client/contract-pdf.test.ts jeeves/package.json jeeves/package-lock.json
git commit -m "feat(new-client): PDF render via soffice + zip bundle"
```

---

## Task 8: Server — 라우트 추가

**Files:**
- Modify: `jeeves/server/plugins/new-client/routes.ts`

- [ ] **Step 1: import 확장**

[routes.ts](jeeves/server/plugins/new-client/routes.ts) 상단의 기존 airtable import 블록에 추가:

```ts
import {
  syncToAirtable,
  updateAirtableChecklist,
  pullFromAirtable,
  fetchViewList,
  fetchAirtableRecord,
  fetchRepRrn,
  isAirtableId,
  updateAirtableAuxFields,
} from './airtable';
import { buildInputSheetValues, missingRequired, fillXlsx } from './contract';
import { BUNDLE_GROUPS, splitForBundle, renderPdf, sanitizeFilename, zipFiles } from './contract-pdf';
import * as XLSX from 'xlsx';
```

- [ ] **Step 2: PATCH /aux 라우트 추가**

[routes.ts](jeeves/server/plugins/new-client/routes.ts) 내 `registerNewClientRoutes` 함수 끝(마지막 라우트 뒤)에 추가:

```ts
  app.patch('/api/new-client/:id/aux', async (req, res) => {
    const id = req.params.id;
    if (!isAirtableId(id)) {
      return res.status(400).json({ error: 'invalid airtable id' });
    }
    const body = req.body ?? {};
    const patch: { openDate?: string; bankName?: string; accountNumber?: string } = {};
    if (typeof body.openDate === 'string') patch.openDate = body.openDate;
    if (typeof body.bankName === 'string') patch.bankName = body.bankName;
    if (typeof body.accountNumber === 'string') patch.accountNumber = body.accountNumber;

    const cfg = loadConfig();
    const ok = await updateAirtableAuxFields(id, patch, cfg, ctx.logError);
    if (!ok) return res.status(502).json({ error: 'airtable update failed' });

    const record = await fetchAirtableRecord(id, cfg, ctx.logError);
    if (!record) return res.status(500).json({ error: 'fetch after update failed' });
    return res.json({ record });
  });
```

- [ ] **Step 3: GET /contract-download 라우트 추가**

같은 함수 내에 추가:

```ts
  app.get('/api/new-client/:id/contract-download', async (req, res) => {
    const id = req.params.id;
    if (!isAirtableId(id)) return res.status(400).json({ error: 'invalid airtable id' });
    const format = req.query.format === 'pdf-zip' ? 'pdf-zip' : 'xlsx';

    const cfg = loadConfig();
    const record = await fetchAirtableRecord(id, cfg, ctx.logError);
    if (!record) return res.status(404).json({ error: 'record not found' });
    const rrn = await fetchRepRrn(id, cfg, ctx.logError, ctx.log);

    const missing = missingRequired(record, rrn);
    if (missing.length > 0) return res.status(400).json({ missing });

    const values = buildInputSheetValues(record, rrn);
    const xlsxBuf = await fillXlsx(values);
    const companyTag = sanitizeFilename(record.companyName || 'client');

    if (format === 'xlsx') {
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${companyTag}_기장계약서세트.xlsx"`,
      );
      return res.send(xlsxBuf);
    }

    // pdf-zip
    try {
      const wb = XLSX.read(xlsxBuf, { type: 'buffer', cellStyles: true });
      const pdfFiles: Array<{ name: string; data: Buffer }> = [];
      for (const group of BUNDLE_GROUPS) {
        const groupWb = splitForBundle(wb, group);
        const pdf = await renderPdf(groupWb, sanitizeFilename(`${companyTag}_${group.filename}`));
        pdfFiles.push({ name: `${companyTag}_${group.filename}.pdf`, data: pdf });
      }
      const zipBuf = await zipFiles(pdfFiles);
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${companyTag}_기장계약서묶음.zip"`,
      );
      return res.send(zipBuf);
    } catch (err: any) {
      ctx.logError(`[new-client] contract-download pdf-zip failed: ${err.message || err}`);
      const msg = /spawn failed|ENOENT/i.test(err.message ?? '')
        ? 'LibreOffice 미설치 — PDF 변환 불가. xlsx로 다운로드하세요.'
        : /timeout/i.test(err.message ?? '')
          ? 'PDF 변환 시간 초과'
          : 'PDF 생성 실패';
      return res.status(500).json({ error: msg });
    }
  });
```

- [ ] **Step 4: 컴파일 확인**

Run: `cd jeeves && npx tsc --noEmit -p server/tsconfig.json`
Expected: 에러 없음.

- [ ] **Step 5: 수동 확인 — 서버 기동 후 curl**

Run: `cd jeeves && npm run dev:server` (백그라운드)

별도 터미널:
```bash
# 실제 Airtable id 필요. id는 기존 UI에서 확인.
curl -v "http://localhost:3000/api/new-client/<recId>/contract-download?format=xlsx" -o /tmp/test.xlsx
file /tmp/test.xlsx
```

Expected: `Microsoft Excel 2007+` 파일. 엑셀/Numbers에서 열어 입력시트에 값 채워진 것 확인.

- [ ] **Step 6: 커밋**

```bash
git add jeeves/server/plugins/new-client/routes.ts
git commit -m "feat(new-client): add aux PATCH + contract-download routes"
```

---

## Task 9: Client — NewClientRecord 타입 확장

**Files:**
- Modify: `jeeves/client/src/plugins/new-client/types.ts` (NewClientRecord 인터페이스)

- [ ] **Step 1: bankName/accountNumber 추가**

클라이언트 types.ts의 `NewClientRecord` 인터페이스에 (기존 `bizPhone` 근처) 추가:

```ts
  bizPhone?: string;
  bankName?: string;
  accountNumber?: string;
```

- [ ] **Step 2: 컴파일 확인**

Run: `cd jeeves/client && npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 3: 커밋**

```bash
git add jeeves/client/src/plugins/new-client/types.ts
git commit -m "feat(new-client): client types add bankName/accountNumber"
```

---

## Task 10: Client — useAuxInputs 훅

**Files:**
- Create: `jeeves/client/src/plugins/new-client/hooks/useAuxInputs.ts`

- [ ] **Step 1: 훅 작성**

```ts
import { useCallback, useRef, useState } from 'react';
import { useApi } from '../../../core/hooks/useApi';
import type { NewClientRecord } from '../types';

type AuxFieldKey = 'openDate' | 'bankName' | 'accountNumber';
type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface AuxState {
  openDate: string;
  bankName: string;
  accountNumber: string;
}

/**
 * Aux 입력 3개 필드의 로컬 상태 + Airtable write-back.
 * onBlur/commit 시 호출되는 commitField를 반환한다.
 * record prop이 바뀌면 초기값 재동기화 (다른 거래처로 전환 시).
 */
export function useAuxInputs(
  clientId: string,
  initial: { openDate?: string; bankName?: string; accountNumber?: string },
  onRecordRefresh: (record: NewClientRecord) => void,
) {
  const api = useApi();
  const [values, setValues] = useState<AuxState>({
    openDate: initial.openDate ?? '',
    bankName: initial.bankName ?? '',
    accountNumber: initial.accountNumber ?? '',
  });
  const [status, setStatus] = useState<Record<AuxFieldKey, SaveStatus>>({
    openDate: 'idle', bankName: 'idle', accountNumber: 'idle',
  });
  const lastSaved = useRef<AuxState>(values);
  const fadeTimers = useRef<Partial<Record<AuxFieldKey, ReturnType<typeof setTimeout>>>>({});

  const setField = useCallback((key: AuxFieldKey, v: string) => {
    setValues((cur) => ({ ...cur, [key]: v }));
  }, []);

  const commitField = useCallback(
    async (key: AuxFieldKey) => {
      const cur = values[key];
      if (lastSaved.current[key] === cur) return;
      setStatus((s) => ({ ...s, [key]: 'saving' }));
      try {
        const res = await api<{ record: NewClientRecord }>(
          `/api/new-client/${clientId}/aux`,
          { method: 'PATCH', body: JSON.stringify({ [key]: cur }),
            headers: { 'Content-Type': 'application/json' } },
        );
        lastSaved.current = { ...lastSaved.current, [key]: cur };
        onRecordRefresh(res.record);
        setStatus((s) => ({ ...s, [key]: 'saved' }));
        if (fadeTimers.current[key]) clearTimeout(fadeTimers.current[key]!);
        fadeTimers.current[key] = setTimeout(
          () => setStatus((s) => ({ ...s, [key]: 'idle' })),
          2000,
        );
      } catch (_e) {
        setStatus((s) => ({ ...s, [key]: 'error' }));
      }
    },
    [api, clientId, values, onRecordRefresh],
  );

  return { values, status, setField, commitField };
}
```

- [ ] **Step 2: 컴파일 확인**

Run: `cd jeeves/client && npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 3: 커밋**

```bash
git add jeeves/client/src/plugins/new-client/hooks/useAuxInputs.ts
git commit -m "feat(new-client): useAuxInputs hook"
```

---

## Task 11: Client — AuxInputsPanel 컴포넌트

**Files:**
- Create: `jeeves/client/src/plugins/new-client/components/AuxInputsPanel.tsx`

- [ ] **Step 1: 컴포넌트 작성**

```tsx
import { useAuxInputs } from '../hooks/useAuxInputs';
import type { NewClientRecord } from '../types';

interface Props {
  record: NewClientRecord;
  onRecordRefresh: (record: NewClientRecord) => void;
}

export function AuxInputsPanel({ record, onRecordRefresh }: Props) {
  const { values, status, setField, commitField } = useAuxInputs(
    record.id,
    {
      openDate: record.openDate,
      bankName: record.bankName,
      accountNumber: record.accountNumber,
    },
    onRecordRefresh,
  );

  function statusLabel(s: 'idle' | 'saving' | 'saved' | 'error'): string {
    if (s === 'saving') return '저장 중…';
    if (s === 'saved') return '저장됨';
    if (s === 'error') return '저장 실패';
    return '';
  }

  const field = (
    label: string,
    key: 'openDate' | 'bankName' | 'accountNumber',
    type: 'date' | 'text',
  ) => (
    <div className="flex flex-col gap-0.5">
      <label className="text-[11px] text-muted">{label}</label>
      <div className="flex items-center gap-1.5">
        <input
          type={type}
          value={values[key]}
          onChange={(e) => setField(key, e.target.value)}
          onBlur={() => commitField(key)}
          className="px-2 py-1 rounded border border-border bg-surface text-xs text-white [color-scheme:dark]"
        />
        <span className={`text-[10px] ${status[key] === 'error' ? 'text-danger' : 'text-muted'}`}>
          {statusLabel(status[key])}
        </span>
      </div>
    </div>
  );

  return (
    <div className="rounded border border-border bg-surface2/40 p-3 mb-3">
      <div className="text-xs text-muted mb-2">거래처 보조 정보 (계약서/문서 생성용)</div>
      <div className="flex gap-4 flex-wrap">
        {field('개업 연월일', 'openDate', 'date')}
        {field('은행명', 'bankName', 'text')}
        {field('계좌번호', 'accountNumber', 'text')}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 컴파일 확인**

Run: `cd jeeves/client && npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 3: 커밋**

```bash
git add jeeves/client/src/plugins/new-client/components/AuxInputsPanel.tsx
git commit -m "feat(new-client): AuxInputsPanel component"
```

---

## Task 12: Client — STEP 6 개업일 입력 제거 + record 값 사용

**Files:**
- Modify: `jeeves/client/src/plugins/new-client/components/ChecklistItemRow.tsx`

- [ ] **Step 1: STEP 6 전용 입력 박스 삭제**

[ChecklistItemRow.tsx:155-168](jeeves/client/src/plugins/new-client/components/ChecklistItemRow.tsx#L155) 의 `{isWehago && ...}` JSX 블록 전체 제거.

- [ ] **Step 2: localStorage 관련 코드 제거**

같은 파일에서 아래 항목 삭제:
- `const [openDate, setOpenDate] = useState<string>(...)` (lazy init 블록)
- `useEffect(() => { if (!isWehago) return; ... }, [clientId])` (재-로드 블록)
- `loadWehagoOpenDate`/`saveWehagoOpenDate` import가 있다면 해당 import 제거
- `handleWehagoRegister` 내부 `registerWehago(openDate)` → `registerWehago(recordOpenDate ?? '')` 로 변경

- [ ] **Step 3: `useWehagoOpenDate` 스토리지 파일이 더 이상 사용되지 않는지 확인**

Run:
```bash
grep -rn "loadWehagoOpenDate\|saveWehagoOpenDate" /Users/hany/workzone/codetax-macro/jeeves/client/src/
```

만약 해당 함수가 이 파일에서만 사용됐다면 정의 파일도 삭제 가능. 남겨두고 진행해도 무방. 삭제는 별도 커밋.

- [ ] **Step 4: 컴파일**

Run: `cd jeeves/client && npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 5: 브라우저 동작 확인**

Run: `cd jeeves && npm run dev` (혹은 프로젝트 기존 기동 방법)

브라우저 → 상세 페이지 열어 STEP 6 (위하고) 행을 본다. 개업 연월일 input이 사라졌는지 확인. 다른 행/기능은 그대로 동작하는지 확인.

- [ ] **Step 6: 커밋**

```bash
git add jeeves/client/src/plugins/new-client/components/ChecklistItemRow.tsx
git commit -m "refactor(new-client): remove STEP 6 in-row 개업일 input (use record.openDate)"
```

---

## Task 13: Client — ContractDownloadButtons 컴포넌트

**Files:**
- Create: `jeeves/client/src/plugins/new-client/components/ContractDownloadButtons.tsx`

- [ ] **Step 1: 컴포넌트 작성**

```tsx
import { useState } from 'react';
import type { NewClientRecord } from '../types';

interface Props {
  record: NewClientRecord;
}

/** 다운로드 버튼 활성화에 필요한 필드가 빠졌는지 검사. */
function clientMissing(record: NewClientRecord): string[] {
  const m: string[] = [];
  const blank = (v?: string | number) =>
    v === undefined || v === null || (typeof v === 'string' && v.trim() === '');
  if (blank(record.representative)) m.push('대표자');
  if (blank(record.companyName)) m.push('업체명');
  if (blank(record.bizRegNumber)) m.push('사업자번호');
  if (blank(record.bizPhone)) m.push('전화번호');
  if (blank(record.bizAddress)) m.push('사업장주소');
  if (blank(record.bookkeepingFee)) m.push('기장료');
  if (blank(record.openDate)) m.push('개업일');
  if (blank(record.bankName)) m.push('은행명');
  if (blank(record.accountNumber)) m.push('계좌번호');
  if (record.entityType === '법인' && blank(record.corpRegNumber)) m.push('법인등록번호');
  return m;
}

async function triggerDownload(url: string, fallbackName: string) {
  const res = await fetch(url);
  if (!res.ok) {
    let err = '다운로드 실패';
    try {
      const j = await res.json();
      if (j?.missing) err = `누락: ${j.missing.join(', ')}`;
      else if (j?.error) err = j.error;
    } catch {}
    throw new Error(err);
  }
  const blob = await res.blob();
  const cd = res.headers.get('Content-Disposition') || '';
  const m = cd.match(/filename="([^"]+)"/);
  const filename = m?.[1] ?? fallbackName;
  const objUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objUrl);
}

export function ContractDownloadButtons({ record }: Props) {
  const [err, setErr] = useState<string | null>(null);
  const [pending, setPending] = useState<'xlsx' | 'pdf' | null>(null);
  const missing = clientMissing(record);
  const disabled = missing.length > 0;
  const title = disabled ? `누락: ${missing.join(', ')}` : '';

  async function onClick(format: 'xlsx' | 'pdf-zip') {
    setErr(null);
    setPending(format === 'xlsx' ? 'xlsx' : 'pdf');
    try {
      await triggerDownload(
        `/api/new-client/${record.id}/contract-download?format=${format}`,
        format === 'xlsx' ? '기장계약서세트.xlsx' : '기장계약서묶음.zip',
      );
    } catch (e: any) {
      setErr(e.message ?? '다운로드 실패');
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="flex items-center gap-1.5 mt-1">
      <button
        type="button"
        disabled={disabled || pending !== null}
        title={title}
        onClick={() => onClick('xlsx')}
        className="px-2 py-0.5 rounded text-[11px] border border-border hover:bg-surface2 disabled:opacity-50"
      >
        {pending === 'xlsx' ? '생성 중…' : '엑셀 다운로드'}
      </button>
      <button
        type="button"
        disabled={disabled || pending !== null}
        title={title}
        onClick={() => onClick('pdf-zip')}
        className="px-2 py-0.5 rounded text-[11px] border border-border hover:bg-surface2 disabled:opacity-50"
      >
        {pending === 'pdf' ? '생성 중…' : 'PDF 묶음'}
      </button>
      {err && <span className="text-[10px] text-danger">{err}</span>}
    </div>
  );
}
```

- [ ] **Step 2: 컴파일**

Run: `cd jeeves/client && npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 3: 커밋**

```bash
git add jeeves/client/src/plugins/new-client/components/ContractDownloadButtons.tsx
git commit -m "feat(new-client): ContractDownloadButtons"
```

---

## Task 14: Client — STEP 7 행에 다운로드 버튼 연결

**Files:**
- Modify: `jeeves/client/src/plugins/new-client/components/ChecklistTable.tsx`
- Modify: `jeeves/client/src/plugins/new-client/components/ChecklistItemRow.tsx`

- [ ] **Step 1: ChecklistTable props에 record 추가**

[ChecklistTable.tsx](jeeves/client/src/plugins/new-client/components/ChecklistTable.tsx)의 `Props`에 `record: NewClientRecord` 추가. 해당 prop을 `ChecklistItemRow`로 포워드 (별도 prop `record`).

- [ ] **Step 2: ChecklistItemRow Props에 record 추가 + STEP 7 버튼 렌더**

[ChecklistItemRow.tsx](jeeves/client/src/plugins/new-client/components/ChecklistItemRow.tsx)의 `Props`에 `record: NewClientRecord`를 추가.

`def.description` 근처 JSX에서 isWehago 블록이 있던 자리 인근에 아래 추가 (STEP 7 = `contract`):

```tsx
        {def.key === 'contract' && <ContractDownloadButtons record={record} />}
```

상단 import에 `import { ContractDownloadButtons } from './ContractDownloadButtons';` 및 `import type { NewClientRecord } from '../types';` (이미 있으면 생략).

- [ ] **Step 3: NewClientPage가 record를 ChecklistTable에 전달**

[NewClientPage.tsx](jeeves/client/src/plugins/new-client/NewClientPage.tsx)에서 `<ChecklistTable ...>` 호출에 `record={record}` 추가.

- [ ] **Step 4: 컴파일**

Run: `cd jeeves/client && npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 5: 수동 UI 확인**

브라우저 → 거래처 상세 → 체크리스트 STEP 7 행에 "엑셀 다운로드" / "PDF 묶음" 버튼이 보이는지 확인. 필수값 빠진 거래처에선 disabled + 툴팁 확인.

- [ ] **Step 6: 커밋**

```bash
git add jeeves/client/src/plugins/new-client/components/ChecklistTable.tsx jeeves/client/src/plugins/new-client/components/ChecklistItemRow.tsx jeeves/client/src/plugins/new-client/NewClientPage.tsx
git commit -m "feat(new-client): wire download buttons into STEP 7 row"
```

---

## Task 15: Client — NewClientPage에 AuxInputsPanel 렌더

**Files:**
- Modify: `jeeves/client/src/plugins/new-client/NewClientPage.tsx`

- [ ] **Step 1: AuxInputsPanel import + 렌더**

파일 상단 import 추가:
```tsx
import { AuxInputsPanel } from './components/AuxInputsPanel';
```

상세 뷰(view === 'detail')의 JSX에서 `<ChecklistTable ...>` 바로 위에 삽입:

```tsx
<AuxInputsPanel
  record={record}
  onRecordRefresh={(r) => {
    // 기존의 record 상태 갱신 메커니즘 활용. useClientDetail 가 캐시 SWR
    // 식이면 mutate 호출. 직접 state 있으면 setRecord.
    // (구체적 함수는 NewClientPage 구현 상세에 맞춰 연결 — 아래 Step 2 참고.)
  }}
/>
```

- [ ] **Step 2: record 갱신 후크 확인**

Run:
```bash
grep -n "useClientDetail\|setRecord\|mutateRecord\|refreshRecord" /Users/hany/workzone/codetax-macro/jeeves/client/src/plugins/new-client/NewClientPage.tsx /Users/hany/workzone/codetax-macro/jeeves/client/src/plugins/new-client/hooks/*.ts
```

`useClientDetail`이 `{ record, refresh }` 같은 API를 내주는지 확인. 그 함수(예: `refresh()` 또는 `mutate(newRecord)`)를 `onRecordRefresh` 내부에서 호출. 단순화: Airtable이 SoT이고 Panel이 방금 성공 응답으로 최신 record를 받았으니 `mutate(res.record)` 호출이 가장 깔끔.

hook이 `refresh`만 제공한다면 `onRecordRefresh={() => refresh()}`로 대체 가능.

- [ ] **Step 3: 컴파일**

Run: `cd jeeves/client && npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 4: 수동 end-to-end 확인**

브라우저 → 상세 페이지 →
1. 거래처 보조 정보 패널에서 개업 연월일/은행명/계좌번호 입력 → blur → "저장됨" 표시.
2. 새로고침해도 값이 유지되는지 확인 (Airtable write-back 되었나).
3. STEP 7에서 "엑셀 다운로드" 클릭 → 브라우저 다운로드 시작 → 엑셀에서 열어 모든 시트가 값으로 채워진 상태인지 검증.
4. (soffice 설치되어 있다면) "PDF 묶음" 클릭 → zip 다운로드 → 4개 PDF 각각 열어 내용 확인.

- [ ] **Step 5: 커밋**

```bash
git add jeeves/client/src/plugins/new-client/NewClientPage.tsx
git commit -m "feat(new-client): render AuxInputsPanel above checklist"
```

---

## Task 16: Airtable 필드 추가 (수동 작업)

**Files:** (없음 — Airtable UI 직접 작업)

- [ ] **Step 1: Airtable 거래처 테이블에서 필드 2개 추가**

Airtable 웹 UI에서 거래처 테이블 열고, 신규 singleLineText 필드 2개:
- `은행명`
- `계좌번호`

(기존 `개업일` 필드는 그대로 활용)

- [ ] **Step 2: 기존 레코드 1건에 샘플 값 채워 테스트**

Aux 패널에서 입력/저장 가능한지, 반대로 Airtable에서 직접 입력한 값이 다음 페이지 열람 시 prefill되는지 확인.

---

## 완료 검증 (전체)

- [ ] 서버 단위 테스트 전부 통과: `cd jeeves && node --test --import tsx server/plugins/new-client/*.test.ts`
- [ ] 클라이언트 TS 컴파일 에러 없음: `cd jeeves/client && npx tsc --noEmit`
- [ ] 수동: 법인 거래처 1건 — xlsx 다운 성공, 모든 시트에 값 채워짐
- [ ] 수동: 개인 거래처 1건 — xlsx 다운 성공, 법인등록번호는 공란
- [ ] 수동: PDF 묶음 다운 → 4개 PDF 확인
- [ ] 수동: 필수값 누락 거래처 → 버튼 disabled + 툴팁 정상
- [ ] 수동: STEP 6 위하고 자동등록이 record.openDate로 잘 동작
- [ ] `CLAUDE.md`에 soffice 설치 안내 추가 (옵션)

---

## 실행 옵션

계획 완료. 두 가지 실행 방식:

1. **Subagent-Driven (추천)** — 태스크마다 fresh subagent 디스패치, 태스크 사이 리뷰, 빠른 반복
2. **Inline Execution** — 이 세션에서 executing-plans로 checkpoint 배치 실행

어느 쪽으로 갈까요?
