---
name: HTML→PDF 계약서 렌더링 전환
description: xlsx 템플릿 + soffice 변환을 React/HTML + Playwright PDF 렌더링으로 전면 교체
type: design
date: 2026-04-25
status: draft
---

# HTML → PDF 계약서 렌더링 전환

## 1. 목적

현재 `new-client` 플러그인의 PDF 출력은 xlsx 템플릿(`references/sheet.xlsx`)을 채워 LibreOffice(`soffice`)로 변환하는 방식이다. 최근 한 달간 이 경로에서 다음 버그 시리즈를 수정해왔다:

- macOS NFC/NFD 파일명 불일치로 출력 PDF 미발견
- 시트 삭제 시 `drawings/calcChain` 참조 깨짐 (hidden 처리로 우회 중)
- 인쇄 마진 / pageSetup 불일치
- Google Drive 변환 실패 → soffice 회귀

이 전환은 위 문제의 **공통 원인(외부 변환기 의존)** 을 제거하고, React 컴포넌트 + Playwright 헤드리스 Chromium으로 PDF를 렌더한다.

## 2. 결정 사항 (브레인스토밍 합의)

| 항목 | 결정 |
|---|---|
| 템플릿 수정 주체 | 본인(개발자)만 — 비개발자 편집 불필요 |
| 시각적 충실도 | **픽셀 동일** (현재 출력물과 거의 같아야 함) |
| 마이그레이션 전략 | **전체 컷오버** — 4종 모두 React 포팅 후 단일 PR |
| 렌더링 스택 | React JSX → `renderToStaticMarkup` → Playwright `page.pdf()` |

## 3. 범위 외 (Out of Scope)

- 시각적 회귀(visual regression) CI — v1에서는 머지 전 육안 비교로 충분
- soffice 페일오버 — 컷오버이므로 폴백 없음
- `references/sheet.xlsx` — 시각 비교 기준 자료로 보관 유지

## 3.1 추가 결정 (2026-04-25)

xlsx 다운로드 기능 자체를 폐기하고 PDF 만 제공한다.
- `fillXlsx` 함수 삭제
- `/contract-download` 의 `format=xlsx` 분기 삭제 (또는 라우트 자체를 `format` 없이 PDF 전용으로 단순화)
- 클라이언트 `DocumentDownloadPanel` 의 xlsx 버튼 제거
- `references/sheet.xlsx` 는 시각 참조용으로 보관 (코드에서는 더 이상 read 안 함)

## 4. 아키텍처

### 4.1 디렉터리 구조

```
jeeves/server/plugins/new-client/
├── pdf/                              ← 신규 모듈
│   ├── renderer.ts                   ← Playwright 싱글톤 + renderTemplate()
│   ├── bundles.ts                    ← BUNDLE_GROUPS + 번들 PDF 조립 (pdf-lib)
│   ├── preview-routes.ts             ← GET /preview/:bundle (개발용, NODE_ENV=development만)
│   ├── fonts/                        ← 번들 한글 폰트 (.ttf)
│   │   ├── HCR-Batang.ttf
│   │   ├── HCR-Batang-Bold.ttf
│   │   ├── Pretendard-Regular.ttf    ← 맑은고딕 대체
│   │   └── Pretendard-Bold.ttf
│   └── templates/
│       ├── shared/
│       │   ├── PageFrame.tsx         ← <html><head> + @page CSS
│       │   ├── fonts.css             ← @font-face 정의
│       │   ├── Stamp.tsx
│       │   └── SignatureBlock.tsx
│       ├── ContractCover.tsx         ← 기장계약서표지
│       ├── ContractMain1.tsx         ← 기장계약서 1
│       ├── ContractMain2.tsx         ← 기장계약서 2
│       ├── CMS.tsx
│       ├── Consent.tsx               ← 수임동의
│       ├── EdiKb.tsx                 ← 국민 EDI
│       └── EdiNhis.tsx               ← 건강 EDI
└── routes.ts                         ← /contract/render: 새 renderer 호출
```

