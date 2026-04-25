# Jeeves 부가가치세 예정고지 탭 모듈화 설계

## 개요

현재 monolithic 구조(server.js 570줄 + index.html 2877줄)를 **매크로 플러그인 패턴**으로 리팩토링한다.
프론트엔드를 **Vite + React + TypeScript + Tailwind CSS**로 전환하고, Express 백엔드를 유지하면서 모듈화한다.

### 목표

- 부가가치세 예정고지 탭을 재사용 가능한 모듈로 분리
- 카카오톡 매크로 전송을 독립 플러그인으로 분리하여 다른 매크로에서도 재사용
- 새 매크로(소득세 집계, 원천세 정리 등) 추가 시 플러그인만 작성하면 되는 구조

### 기술 스택

| 영역 | 현재 | 변경 후 |
|------|------|---------|
| 프론트엔드 | 단일 HTML + 인라인 JS (2877줄) | Vite + React + TypeScript |
| 스타일링 | CSS 변수 + 인라인 스타일 | Tailwind CSS |
| 백엔드 | Express + CommonJS (server.js 570줄) | Express + TypeScript 모듈화 |
| 상태 관리 | 전역 변수 + localStorage | zustand |
| 실시간 통신 | SSE (유지) | SSE (useSSE 훅으로 래핑) |

---

## 1. 플러그인 인터페이스

### 1.1 백엔드 MacroPlugin

```typescript
// server/plugins/types.ts

interface MacroPlugin {
  id: string;                    // 'vat-notice', 'kakao-send'
  name: string;                  // '부가가치세 예정고지'
  icon: string;                  // '⚡'
  status: 'ready' | 'coming-soon';

  // Express 라우트 등록
  registerRoutes(app: Express, ctx: ServerContext): void;
}

interface ServerContext {
  session: BrowserSession;       // Playwright 세션 공유
  broadcast: (type: string, message: any) => void;
  log: (msg: string) => void;
  logError: (msg: string) => void;
}
```

### 1.2 프론트엔드 MacroPagePlugin

```typescript
// client/src/plugins/types.ts

interface MacroPagePlugin {
  id: string;
  name: string;
  icon: string;
  status: 'ready' | 'coming-soon';
  description: string;

  // React 컴포넌트
  Page: React.ComponentType;

  // 사이드바 뱃지 (선택)
  badge?: string;               // 'NEW'
}
```

새 매크로 추가 시 양쪽 인터페이스를 구현하고 `plugins/index.ts`에 등록하면 사이드바/대시보드/라우팅이 자동 반영된다.

---

## 2. 백엔드 구조

### 2.1 디렉토리 구조

```
server/
├── index.ts               # Express 앱 진입점, 플러그인 로딩
├── core/
│   ├── session.ts          # BrowserSession 클래스 (Playwright 세션 관리)
│   ├── sse.ts              # SSEManager 클래스 (SSE 클라이언트 관리 + broadcast)
│   └── logger.ts           # SSEManager를 주입받는 log/logError 팩토리
├── plugins/
│   ├── index.ts            # 모든 플러그인 배열 export
│   ├── types.ts            # MacroPlugin, ServerContext 인터페이스
│   ├── vat-notice/
│   │   ├── index.ts        # vatNoticePlugin 객체 export
│   │   ├── routes.ts       # /api/vat/start, /api/vat/stop, /api/vat/files
│   │   ├── automation.ts   # processOneBusiness, downloadPDFsForBusinesses
│   │   └── config.ts       # MENU 셀렉터, CROP_CONFIGS, TARGET_ROW_TEXT
│   ├── kakao-send/
│   │   ├── index.ts        # kakaoSendPlugin 객체 export
│   │   ├── routes.ts       # /api/kakao/start, stop, targets, logs, card-images 등
│   │   ├── sender.ts       # runKakaoSend (nut-js 기반 매크로)
│   │   └── scanner.ts      # scanKakaoTargets, scanDateFolders
│   └── messages/
│       ├── index.ts        # messagesPlugin 객체 export
│       └── routes.ts       # /api/messages CRUD
└── shared/
    ├── hometax.ts          # findSelector, clickSelector, fillSelector, navigateToPage
    ├── ocr.ts              # Swift Vision OCR (verify-image)
    ├── pdf2png.ts          # PDF → PNG 변환
    └── file-utils.ts       # sanitizeName, scanDateFolders 등
```