**삭제** (전체 컷오버):
- `contract-pdf.ts` 전체 (`splitForBundle`, `renderPdf`, `resolveSofficePath`, `BUNDLE_GROUPS`)
- `contract.ts` 의 `fillXlsx` (입력시트 채우기) — `buildInputSheetValues`/`missingRequired` 는 유지
- `NEW_CLIENT_SOFFICE_PATH` 환경변수 참조

**유지/재배치**:
- `BUNDLE_GROUPS` → `pdf/bundles.ts` 로 이동 + 정의 변경 (시트명 → 템플릿 컴포넌트 배열)
- `sanitizeFilename` → `pdf/bundles.ts` 로 이동
- `zipFiles` → `pdf/bundles.ts` 로 이동

### 4.2 데이터 흐름

```
POST /api/new-client/contract/render { recordId }
  ↓
record 로드 → buildInputSheetValues(record)        (기존 유지)
  ↓
missingRequired(values) → 누락 필드 검증           (기존 유지)
  ↓
for each bundle in BUNDLE_GROUPS:
  templates = bundle.templates  // 컴포넌트 배열
  pdfs = await Promise.all(templates.map(T => renderTemplate(T, values)))
  bundlePdf = pdfs.length === 1 ? pdfs[0] : await mergePdfs(pdfs)
  ↓
zipFiles([{ name: bundle.filename + '.pdf', data: bundlePdf }, ...])
  ↓
스트리밍 응답 (Content-Disposition + zip)
```

### 4.3 핵심 기술 결정

**(a) Playwright 브라우저 싱글톤**
- 서버 부팅 시 `chromium.launch()` 1회, 모듈 스코프 변수에 저장
- 렌더마다 `browser.newContext()` → `newPage()` → `page.setContent(html)` → `page.pdf()` → `context.close()`
- 콜드 런치 ~1.5s 비용을 첫 요청에 흡수, 이후 요청은 ~100ms/template
- 서버 종료 훅(`SIGTERM`/`process.exit`)에서 `browser.close()`

**(b) React → HTML 직렬화**
- `react-dom/server` 의 `renderToStaticMarkup` (이미 client deps에 있음, server에도 추가)
- 결과물에 `<!DOCTYPE html>` + `<html>` + `<head>`(폰트/스타일) + `<body>`(템플릿) 래핑
- `PageFrame` 컴포넌트가 이 래핑 담당

**(c) 한글 폰트**
- `pdf/fonts/` 에 `.ttf` 동봉, `@font-face { src: url('file:///abs/path.ttf') }` 로 로드
- `함초롬바탕` (HCR Batang) — Hancom 무료 라이선스, 본 양식 본문체
- `맑은 고딕` 대체 → `Pretendard` (SIL OFL, 거의 동일 메트릭)
- `page.pdf()` 호출 전 `await page.evaluateHandle('document.fonts.ready')` 로 폰트 로딩 보장

**(d) 페이지 설정 (@page)**
- 각 템플릿이 `PageFrame` 으로 감싸지며, A4 + 마진을 CSS로 선언:
  ```css
  @page { size: A4; margin: 15mm 12mm; }
  ```
- 마진 값은 양식별로 다를 수 있어 `PageFrame` props 로 override 가능

**(e) PDF 병합**
- 번들에 템플릿이 2개 이상이면 `pdf-lib` 로 페이지 병합
- 신규 의존성: `pdf-lib` (~150kb, MIT, 활성 유지보수)

**(f) 미리보기 라우트**
- `GET /api/new-client/preview/:bundle?recordId=...` → HTML 그대로 반환 (PDF 아님)
- 브라우저로 열어 즉시 디버깅, Cmd+P → "Save as PDF" 로 시각 비교 가능
- `process.env.NODE_ENV !== 'production'` 일 때만 라우트 등록

## 5. 변경 파일 요약

### 신규
- `jeeves/server/plugins/new-client/pdf/renderer.ts`
- `jeeves/server/plugins/new-client/pdf/bundles.ts`
- `jeeves/server/plugins/new-client/pdf/preview-routes.ts`
- `jeeves/server/plugins/new-client/pdf/templates/**/*.tsx`
- `jeeves/server/plugins/new-client/pdf/fonts/*.ttf`
- 각 템플릿 단위 테스트: `pdf/templates/*.test.ts` (PDF Buffer 비공백 검증)