### 2.2 core 모듈 상세

**BrowserSession** — 현재 `server.js`의 `session` 객체 + `login.js`를 통합:

```typescript
class BrowserSession {
  browser: Browser | null = null;
  context: BrowserContext | null = null;
  page: Page | null = null;
  loggedIn = false;
  isLoggingIn = false;
  isRunning = false;
  stopRequested = false;
  progress = { current: 0, total: 0, success: 0, failed: 0 };

  async launch(): Promise<void>;
  async waitForLogin(log: LogFn): Promise<void>;
  async close(): Promise<void>;
  reset(): void;
  getStatus(): SessionStatus;
}
```

**SSEManager** — SSE 클라이언트 관리:

```typescript
class SSEManager {
  private clients = new Set<Response>();
  addClient(res: Response): void;
  removeClient(res: Response): void;
  broadcast(type: string, message: any): void;
}
```

### 2.3 shared 모듈 상세

**hometax.ts** — 현재 `automation.js`에서 홈택스 공통 유틸 추출:

- `findSelector(page, selectorString, timeout)` — 메인 + iframe에서 셀렉터 탐색
- `clickSelector(page, selectorString, timeout)` — 셀렉터 찾아 클릭
- `fillSelector(page, selectorString, value, timeout)` — 셀렉터 찾아 입력
- `normalizeBizNum(raw)` — 사업자번호 정규화

이 유틸들은 소득세/원천세 매크로에서도 홈택스 조회 시 재사용된다.

### 2.4 플러그인 등록

```typescript
// server/index.ts
import { plugins } from './plugins';

const session = new BrowserSession();
const sse = new SSEManager();
const { log, logError } = createLogger(sse);
const ctx: ServerContext = { session, broadcast: sse.broadcast, log, logError };

// 공통 라우트
app.get('/api/events', (req, res) => sse.addClient(res));
app.get('/api/status', (req, res) => res.json(session.getStatus()));
app.post('/api/login', ...);
app.post('/api/logout', ...);

// 플러그인 라우트 자동 등록
for (const plugin of plugins) {
  plugin.registerRoutes(app, ctx);
}
```

---

## 3. 프론트엔드 구조

### 3.1 디렉토리 구조

```
client/
├── index.html
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── package.json
├── src/
│   ├── main.tsx
│   ├── App.tsx                    # Routes + 플러그인 자동 로딩
│   │
│   ├── core/
│   │   ├── hooks/
│   │   │   ├── useSSE.ts          # SSE 연결 + 이벤트 타입별 구독
│   │   │   ├── useSession.ts      # 로그인 상태, 브라우저 세션
│   │   │   └── useApi.ts          # fetch 래퍼
│   │   ├── components/
│   │   │   ├── Layout.tsx         # 사이드바 + 메인 영역 레이아웃
│   │   │   ├── Sidebar.tsx        # plugins 배열에서 메뉴 자동 생성
│   │   │   ├── Dashboard.tsx      # plugins 배열에서 카드 자동 생성
│   │   │   ├── LogViewer.tsx      # 실시간 로그 표시 (범용)
│   │   │   ├── ProgressBar.tsx    # 프로그레스 바 + 통계 (범용)
│   │   │   ├── ImagePopup.tsx     # 이미지 확대 팝업
│   │   │   └── Toast.tsx          # 토스트 알림
│   │   ├── store/
│   │   │   └── sessionStore.ts    # zustand: 세션 상태
│   │   └── types.ts
│   │
│   └── plugins/
│       ├── index.ts               # MacroPagePlugin[] 배열 export
│       ├── types.ts               # MacroPagePlugin 인터페이스
│       │
│       ├── vat-notice/
│       │   ├── index.ts           # plugin 객체 export
│       │   ├── VatNoticePage.tsx   # 메인 페이지 (스텝 관리)
│       │   ├── steps/
│       │   │   ├── ExcelUpload.tsx
│       │   │   ├── HometaxLogin.tsx
│       │   │   ├── AutoCollection.tsx
│       │   │   ├── CollectionProgress.tsx
│       │   │   └── KakaoSendStep.tsx    # kakao-send 임베드
│       │   ├── components/
│       │   │   ├── WorkflowBar.tsx      # 1→2→3→4→5 스텝 바
│       │   │   └── BusinessTable.tsx
│       │   └── hooks/
│       │       └── useVatWorkflow.ts    # 워크플로 상태 관리
│       │
│       └── kakao-send/
│           ├── index.ts
│           ├── KakaoSendPage.tsx         # 독립 페이지 겸 임베드 컴포넌트
│           ├── components/
│           │   ├── TargetTable.tsx
│           │   ├── MessagePanel.tsx
│           │   ├── CardImagePanel.tsx
│           │   ├── KakaoPreview.tsx
│           │   ├── SendConfirmModal.tsx
│           │   └── FilterBar.tsx
│           └── hooks/
│               ├── useKakaoTargets.ts
│               └── useKakaoSend.ts
```

### 3.2 App.tsx — 플러그인 자동 라우팅

```typescript
import { plugins } from './plugins';

function App() {
  return (
    <Layout plugins={plugins}>
      <Routes>
        <Route path="/" element={<Dashboard plugins={plugins} />} />
        {plugins
          .filter(p => p.status === 'ready')
          .map(p => (
            <Route key={p.id} path={`/${p.id}`} element={<p.Page />} />
          ))}
      </Routes>
    </Layout>
  );
}
```

### 3.3 kakao-send 임베드 패턴

`KakaoSendPage`는 props로 `folder`를 받으면 특정 폴더 기준으로 동작하고, props 없으면 최신 폴더를 자동 선택한다:

```typescript
// 독립 페이지로 사용
<KakaoSendPage />

// vat-notice Step 5에서 임베드
<KakaoSendPage folder={currentDateFolder} />
```

### 3.4 Sidebar/Dashboard 자동 생성

```typescript
// Sidebar.tsx
function Sidebar({ plugins }: { plugins: MacroPagePlugin[] }) {
  return (
    <nav>
      <NavSection label="매크로">
        {plugins.map(p => (
          <NavItem
            key={p.id}
            to={`/${p.id}`}
            icon={p.icon}
            label={p.name}
            badge={p.badge}
            disabled={p.status === 'coming-soon'}
          />
        ))}
      </NavSection>
    </nav>
  );
}
```

---

## 4. SSE 데이터 흐름

```
[서버 플러그인] → ctx.broadcast(type, data)
       ↓
[SSEManager] → EventSource stream
       ↓
[useSSE 훅] → 이벤트 타입별 콜백 분배
       ↓
[각 플러그인 컴포넌트] → 구독한 이벤트만 수신
```

```typescript
// client/src/core/hooks/useSSE.ts
function useSSE(
  eventTypes: string[],
  onEvent: (type: string, data: any) => void
): void {
  // EventSource 연결, 컴포넌트 언마운트 시 정리
  // 이벤트 타입: 'log', 'error', 'progress', 'status',
  //            'kakao-log', 'kakao-status-update', 'kakao-done', 'done'
}
```

---

## 5. 에러 핸들링

### 5.1 백엔드 공통 에러

```typescript
// server/core/errors.ts
class MacroError extends Error {
  constructor(
    message: string,
    public code: string,         // 'SESSION_NOT_FOUND', 'HOMETAX_NAV_FAILED'
    public recoverable: boolean  // true면 프론트에서 재시도 유도
  ) { super(message); }
}
```

### 5.2 라우트 에러 핸들러