### 수정
- `routes.ts` — `contract-pdf` import 제거, `pdf/bundles` 사용. `/contract-download` 는 PDF 전용으로 단순화 (xlsx 분기 제거)
- `contract.ts` — `fillXlsx`, `InputSheetValues` 의 xlsx 의존 부분 제거. `buildInputSheetValues` / `missingRequired` 는 React 템플릿 props 빌드용으로 유지 (필요 시 함수명/리턴 타입 정리)
- `package.json` (server) — `pdf-lib`, `react`, `react-dom` 추가
- `tsconfig.json` (server) — JSX 활성화 (`"jsx": "react-jsx"`)
- `client/src/plugins/new-client/components/DocumentDownloadPanel.tsx` — xlsx 다운로드 버튼 제거, PDF 버튼만 유지

### 삭제
- `jeeves/server/plugins/new-client/contract-pdf.ts`
- `jeeves/server/plugins/new-client/contract-pdf.test.ts` — 새 테스트로 대체
- `NEW_CLIENT_SOFFICE_PATH` 환경변수 (`.env.example`, README 등)

## 6. 에러 처리

| 시나리오 | 처리 |
|---|---|
| Playwright 런치 실패 | 503 + `[new-client] PDF 엔진 시작 실패: <원인>` 로그 |
| 템플릿 렌더 중 throw | 500 + 템플릿명/recordId 로그, 다른 번들에 영향 없음 (Promise.allSettled 검토) |
| pdf-lib 병합 실패 | 500 + 번들명 로그 |
| 누락 필드 (기존) | 400 + 누락 필드 목록 (기존 동작 유지) |

## 7. 테스트

- **단위**: 각 템플릿 컴포넌트에 샘플 valid input 주입 → `renderTemplate(T, sample)` 결과가 비공백 PDF Buffer (`%PDF-` 헤더 검증)
- **통합**: `routes.test.ts` 에 `/contract/render` 엔드투엔드 — zip 안에 4개 PDF 존재, 각 PDF 비공백
- **수동 (머지 전 1회)**: 실제 거래처 데이터 1건에 대해 신/구 엔진 출력 PDF를 사장님이 육안 비교 → OK 시 머지

## 8. 마이그레이션 순서

단일 PR이지만 작업 자체는 다음 순서:

1. `pdf/renderer.ts` + Playwright 싱글톤 골격 + 폰트 로딩 + 더미 템플릿 1장 PDF 테스트
2. `PageFrame` + `Stamp` + `SignatureBlock` 공통 컴포넌트
3. 템플릿 7개 포팅 (CMS → Consent → EDI 2종 → 기장계약서 3종 순; 단순한 것부터)
4. `bundles.ts` 로 번들 조립 + 병합
5. `routes.ts` 신규 renderer로 교체, `contract-pdf.ts` 삭제
6. 미리보기 라우트
7. 테스트 갱신
8. 사장님 육안 검증 → 머지

## 9. 알려진 리스크

- **픽셀 동일 보장 못 함**: HTML 박스 모델 ≠ Excel 셀 모델. 폰트 메트릭 차이로 한 줄에 들어가던 텍스트가 두 줄로 떨어질 수 있음. v1 의 "픽셀 동일"은 *육안으로 거의 같음* 수준을 의미하며, 양식별로 표 폭/줄간격을 미세조정해야 한다.
- **Playwright 번들 크기**: 헤드리스 Chromium 본체 ~170MB. 배포 환경(현재 macOS 로컬)에서 `npx playwright install chromium` 필요. 배포 자동화 시 Dockerfile 단계 추가.
- **한글 폰트 라이선스**: HCR Batang은 한컴 무료 라이선스(상업적 사용 가능, 재배포 시 출처 표기 권장). Pretendard는 SIL OFL. 재확인 후 `pdf/fonts/LICENSE` 파일 동봉.

## 10. 성공 기준

- 4종 PDF 번들이 신규 엔진으로 정상 출력
- soffice 호출 코드 0건 (`grep -r soffice jeeves/server`)
- 사장님 육안 검증 통과 (실제 거래처 1건)
- 단위 + 통합 테스트 통과
- 평균 응답 시간 ≤ 기존 (싱글톤 효과로 더 빠를 가능성)