```typescript
function withErrorHandler(ctx: ServerContext, handler: RequestHandler): RequestHandler {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (err) {
      if (err instanceof MacroError) {
        ctx.logError(`[${err.code}] ${err.message}`);
        res.status(err.recoverable ? 409 : 500).json({
          error: err.message,
          code: err.code,
        });
      } else {
        ctx.logError(`예기치 않은 오류: ${(err as Error).message}`);
        res.status(500).json({ error: '서버 오류' });
      }
    }
  };
}
```

---

## 6. 개발 환경

### 6.1 개발 모드

```bash
# 터미널 1: 프론트엔드
cd client && npm run dev    # Vite dev server (포트 5173)

# 터미널 2: 백엔드
cd server && npm run dev    # ts-node-dev (포트 3001)
```

```typescript
// client/vite.config.ts
export default defineConfig({
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
      '/images': 'http://localhost:3001',
      '/card-images': 'http://localhost:3001',
    }
  }
});
```

### 6.2 프로덕션

```bash
cd client && npm run build     # → client/dist/
cd server && npm start         # Express에서 client/dist/ 정적 서빙
```

```typescript
// server/index.ts (프로덕션)
app.use(express.static(path.join(__dirname, '../client/dist')));
// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});
```

---

## 7. 마이그레이션 전략

현재 동작하는 시스템을 깨뜨리지 않기 위해 4단계로 진행한다:

### Phase 1: 프로젝트 구조 셋업

- Vite + React + TypeScript + Tailwind 초기화 (`client/`)
- Express 서버 TypeScript 전환 (`server/`)
- core/ 추출 (BrowserSession, SSEManager, Logger)

### Phase 2: 백엔드 모듈화

- shared/ 유틸 분리 (hometax, ocr, pdf2png, file-utils)
- plugins/ 구조로 라우트 분리 (vat-notice, kakao-send, messages)
- 플러그인 자동 등록 로직

### Phase 3: 프론트엔드 전환

- core 컴포넌트 (Layout, Sidebar, Dashboard, LogViewer, ProgressBar)
- vat-notice 플러그인 (5개 Step 컴포넌트)
- kakao-send 플러그인 (독립 + 임베드)
- Tailwind 테마 마이그레이션 (기존 CSS 변수 → Tailwind config)

### Phase 4: 통합 & 정리

- Vite 빌드 → Express 서빙 연동
- 기존 index.html 제거
- 전체 동작 검증

---

## 8. Tailwind 테마 매핑

현재 CSS 변수를 Tailwind config로 마이그레이션한다:

```typescript
// client/tailwind.config.ts
export default {
  theme: {
    extend: {
      colors: {
        bg:       '#0f1117',
        surface:  '#1a1d27',
        surface2: '#22263a',
        border:   '#2e3350',
        accent:   '#4f7fff',
        accent2:  '#6ee7b7',
        text:     '#e8eaf6',
        muted:    '#7b82a8',
        danger:   '#f87171',
        success:  '#34d399',
      },
      borderRadius: {
        DEFAULT: '12px',
      },
    },
  },
};
```

사용 예: `bg-surface`, `text-muted`, `border-border`, `text-accent` 등.

---

## 9. 새 매크로 추가 가이드

예: "소득세 집계" 매크로 추가

1. **백엔드**: `server/plugins/income-tax/` 생성
   - `index.ts` — MacroPlugin 구현
   - `routes.ts` — API 라우트
   - `automation.ts` — 홈택스 소득세 스크래핑 (shared/hometax.ts 재사용)
   - `server/plugins/index.ts`에 import 추가

2. **프론트엔드**: `client/src/plugins/income-tax/` 생성
   - `index.ts` — MacroPagePlugin 구현
   - `IncomeTaxPage.tsx` — 메인 페이지
   - 카카오톡 전송이 필요하면 `<KakaoSendPage folder={...} />` 임베드
   - `client/src/plugins/index.ts`에 import 추가

3. 사이드바, 대시보드, 라우팅은 **자동 반영** — 추가 코드 불필요
