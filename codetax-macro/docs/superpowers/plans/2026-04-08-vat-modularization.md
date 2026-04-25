# Jeeves VAT Modularization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the monolithic Jeeves app into a plugin-based architecture with Vite + React + TypeScript + Tailwind frontend and modular Express + TypeScript backend.

**Architecture:** Flat Module plugin pattern. Backend plugins implement `MacroPlugin` and register Express routes. Frontend plugins implement `MacroPagePlugin` and provide React page components. Both plugin registries auto-wire sidebar, dashboard, and routing.

**Tech Stack:** Vite, React 18, TypeScript, Tailwind CSS, zustand, react-router-dom, Express, Playwright, nut-js

---

## File Structure

### Backend (`server/`)

```
server/
├── package.json
├── tsconfig.json
├── index.ts                    # Express app entry, plugin loading, common routes
├── core/
│   ├── session.ts              # BrowserSession class (Playwright lifecycle)
│   ├── sse.ts                  # SSEManager class (client set + broadcast)
│   ├── logger.ts               # createLogger factory (log + logError via SSE)
│   └── errors.ts               # MacroError class + withErrorHandler
├── plugins/
│   ├── index.ts                # Export all plugins array
│   ├── types.ts                # MacroPlugin, ServerContext interfaces
│   ├── vat-notice/
│   │   ├── index.ts            # vatNoticePlugin object
│   │   ├── routes.ts           # /api/vat/* routes
│   │   ├── automation.ts       # processOneBusiness, downloadPDFsForBusinesses
│   │   └── config.ts           # MENU selectors, CROP_CONFIGS
│   ├── kakao-send/
│   │   ├── index.ts            # kakaoSendPlugin object
│   │   ├── routes.ts           # /api/kakao/* routes
│   │   ├── sender.ts           # runKakaoSend (nut-js)
│   │   └── scanner.ts          # scanKakaoTargets, scanDateFolders
│   └── messages/
│       ├── index.ts            # messagesPlugin object
│       └── routes.ts           # /api/messages CRUD
└── shared/
    ├── hometax.ts              # findSelector, clickSelector, fillSelector, normalizeBizNum
    ├── ocr.ts                  # Swift Vision OCR
    ├── pdf2png.ts              # PDF to PNG conversion
    └── file-utils.ts           # sanitizeName, date helpers
```

### Frontend (`client/`)

```
client/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.ts
├── postcss.config.js
├── index.html
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── index.css               # Tailwind directives + global styles
│   ├── core/
│   │   ├── types.ts            # Shared frontend types
│   │   ├── hooks/
│   │   │   ├── useSSE.ts
│   │   │   ├── useSession.ts
│   │   │   └── useApi.ts
│   │   ├── components/
│   │   │   ├── Layout.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   ├── Dashboard.tsx
│   │   │   ├── LogViewer.tsx
│   │   │   ├── ProgressBar.tsx
│   │   │   ├── ImagePopup.tsx
│   │   │   └── Toast.tsx
│   │   └── store/
│   │       └── sessionStore.ts
│   └── plugins/
│       ├── index.ts
│       ├── types.ts
│       ├── vat-notice/
│       │   ├── index.ts
│       │   ├── VatNoticePage.tsx
│       │   ├── steps/
│       │   │   ├── ExcelUpload.tsx
│       │   │   ├── HometaxLogin.tsx
│       │   │   ├── AutoCollection.tsx
│       │   │   ├── CollectionProgress.tsx
│       │   │   └── KakaoSendStep.tsx
│       │   ├── components/
│       │   │   ├── WorkflowBar.tsx
│       │   │   └── BusinessTable.tsx
│       │   └── hooks/
│       │       └── useVatWorkflow.ts
│       └── kakao-send/
│           ├── index.ts
│           ├── KakaoSendPage.tsx
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

---

## Phase 1: Project Structure Setup

### Task 1: Initialize Server TypeScript Project

**Files:**
- Create: `server/package.json`
- Create: `server/tsconfig.json`

- [ ] **Step 1: Create server/package.json**

```json
{
  "name": "jeeves-server",
  "version": "1.0.0",
  "description": "Jeeves server - CodeTax macro backend",
  "main": "index.ts",
  "scripts": {
    "dev": "tsx watch index.ts",
    "start": "tsx index.ts",
    "build": "tsc",
    "install:browser": "npx playwright install chromium"
  },
  "dependencies": {
    "express": "^4.18.2",
    "playwright": "^1.40.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/node": "^20.11.0",
    "tsx": "^4.7.0",
    "typescript": "^5.3.3"
  }
}
```

- [ ] **Step 2: Create server/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": ".",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["./**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: Install dependencies**

Run: `cd /Users/hany/workzone/codetax-macro/jeeves/server && npm install`
Expected: `node_modules` created, no errors

- [ ] **Step 4: Commit**

```bash
git add server/package.json server/tsconfig.json server/package-lock.json
git commit -m "chore: initialize server TypeScript project"
```

---

### Task 2: Initialize Client Vite + React + TypeScript + Tailwind Project

**Files:**
- Create: `client/package.json`
- Create: `client/vite.config.ts`
- Create: `client/tsconfig.json`
- Create: `client/tsconfig.app.json`
- Create: `client/tailwind.config.ts`
- Create: `client/postcss.config.js`
- Create: `client/index.html`
- Create: `client/src/main.tsx`
- Create: `client/src/index.css`
- Create: `client/src/App.tsx`

- [ ] **Step 1: Scaffold Vite project**

Run: `cd /Users/hany/workzone/codetax-macro/jeeves && npm create vite@latest client -- --template react-ts`
Expected: `client/` directory created with Vite boilerplate

- [ ] **Step 2: Install Tailwind CSS**

Run: `cd /Users/hany/workzone/codetax-macro/jeeves/client && npm install -D tailwindcss @tailwindcss/vite`
Expected: Dependencies added to package.json

- [ ] **Step 3: Install additional dependencies**

Run: `cd /Users/hany/workzone/codetax-macro/jeeves/client && npm install react-router-dom zustand xlsx && npm install -D @types/react-router-dom`
Expected: Dependencies added to package.json

- [ ] **Step 4: Create client/tailwind.config.ts**

```typescript
import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0f1117',
        surface: '#1a1d27',
        surface2: '#22263a',
        border: '#2e3350',
        accent: '#4f7fff',
        accent2: '#6ee7b7',
        text: '#e8eaf6',
        muted: '#7b82a8',
        danger: '#f87171',
        success: '#34d399',
      },
      borderRadius: {
        DEFAULT: '12px',
      },
    },
  },
  plugins: [],
};

export default config;
```

- [ ] **Step 5: Update client/vite.config.ts**

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3001',
      '/images': 'http://localhost:3001',
      '/card-images': 'http://localhost:3001',
    },
  },
});
```

- [ ] **Step 6: Replace client/src/index.css**

```css
@import 'tailwindcss';

@theme {
  --color-bg: #0f1117;
  --color-surface: #1a1d27;
  --color-surface2: #22263a;
  --color-border: #2e3350;
  --color-accent: #4f7fff;
  --color-accent2: #6ee7b7;
  --color-text: #e8eaf6;
  --color-muted: #7b82a8;
  --color-danger: #f87171;
  --color-success: #34d399;
}

body {
  font-family: 'Apple SD Gothic Neo', 'Malgun Gothic', -apple-system, sans-serif;
  background: var(--color-bg);
  color: var(--color-text);
  min-height: 100vh;
  margin: 0;
}
```

- [ ] **Step 7: Replace client/src/App.tsx with minimal shell**

```tsx
function App() {
  return (
    <div className="flex min-h-screen">
      <aside className="w-[220px] bg-surface border-r border-border p-6">
        <h1 className="text-xl font-extrabold text-white">
          <span className="text-accent">Jeeves</span>
        </h1>
        <p className="text-xs text-muted mt-1">CodeTax Macro</p>
      </aside>
      <main className="flex-1 p-8">
        <h2 className="text-lg font-bold">Setup Complete</h2>
      </main>
    </div>
  );
}

export default App;
```

- [ ] **Step 8: Replace client/src/main.tsx**

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
```

- [ ] **Step 9: Verify dev server starts**

Run: `cd /Users/hany/workzone/codetax-macro/jeeves/client && npm run dev`
Expected: Vite dev server starts on port 5173, browser shows dark sidebar with "Jeeves" logo and "Setup Complete"

- [ ] **Step 10: Commit**

```bash
git add client/
git commit -m "chore: initialize Vite + React + TypeScript + Tailwind client"
```

---

## Phase 2: Backend Modularization

### Task 3: Create Server Core Modules (types, errors, sse, logger)

**Files:**
- Create: `server/plugins/types.ts`
- Create: `server/core/errors.ts`
- Create: `server/core/sse.ts`
- Create: `server/core/logger.ts`

- [ ] **Step 1: Create server/plugins/types.ts**

```typescript
import type { Express, Request, Response, NextFunction } from 'express';

export type LogFn = (msg: string) => void;

export interface SessionStatus {
  loggedIn: boolean;
  isLoggingIn: boolean;
  isRunning: boolean;
  progress: {
    current: number;
    total: number;
    success: number;
    failed: number;
  };
}

export interface ServerContext {
  session: {
    browser: import('playwright').Browser | null;
    context: import('playwright').BrowserContext | null;
    page: import('playwright').Page | null;
    loggedIn: boolean;
    isLoggingIn: boolean;
    isRunning: boolean;
    stopRequested: boolean;
    progress: { current: number; total: number; success: number; failed: number };
    getStatus(): SessionStatus;
    reset(): void;
    close(): Promise<void>;
  };
  broadcast: (type: string, message: any) => void;
  log: LogFn;
  logError: LogFn;
}

export interface MacroPlugin {
  id: string;
  name: string;
  icon: string;
  status: 'ready' | 'coming-soon';
  registerRoutes(app: Express, ctx: ServerContext): void;
}

export type RequestHandler = (req: Request, res: Response, next: NextFunction) => Promise<void> | void;
```

- [ ] **Step 2: Create server/core/errors.ts**

```typescript
import type { Request, Response, NextFunction } from 'express';
import type { ServerContext, RequestHandler } from '../plugins/types';

export class MacroError extends Error {
  constructor(
    message: string,
    public code: string,
    public recoverable: boolean = false,
  ) {
    super(message);
    this.name = 'MacroError';
  }
}

export function withErrorHandler(
  ctx: ServerContext,
  handler: RequestHandler,
): (req: Request, res: Response, next: NextFunction) => void {
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
        const message = err instanceof Error ? err.message : String(err);
        ctx.logError(`unexpected error: ${message}`);
        res.status(500).json({ error: 'server error' });
      }
    }
  };
}
```

- [ ] **Step 3: Create server/core/sse.ts**

```typescript
import type { Response } from 'express';

export class SSEManager {
  private clients = new Set<Response>();

  addClient(res: Response): void {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    this.clients.add(res);
    res.req?.on('close', () => this.clients.delete(res));
  }

  broadcast(type: string, message: any): void {
    const data = JSON.stringify({
      type,
      message,
      time: new Date().toLocaleTimeString('ko-KR'),
    });
    for (const client of this.clients) {
      client.write(`data: ${data}\n\n`);
    }
  }
}
```

- [ ] **Step 4: Create server/core/logger.ts**

```typescript
import type { SSEManager } from './sse';
import type { LogFn } from '../plugins/types';

export function createLogger(sse: SSEManager): { log: LogFn; logError: LogFn } {
  const log: LogFn = (msg) => {
    console.log(msg);
    sse.broadcast('log', msg);
  };

  const logError: LogFn = (msg) => {
    console.error(msg);
    sse.broadcast('error', msg);
  };

  return { log, logError };
}
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `cd /Users/hany/workzone/codetax-macro/jeeves/server && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add server/plugins/types.ts server/core/
git commit -m "feat: add server core modules (types, errors, sse, logger)"
```

---

### Task 4: Create BrowserSession Class

**Files:**
- Create: `server/core/session.ts`

This extracts the session object + login logic from `src/server.js` and `src/login.js`.

- [ ] **Step 1: Create server/core/session.ts**

```typescript
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import type { LogFn, SessionStatus } from '../plugins/types';

const HOMETAX_URL = 'https://www.hometax.go.kr';
const LOGIN_TIMEOUT = 180_000;
const PAGE_TIMEOUT = 30_000;

export class BrowserSession {
  browser: Browser | null = null;
  context: BrowserContext | null = null;
  page: Page | null = null;
  loggedIn = false;
  isLoggingIn = false;
  isRunning = false;
  stopRequested = false;
  progress = { current: 0, total: 0, success: 0, failed: 0 };

  private onDisconnect: (() => void) | null = null;

  setOnDisconnect(cb: () => void): void {
    this.onDisconnect = cb;
  }

  getStatus(): SessionStatus {
    return {
      loggedIn: this.loggedIn,
      isLoggingIn: this.isLoggingIn,
      isRunning: this.isRunning,
      progress: { ...this.progress },
    };
  }

  async launch(log: LogFn): Promise<void> {
    log('browser launching...');
    try {
      this.browser = await chromium.launch({
        headless: false,
        channel: 'chrome',
        args: ['--start-maximized'],
      });
    } catch {
      log('system Chrome not found, using bundled Chromium');
      this.browser = await chromium.launch({
        headless: false,
        args: ['--start-maximized'],
      });
    }

    this.context = await this.browser.newContext({
      acceptDownloads: true,
      viewport: null,
    });
    this.page = await this.context.newPage();

    this.browser.on('disconnected', () => {
      log('browser disconnected');
      this.reset();
      this.onDisconnect?.();
    });
  }

  async waitForLogin(log: LogFn): Promise<void> {
    if (!this.page) throw new Error('Browser not launched');

    log('======================================');
    log(' login with certificate');
    log('======================================');
    log(`max wait: ${LOGIN_TIMEOUT / 1000 / 60} min`);

    try {
      await this.page.goto(HOMETAX_URL, {
        waitUntil: 'domcontentloaded',
        timeout: PAGE_TIMEOUT,
      });
    } catch {
      /* redirect ignored */
    }

    const startTime = Date.now();
    while (Date.now() - startTime < LOGIN_TIMEOUT) {
      try {
        const cookies = await this.page.context().cookies();
        const hasUserId = cookies.some((c) => c.name === 'nts_hometax:userId');
        if (hasUserId) {
          log('login confirmed');
          await this.page.waitForTimeout(1500);
          return;
        }
      } catch {
        /* ignore */
      }
      await this.page.waitForTimeout(2000);
    }

    throw new Error('login timeout');
  }

  reset(): void {
    this.browser = null;
    this.context = null;
    this.page = null;
    this.loggedIn = false;
    this.isLoggingIn = false;
    this.isRunning = false;
    this.stopRequested = false;
    this.progress = { current: 0, total: 0, success: 0, failed: 0 };
  }

  async close(): Promise<void> {
    try {
      if (this.browser) await this.browser.close();
    } catch {
      /* ignore */
    }
    this.reset();
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/hany/workzone/codetax-macro/jeeves/server && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add server/core/session.ts
git commit -m "feat: extract BrowserSession class from login/session logic"
```

---

### Task 5: Create Shared Utilities

**Files:**
- Create: `server/shared/hometax.ts`
- Create: `server/shared/file-utils.ts`
- Create: `server/shared/ocr.ts`
- Create: `server/shared/pdf2png.ts`

- [ ] **Step 1: Create server/shared/file-utils.ts**

```typescript
export function sanitizeName(name: string): string {
  return (name || '').replace(/[\\/:*?"<>|]/g, '_').trim() || 'unnamed';
}

export function getDateStr(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
}

export function normalizeBizNum(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length !== 10) throw new Error(`invalid biz number: "${raw}"`);
  return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
}
```

- [ ] **Step 2: Create server/shared/hometax.ts**

Extract `findSelector`, `clickSelector`, `fillSelector` from current `src/automation.js`:

```typescript
import type { Page, Frame } from 'playwright';

export async function findSelector(
  page: Page,
  selectorString: string,
  timeout = 5000,
): Promise<{ frame: Page | Frame; sel: string } | null> {
  const selectors = selectorString.split(', ');
  const frames: (Page | Frame)[] = [page, ...page.frames()];
  const perFrame = Math.max(300, Math.floor(timeout / frames.length));

  for (const frame of frames) {
    for (const sel of selectors) {
      try {
        await frame.waitForSelector(sel, { timeout: perFrame, state: 'visible' });
        return { frame, sel };
      } catch {
        /* next */
      }
    }
  }
  return null;
}

export async function clickSelector(
  page: Page,
  selectorString: string,
  timeout = 5000,
): Promise<boolean> {
  const result = await findSelector(page, selectorString, timeout);
  if (!result) return false;
  await result.frame.click(result.sel);
  return true;
}

export async function fillSelector(
  page: Page,
  selectorString: string,
  value: string,
  timeout = 5000,
): Promise<boolean> {
  const result = await findSelector(page, selectorString, timeout);
  if (!result) return false;
  await result.frame.evaluate(
    ({ sel, val }: { sel: string; val: string }) => {
      const el = document.querySelector(sel) as HTMLInputElement | null;
      if (!el) return;
      el.value = val;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    },
    { sel: result.sel, val: value },
  );
  return true;
}
```

- [ ] **Step 3: Create server/shared/ocr.ts**

Extract OCR logic from current `server.js` `/api/kakao/verify-image` route:

```typescript
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { exec } from 'child_process';

interface OcrResult {
  ok: boolean;
  text: string;
  amounts: string[];
  error?: string;
}

export function ocrVerifyImage(imagePath: string): Promise<OcrResult> {
  return new Promise((resolve) => {
    if (!imagePath || !fs.existsSync(imagePath)) {
      resolve({ ok: false, text: '', amounts: [], error: 'image file not found' });
      return;
    }

    const escaped = imagePath.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

    const swiftCode = `import Foundation
import Vision

let url = URL(fileURLWithPath: "${escaped}")
guard let handler = try? VNImageRequestHandler(url: url, options: [:]) else { exit(1) }

func ocr(region: CGRect) -> String {
  let sem = DispatchSemaphore(value: 0)
  var result = ""
  let req = VNRecognizeTextRequest { r, _ in
    let lines = (r.results as? [VNRecognizedTextObservation] ?? []).compactMap { $0.topCandidates(1).first?.string }
    result = lines.joined(separator: "\\n")
    sem.signal()
  }
  req.recognitionLevel = .accurate
  req.recognitionLanguages = ["ko-KR", "en-US"]
  req.regionOfInterest = region
  try? handler.perform([req])
  _ = sem.wait(timeout: .distantFuture)
  return result
}

let amountText = ocr(region: CGRect(x: 0.20, y: 0.15, width: 0.25, height: 0.12))
print(amountText)
`;

    const tmpScript = path.join(os.tmpdir(), `ocr_${Date.now()}.swift`);
    fs.writeFileSync(tmpScript, swiftCode, 'utf8');

    exec(`swift "${tmpScript}"`, { timeout: 30000 }, (err, stdout) => {
      try {
        fs.unlinkSync(tmpScript);
      } catch {
        /* ignore */
      }
      if (err) {
        resolve({ ok: false, text: '', amounts: [], error: 'OCR failed (Xcode CLT required)' });
        return;
      }
      const amounts = (stdout.match(/[\d,]{4,}/g) || []).map((s) => s.replace(/,/g, ''));
      resolve({ ok: true, text: stdout.trim(), amounts });
    });
  });
}
```

- [ ] **Step 4: Create server/shared/pdf2png.ts**

Copy from current `src/pdf2png.js` with TypeScript types:

```typescript
import { execFile } from 'child_process';
import * as path from 'path';
import type { LogFn } from '../plugins/types';

interface CropBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export function convertPdfToPng(
  pdfPath: string,
  log: LogFn = console.log,
  businessName = '',
  bizNo = '',
  cropBox: CropBox | null = null,
): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const dir = path.dirname(pdfPath);
    const digits = bizNo.replace(/\D/g, '');
    const outBase = businessName && digits ? `${businessName}_${digits}` : path.basename(pdfPath, '.pdf');

    const cropArgs = cropBox
      ? `${cropBox.left},${cropBox.top},${cropBox.right},${cropBox.bottom}`
      : '';

    const script = `
import sys
from pdf2image import convert_from_path
from PIL import Image

pdf_path = sys.argv[1]
out_dir = sys.argv[2]
base = sys.argv[3]
crop_arg = sys.argv[4] if len(sys.argv) > 4 else ''

pages = convert_from_path(pdf_path, dpi=150)
paths = []
for i, page in enumerate(pages):
    if crop_arg:
        l, t, r, b = map(int, crop_arg.split(','))
        page = page.crop((l, t, r, b))
    if len(pages) == 1:
        out = f"{out_dir}/{base}.png"
    else:
        out = f"{out_dir}/{base}_p{i+1}.png"
    page.save(out, 'PNG')
    paths.append(out)
    print(out)
`;

    const args = ['-c', script, pdfPath, dir, outBase];
    if (cropArgs) args.push(cropArgs);

    execFile('python3', args, (err, stdout) => {
      if (err) {
        log(`  PNG conversion failed: ${err.message}`);
        return reject(err);
      }
      const pngPaths = stdout.trim().split('\n').filter(Boolean);
      pngPaths.forEach((p) => log(`  PNG saved: ${path.basename(p)}`));
      resolve(pngPaths);
    });
  });
}
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `cd /Users/hany/workzone/codetax-macro/jeeves/server && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add server/shared/
git commit -m "feat: extract shared utilities (hometax, file-utils, ocr, pdf2png)"
```

---

### Task 6: Create vat-notice Backend Plugin

**Files:**
- Create: `server/plugins/vat-notice/config.ts`
- Create: `server/plugins/vat-notice/automation.ts`
- Create: `server/plugins/vat-notice/routes.ts`
- Create: `server/plugins/vat-notice/index.ts`

- [ ] **Step 1: Create server/plugins/vat-notice/config.ts**

```typescript
import * as path from 'path';

export const BASE_DOWNLOAD_DIR = path.resolve(__dirname, '../../src/images');

function getDateStr(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
}

export function getDownloadDir(): string {
  return path.join(BASE_DOWNLOAD_DIR, getDateStr());
}

export const MENU = {
  TAX_AGENT_TAB: 'a#mf_wfHeader_hdGrp921, a.w2group:has(span:has-text("세무대리")), a:has-text("세무대리/납세관리")',
  NOTICE_HISTORY_MENU: 'a:has-text("고지내역 조회"), a:has-text("고지내역조회"), li:has-text("고지내역 조회"), td:has-text("고지내역 조회")',
  BIZ_NUM_INPUT: '#mf_txppWframe_edtTxprNo, input[title*="주민(사업자)등록번호"], input[name*="bizNo"], input[id*="bizNo"]',
  SEARCH_BTN: '#mf_txppWframe_trigger15, button:has-text("조회"), input[value="조회"]',
  PRINT_NOTICE_BTN: 'button[title="납부서 새창"], button:has-text("납부서출력"), button:has-text("납부서 출력"), a:has-text("납부서출력"), a:has-text("납부서 출력")',
  PRINT_BTN: 'button:has-text("인쇄"), a:has-text("인쇄"), input[value="인쇄"]',
  TARGET_TAX_TYPE: '부가가치세',
};

export const CROP_CONFIGS: Record<string, { left: number; top: number; right: number; bottom: number }> = {
  '부가가치세_예정고지': { left: 225, top: 71, right: 1018, bottom: 530 },
};

export const DELAY_BETWEEN_BUSINESSES = 500;
```

- [ ] **Step 2: Create server/plugins/vat-notice/automation.ts**

This is a TypeScript conversion of the current `src/automation.js`. The file is large, so we port `navigateToNoticeHistoryPage`, `scrapeNoticeRows`, `clickPrintNoticeForTargetRow`, `savePageAsPNG`, `processOneBusiness`, and `downloadPDFsForBusinesses` with the same logic, referencing shared utilities.

```typescript
import * as path from 'path';
import * as fs from 'fs';
import type { Page } from 'playwright';
import { findSelector, clickSelector, fillSelector } from '../../shared/hometax';
import { sanitizeName, normalizeBizNum } from '../../shared/file-utils';
import { MENU, CROP_CONFIGS, DELAY_BETWEEN_BUSINESSES } from './config';
import type { LogFn } from '../types';

interface Business {
  name: string;
  bizNo: string;
  taxAmount?: number;
  groupName?: string;
}

interface DownloadResult {
  success: { name: string; bizNo: string; fileName: string; filePath: string }[];
  failed: { name: string; bizNo: string; reason: string }[];
}

async function navigateToNoticeHistoryPage(page: Page, log: LogFn): Promise<void> {
  log('navigating: tax agent > notice history');

  const clicked1 = await clickSelector(page, MENU.TAX_AGENT_TAB);
  if (!clicked1) {
    throw new Error('Cannot find tax agent tab. Check MENU.TAX_AGENT_TAB selectors.');
  }

  const found2 = await findSelector(page, MENU.NOTICE_HISTORY_MENU, 5000);
  if (!found2) throw new Error('Cannot find notice history menu.');
  await found2.frame.click(found2.sel);
  await page.waitForLoadState('networkidle').catch(() => {});
}

async function scrapeNoticeRows(page: Page, bizNo: string): Promise<any[]> {
  const bizDigits = bizNo ? bizNo.replace(/\D/g, '') : '';
  const frames = [page, ...page.frames()];

  for (const frame of frames) {
    try {
      const colMap = await frame.$$eval('tr', (trs: HTMLTableRowElement[]) => {
        for (const tr of trs) {
          const ths = [...tr.querySelectorAll('th')];
          if (ths.length < 6) continue;
          const headers = ths.map((th) => th.innerText.trim().replace(/\s+/g, ''));
          if (headers.some((h) => h.includes('결정구분') || h.includes('세목명'))) {
            const map: Record<string, number> = {};
            headers.forEach((h, i) => { map[h] = i; });
            return map;
          }
        }
        return null;
      });

      const rows = await frame.$$eval(
        'tr',
        (trs: HTMLTableRowElement[], colMap: Record<string, number> | null) => {
          return trs
            .filter((tr) => tr.querySelectorAll('td').length >= 6)
            .map((tr) => {
              const cells = [...tr.querySelectorAll('td')];
              const cellTexts = cells.map((c) => c.innerText.trim());

              if (colMap) {
                const get = (key: string) => {
                  const idx = colMap[key];
                  return idx != null ? cellTexts[idx] || '' : '';
                };
                return {
                  결정구분: get('결정구분'),
                  과세기간세목명: [get('과세기간'), get('세목명')].filter(Boolean).join(' ') || get('과세기간세목명'),
                  전자납부번호: get('전자납부번호'),
                  사업자번호: get('사업자번호') || get('사업자(주민)번호') || get('사업자번호(주민번호)'),
                  성명: get('성명') || get('성명(상호)') || get('상호(성명)'),
                  납부기한: get('납부기한'),
                  고지세액: get('고지세액'),
                  납부할세액: get('납부할세액'),
                };
              }

              let bizColIdx = -1;
              for (let i = 0; i < cellTexts.length; i++) {
                if (/^\d{3}-\d{2}-\d{5}$/.test(cellTexts[i])) {
                  bizColIdx = i;
                  break;
                }
              }

              if (bizColIdx >= 2 && bizColIdx + 3 < cellTexts.length) {
                return {
                  결정구분: cellTexts[0] || '',
                  과세기간세목명: cellTexts[1] || '',
                  전자납부번호: cellTexts[bizColIdx - 1] || '',
                  사업자번호: cellTexts[bizColIdx] || '',
                  성명: cellTexts[bizColIdx + 1] || '',
                  납부기한: cellTexts[bizColIdx + 2] || '',
                  고지세액: cellTexts[bizColIdx + 3] || '',
                  납부할세액: cellTexts[bizColIdx + 4] || '',
                };
              }

              return {
                결정구분: cellTexts[0] || '',
                과세기간세목명: cellTexts[1] || '',
                전자납부번호: cellTexts[2] || '',
                사업자번호: cellTexts[3] || '',
                성명: cellTexts[4] || '',
                납부기한: cellTexts[5] || '',
                고지세액: cellTexts[6] || '',
                납부할세액: cellTexts[7] || '',
              };
            })
            .filter((r) => r.결정구분 && r.결정구분 !== '결정구분');
        },
        colMap,
      );

      if (rows.length > 0) {
        if (bizDigits) {
          const filtered = rows.filter((r) => {
            const rowDigits = (r.사업자번호 || '').replace(/\D/g, '');
            return rowDigits === bizDigits;
          });
          if (filtered.length > 0) return filtered;
        }
        return rows;
      }
    } catch {
      /* next frame */
    }
  }
  return [];
}

async function clickPrintNoticeForTargetRow(
  page: Page,
  log: LogFn,
  targetRowText: string,
): Promise<Page | null> {
  log(`  searching print button for ${targetRowText}...`);

  const BTN_SEL =
    'button[title="납부서 새창"], button:has-text("납부서출력"), button:has-text("납부서 출력"), a:has-text("납부서출력")';

  const waitForPopup = page.context().waitForEvent('page', { timeout: 10000 }).catch(() => null);

  let clicked = false;
  const frames = [page, ...page.frames()];
  for (const frame of frames) {
    const targetRow = frame
      .locator('tr', { hasText: targetRowText })
      .filter({ hasText: MENU.TARGET_TAX_TYPE })
      .first();

    if ((await targetRow.count()) > 0) {
      const printBtn = targetRow.locator(BTN_SEL).first();
      if ((await printBtn.count()) > 0) {
        await printBtn.click();
        log('  print button clicked');
        clicked = true;
        break;
      }
    }
  }

  if (!clicked) {
    const result = await findSelector(page, MENU.PRINT_NOTICE_BTN, 3000);
    if (result) {
      await result.frame.click(result.sel);
      log('  print button clicked (fallback)');
      clicked = true;
    }
  }

  if (!clicked) throw new Error(`Cannot find print button for ${targetRowText}`);

  const popup = await waitForPopup;
  if (popup) {
    await popup.waitForLoadState('networkidle').catch(() => {});
    log('  popup opened');
    return popup;
  }
  return null;
}

async function savePageAsPNG(
  page: Page,
  bizNum: string,
  log: LogFn,
  downloadDir: string,
  cropBox: { left: number; top: number; right: number; bottom: number } | null = null,
): Promise<{ fileName: string; filePath: string }> {
  const fileName = `고지내역_부가가치세_${bizNum.replace(/-/g, '')}.png`;
  const filePath = path.join(downloadDir, fileName);

  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1000);

  const PAGE_W = 1242;
  const PAGE_H = 1756;
  await page.setViewportSize({ width: PAGE_W, height: PAGE_H });

  await page.screenshot({
    path: filePath,
    clip: { x: 0, y: 0, width: PAGE_W, height: Math.ceil(PAGE_H / 3) },
  });

  if (cropBox) {
    const { execFile } = require('child_process');
    await new Promise<void>((resolve, reject) => {
      const script = `
from PIL import Image
img = Image.open(r"${filePath}")
cropped = img.crop((${cropBox.left}, ${cropBox.top}, ${cropBox.right}, ${cropBox.bottom}))
cropped.save(r"${filePath}")
`;
      execFile('python3', ['-c', script], (err: Error | null) => (err ? reject(err) : resolve()));
    });
  }

  log(`  PNG saved: ${fileName}`);
  return { fileName, filePath };
}

async function processOneBusiness(
  page: Page,
  bizNum: string,
  log: LogFn,
  downloadDir: string,
  name: string,
  taxAmount = 0,
  groupName = '',
  targetRowText = '2026년1기분',
): Promise<{ fileName: string; filePath: string }> {
  const formatted = normalizeBizNum(bizNum);
  log(`processing: ${formatted}`);

  const bizDir = path.join(downloadDir, `${sanitizeName(name)}_${formatted.replace(/-/g, '')}`);
  fs.mkdirSync(bizDir, { recursive: true });

  const filled = await fillSelector(page, MENU.BIZ_NUM_INPUT, formatted.replace(/-/g, ''));
  if (!filled) throw new Error('Cannot find biz number input field.');

  const searched = await clickSelector(page, MENU.SEARCH_BTN);
  if (!searched) await page.keyboard.press('Enter');

  await page.waitForLoadState('networkidle').catch(() => {});

  const taxList = await scrapeNoticeRows(page, formatted);
  log(`  notice rows: ${taxList.length}`);

  const printPage = await clickPrintNoticeForTargetRow(page, log, targetRowText);
  const targetPage = printPage || page;

  await targetPage.waitForLoadState('networkidle').catch(() => {});
  await targetPage.evaluate(() => {
    const imgs = [...document.images];
    return Promise.all(
      imgs
        .filter((img) => !img.complete)
        .map((img) => new Promise((resolve) => { img.onload = img.onerror = resolve; })),
    );
  });

  const cropBox = CROP_CONFIGS['부가가치세_예정고지'];
  const result = await savePageAsPNG(targetPage, formatted, log, bizDir, cropBox);

  if (printPage) {
    await printPage.close().catch(() => {});
    log('  popup closed');
  }

  const info = {
    name,
    bizNo: formatted,
    taxAmount,
    groupName: formatted.replace(/-/g, ''),
    taxList,
    status: '대기중',
    savedAt: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(bizDir, 'info.json'), JSON.stringify(info, null, 2), 'utf8');

  return result;
}

export async function downloadPDFsForBusinesses(
  page: Page,
  businesses: Business[],
  isStopped: () => boolean,
  log: LogFn,
  logError: LogFn,
  downloadDir: string,
  taxYear: number = new Date().getFullYear(),
  taxPeriod: number = 1,
): Promise<DownloadResult> {
  const targetRowText = `${taxYear}년${taxPeriod}기분`;
  log(`query: ${targetRowText} VAT`);

  page.setDefaultTimeout(3000);
  await navigateToNoticeHistoryPage(page, log);

  const results: DownloadResult = { success: [], failed: [] };

  for (let i = 0; i < businesses.length; i++) {
    if (isStopped()) {
      log('stop requested');
      break;
    }

    const { name, bizNo, taxAmount = 0, groupName = '' } = businesses[i];
    log(`[${i + 1}/${businesses.length}] ${name} (${bizNo})`);

    try {
      const result = await processOneBusiness(page, bizNo, log, downloadDir, name, taxAmount, groupName, targetRowText);
      results.success.push({ name, bizNo, ...result });
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      logError(`failed (${name} / ${bizNo}): ${reason}`);
      results.failed.push({ name, bizNo, reason });

      if (reason.includes('Cannot find print button')) {
        try {
          const formatted = normalizeBizNum(bizNo);
          const bizDir = path.join(downloadDir, `${sanitizeName(name)}_${formatted.replace(/-/g, '')}`);
          if (fs.existsSync(bizDir)) {
            const infoPath = path.join(bizDir, 'info.json');
            let info: any = {};
            try { info = JSON.parse(fs.readFileSync(infoPath, 'utf8')); } catch {}
            Object.assign(info, {
              name,
              bizNo: formatted,
              taxAmount: info.taxAmount || 0,
              groupName: info.groupName || name,
              note: 'no notice found',
              status: '주의',
              updatedAt: new Date().toISOString(),
            });
            fs.writeFileSync(infoPath, JSON.stringify(info, null, 2), 'utf8');
          }
        } catch {}
      }
    }

    if (i < businesses.length - 1) {
      await page.waitForTimeout(DELAY_BETWEEN_BUSINESSES);
    }
  }

  log(`\ndone - success ${results.success.length} / failed ${results.failed.length}`);
  results.failed.forEach(({ name, bizNo, reason }) => logError(`  failed: ${name} (${bizNo}) - ${reason}`));

  return results;
}
```

- [ ] **Step 3: Create server/plugins/vat-notice/routes.ts**

```typescript
import * as path from 'path';
import * as fs from 'fs';
import type { Express } from 'express';
import type { ServerContext } from '../types';
import { withErrorHandler, MacroError } from '../../core/errors';
import { downloadPDFsForBusinesses } from './automation';
import { BASE_DOWNLOAD_DIR, getDownloadDir } from './config';

export function registerVatRoutes(app: Express, ctx: ServerContext): void {
  app.post('/api/vat/start', withErrorHandler(ctx, async (req, res) => {
    if (!ctx.session.loggedIn) {
      throw new MacroError('Login required', 'NOT_LOGGED_IN', true);
    }
    if (ctx.session.isRunning) {
      throw new MacroError('Already running', 'ALREADY_RUNNING', true);
    }

    const { businesses, dateFolder, taxYear, taxPeriod } = req.body;
    if (!Array.isArray(businesses) || businesses.length === 0) {
      throw new MacroError('Empty business list', 'EMPTY_LIST');
    }

    res.json({ ok: true, message: `${businesses.length} items starting` });

    ctx.session.isRunning = true;
    ctx.session.stopRequested = false;
    ctx.session.progress = { current: 0, total: businesses.length, success: 0, failed: 0 };
    ctx.broadcast('status', 'running');
    ctx.broadcast('progress', ctx.session.progress);

    const downloadDir = dateFolder
      ? path.join(BASE_DOWNLOAD_DIR, dateFolder)
      : getDownloadDir();
    fs.mkdirSync(downloadDir, { recursive: true });
    ctx.log(`folder: ${downloadDir}`);

    const resolvedYear = taxYear || new Date().getFullYear();
    const resolvedPeriod = taxPeriod || 1;
    fs.writeFileSync(
      path.join(downloadDir, 'session.json'),
      JSON.stringify({ taxYear: resolvedYear, taxPeriod: resolvedPeriod, startedAt: new Date().toISOString() }, null, 2),
      'utf8',
    );

    try {
      const results = await downloadPDFsForBusinesses(
        ctx.session.page!,
        businesses,
        () => ctx.session.stopRequested,
        (msg) => {
          ctx.log(msg);
          if (msg.startsWith('[')) {
            const m = msg.match(/^\[(\d+)\/(\d+)\]/);
            if (m) {
              ctx.session.progress.current = parseInt(m[1]);
              ctx.broadcast('progress', ctx.session.progress);
            }
          }
        },
        (msg) => {
          ctx.logError(msg);
          if (msg.startsWith('failed')) ctx.session.progress.failed++;
          ctx.broadcast('progress', ctx.session.progress);
        },
        downloadDir,
        resolvedYear,
        resolvedPeriod,
      );

      ctx.session.progress.success = results.success.length;
      ctx.session.progress.failed = results.failed.length;
      ctx.session.progress.current = businesses.length;
      ctx.broadcast('progress', ctx.session.progress);
      ctx.broadcast('done', `done - success ${results.success.length} / failed ${results.failed.length}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      ctx.logError(`error: ${message}`);
      ctx.broadcast('done', `error: ${message}`);
    } finally {
      ctx.session.isRunning = false;
      ctx.broadcast('status', 'logged-in');
    }
  }));

  app.post('/api/vat/stop', withErrorHandler(ctx, async (_req, res) => {
    if (!ctx.session.isRunning) {
      throw new MacroError('Not running', 'NOT_RUNNING', true);
    }
    ctx.session.stopRequested = true;
    ctx.log('stop requested');
    res.json({ ok: true });
  }));

  app.get('/api/vat/files', withErrorHandler(ctx, async (_req, res) => {
    if (!fs.existsSync(BASE_DOWNLOAD_DIR)) return res.json([]);

    const result: any[] = [];
    for (const dateDir of fs.readdirSync(BASE_DOWNLOAD_DIR).sort().reverse()) {
      const full = path.join(BASE_DOWNLOAD_DIR, dateDir);
      if (!fs.statSync(full).isDirectory()) continue;

      const files = fs.readdirSync(full)
        .filter((f) => f.endsWith('.pdf') || f.endsWith('.png'))
        .map((f) => ({
          name: f,
          date: dateDir,
          type: f.endsWith('.pdf') ? 'pdf' : 'png',
          url: `/downloads/${dateDir}/${encodeURIComponent(f)}`,
          size: fs.statSync(path.join(full, f)).size,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

      if (files.length > 0) result.push({ date: dateDir, files });
    }
    res.json(result);
  }));
}
```

- [ ] **Step 4: Create server/plugins/vat-notice/index.ts**

```typescript
import type { MacroPlugin } from '../types';
import { registerVatRoutes } from './routes';

export const vatNoticePlugin: MacroPlugin = {
  id: 'vat-notice',
  name: '부가가치세 예정고지',
  icon: '⚡',
  status: 'ready',
  registerRoutes: registerVatRoutes,
};
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `cd /Users/hany/workzone/codetax-macro/jeeves/server && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add server/plugins/vat-notice/
git commit -m "feat: create vat-notice backend plugin"
```

---

### Task 7: Create kakao-send Backend Plugin

**Files:**
- Create: `server/plugins/kakao-send/scanner.ts`
- Create: `server/plugins/kakao-send/sender.ts`
- Create: `server/plugins/kakao-send/routes.ts`
- Create: `server/plugins/kakao-send/index.ts`

- [ ] **Step 1: Create server/plugins/kakao-send/scanner.ts**

Port `scanDateFolders` and `scanKakaoTargets` from current `src/kakao.js`:

```typescript
import * as path from 'path';
import * as fs from 'fs';
import { BASE_DOWNLOAD_DIR } from '../vat-notice/config';

export interface DateFolder {
  folder: string;
  bizCount: number;
  taxYear: number | null;
  taxPeriod: number | null;
  startedAt: string | null;
}

export interface KakaoTarget {
  name: string;
  bizNo: string;
  groupName: string;
  taxAmount: number;
  imageFile: string | null;
  imagePath: string | null;
  imageUrl: string | null;
  dateFolder: string;
  status: string;
  ocrStatus: string | null;
  ocrNote: string | null;
  ocrVerifiedAt: string | null;
  note: string | null;
  taxList: any[];
  taxYear: number;
  taxPeriod: number;
}

export function scanDateFolders(): DateFolder[] {
  const imagesDir = BASE_DOWNLOAD_DIR;
  if (!fs.existsSync(imagesDir)) return [];
  return fs
    .readdirSync(imagesDir)
    .filter((f) => /^\d{8}_\d{4}$/.test(f))
    .sort()
    .reverse()
    .map((folder) => {
      const folderPath = path.join(imagesDir, folder);
      const sessionPath = path.join(folderPath, 'session.json');
      let session: any = {};
      if (fs.existsSync(sessionPath)) {
        try { session = JSON.parse(fs.readFileSync(sessionPath, 'utf8')); } catch {}
      }
      const bizCount = fs.readdirSync(folderPath).filter((f) => {
        const fp = path.join(folderPath, f);
        return fs.statSync(fp).isDirectory() && /^\d{10}$/.test(f.split('_').pop()!);
      }).length;
      return {
        folder,
        bizCount,
        taxYear: session.taxYear || null,
        taxPeriod: session.taxPeriod || null,
        startedAt: session.startedAt || null,
      };
    });
}

export function scanKakaoTargets(targetFolder?: string): KakaoTarget[] {
  const imagesDir = BASE_DOWNLOAD_DIR;
  if (!fs.existsSync(imagesDir)) return [];

  const dateFolders = fs
    .readdirSync(imagesDir)
    .filter((f) => /^\d{8}_\d{4}$/.test(f))
    .sort()
    .reverse();

  if (dateFolders.length === 0) return [];

  const latestFolder = targetFolder || dateFolders[0];
  const latestPath = path.join(imagesDir, latestFolder);

  let sessionInfo = { taxYear: new Date().getFullYear(), taxPeriod: 1 };
  const sessionPath = path.join(latestPath, 'session.json');
  if (fs.existsSync(sessionPath)) {
    try { Object.assign(sessionInfo, JSON.parse(fs.readFileSync(sessionPath, 'utf8'))); } catch {}
  }

  const result: KakaoTarget[] = [];
  for (const folder of fs.readdirSync(latestPath).sort()) {
    const folderPath = path.join(latestPath, folder);
    if (!fs.statSync(folderPath).isDirectory()) continue;

    const lastUnderscore = folder.lastIndexOf('_');
    if (lastUnderscore === -1) continue;

    const name = folder.substring(0, lastUnderscore);
    const bizNoRaw = folder.substring(lastUnderscore + 1);
    if (!/^\d{10}$/.test(bizNoRaw)) continue;

    const bizNo = bizNoRaw.replace(/(\d{3})(\d{2})(\d{5})/, '$1-$2-$3');

    const pngs = fs.readdirSync(folderPath).filter((f) => f.toLowerCase().endsWith('.png')).sort();
    const imageFile = pngs.length > 0 ? pngs[0] : null;
    const imagePath = imageFile ? path.join(folderPath, imageFile) : null;
    const imageUrl = imageFile ? `/images/${latestFolder}/${folder}/${imageFile}` : null;

    let info: any = {};
    const infoPath = path.join(folderPath, 'info.json');
    if (fs.existsSync(infoPath)) {
      try { info = JSON.parse(fs.readFileSync(infoPath, 'utf8')); } catch {}
    }

    let note = info.note || null;
    if (!imageFile && !note) {
      note = '고지납부서 없음';
      try {
        const updated = { ...info, note, status: info.status || '주의', updatedAt: new Date().toISOString() };
        fs.writeFileSync(infoPath, JSON.stringify(updated, null, 2), 'utf8');
      } catch {}
    }

    result.push({
      name,
      bizNo,
      groupName: info.groupName || bizNoRaw,
      taxAmount: info.taxAmount || 0,
      imageFile,
      imagePath,
      imageUrl,
      dateFolder: latestFolder,
      status: info.status || 'pending',
      ocrStatus: info.ocrStatus || null,
      ocrNote: info.ocrNote || null,
      ocrVerifiedAt: info.ocrVerifiedAt || null,
      note,
      taxList: info.taxList || [],
      taxYear: sessionInfo.taxYear,
      taxPeriod: sessionInfo.taxPeriod,
    });
  }
  return result;
}
```

- [ ] **Step 2: Create server/plugins/kakao-send/sender.ts**

Port `runKakaoSend` from current `src/kakao.js`. This is the nut-js macro logic — kept as-is with TypeScript types:

```typescript
import * as path from 'path';
import * as fs from 'fs';
import { exec } from 'child_process';

const NUT_PATH = path.resolve(__dirname, '../../../../kakao-automation/node_modules/@computer-use/nut-js');

function loadNutJs() {
  try {
    return require(NUT_PATH);
  } catch (e: any) {
    throw new Error(`nut-js load failed. Run npm install in kakao-automation folder.\n${e.message}`);
  }
}

const runCommand = (cmd: string): Promise<string> =>
  new Promise((resolve, reject) => {
    exec(cmd, (error, stdout) => {
      if (error) reject(error);
      else resolve(stdout);
    });
  });

interface SendTarget {
  name: string;
  bizNo: string;
  groupName: string;
  imagePath: string | null;
}

interface SendStats {
  success: number;
  failed: number;
  skipped: number;
}

export async function runKakaoSend(
  targets: SendTarget[],
  message: string,
  cardImagePath: string,
  isStopped: () => boolean,
  log: (msg: string) => void,
  onStatus: (bizNo: string, status: string) => void,
): Promise<SendStats> {
  const { keyboard, Key, sleep } = loadNutJs();
  keyboard.config.autoDelayMs = 50;

  const wait = (ms: number) => sleep(ms);
  const randomWait = (min: number, max: number) =>
    sleep(Math.floor(Math.random() * (max - min + 1)) + min);

  const DELAY = {
    appLaunch: 3000,
    afterShortcut: 800,
    afterSearch: 1500,
    afterOpenChat: 1000,
    afterImageAttach: 2000,
  };

  const stats: SendStats = { success: 0, failed: 0, skipped: 0 };

  log('launching KakaoTalk...');
  await runCommand('open -a KakaoTalk');
  await wait(DELAY.appLaunch);
  await runCommand(`osascript -e 'tell application "KakaoTalk" to activate'`);
  await wait(1000);
  log('KakaoTalk ready');

  log('opening chat list (Cmd+2)');
  await keyboard.pressKey(Key.LeftSuper, Key.Digit2);
  await keyboard.releaseKey(Key.LeftSuper, Key.Digit2);
  await wait(DELAY.afterShortcut);

  for (let i = 0; i < targets.length; i++) {
    if (isStopped()) {
      log('stop requested');
      break;
    }
    const { name, bizNo, groupName, imagePath } = targets[i];
    log(`\n[${i + 1}/${targets.length}] ${name} (${bizNo}) -> ${groupName}`);
    onStatus(bizNo, 'sending');

    try {
      log(`  search (Cmd+F)`);
      await keyboard.pressKey(Key.LeftSuper, Key.F);
      await keyboard.releaseKey(Key.LeftSuper, Key.F);
      await wait(DELAY.afterShortcut);

      await keyboard.pressKey(Key.LeftSuper, Key.A);
      await keyboard.releaseKey(Key.LeftSuper, Key.A);
      await keyboard.pressKey(Key.Delete);
      await keyboard.releaseKey(Key.Delete);
      await wait(200);

      log(`  typing "${groupName}"...`);
      await keyboard.type(groupName);
      await wait(DELAY.afterSearch);

      let hasResult = true;
      try {
        const r = await runCommand(
          `osascript -e 'tell application "System Events" to tell process "KakaoTalk" to return (count of rows of table 1 of scroll area 1 of window 1) > 0'`,
        );
        hasResult = r.trim() === 'true';
      } catch {
        /* ignore */
      }

      if (!hasResult) {
        log(`  "${groupName}" not found, skipping`);
        await keyboard.pressKey(Key.Escape);
        await keyboard.releaseKey(Key.Escape);
        await wait(500);
        onStatus(bizNo, 'skipped');
        stats.skipped++;
        continue;
      }

      log(`  opening chat`);
      await keyboard.pressKey(Key.Down);
      await keyboard.releaseKey(Key.Down);
      await wait(300);
      await keyboard.pressKey(Key.Return);
      await keyboard.releaseKey(Key.Return);
      await wait(DELAY.afterOpenChat);

      if (message && message.trim()) {
        log(`  sending message...`);
        const tmpMsg = `/tmp/kakao_msg_${Date.now()}.txt`;
        fs.writeFileSync(tmpMsg, message.trim(), 'utf8');
        await runCommand(`pbcopy < "${tmpMsg}"`);
        try { fs.unlinkSync(tmpMsg); } catch {}
        await wait(200);
        await keyboard.pressKey(Key.LeftSuper, Key.V);
        await keyboard.releaseKey(Key.LeftSuper, Key.V);
        await wait(DELAY.afterOpenChat);
        await keyboard.pressKey(Key.Return);
        await keyboard.releaseKey(Key.Return);
        await randomWait(800, 1200);
        log(`  message sent`);
      }

      if (cardImagePath && fs.existsSync(cardImagePath)) {
        log(`  sending card image: ${path.basename(cardImagePath)}`);
        await runCommand(
          `osascript -e 'set the clipboard to (read (POSIX file "${cardImagePath}") as JPEG picture)'`,
        );
        await wait(500);
        await keyboard.pressKey(Key.LeftSuper, Key.V);
        await keyboard.releaseKey(Key.LeftSuper, Key.V);
        await wait(DELAY.afterImageAttach);
        await keyboard.type('\n');
        await randomWait(1000, 2000);
        log(`  card image sent`);
      }

      if (imagePath && fs.existsSync(imagePath)) {
        log(`  sending biz image: ${path.basename(imagePath)}`);
        await runCommand(
          `osascript -e 'set the clipboard to (read (POSIX file "${imagePath}") as JPEG picture)'`,
        );
        await wait(500);
        await keyboard.pressKey(Key.LeftSuper, Key.V);
        await keyboard.releaseKey(Key.LeftSuper, Key.V);
        await wait(DELAY.afterImageAttach);
        await keyboard.type('\n');
        await randomWait(1000, 2000);
        log(`  biz image sent`);
      } else {
        log(`  no biz image (path: ${imagePath || 'none'})`);
      }

      log(`  closing chat (Cmd+W)`);
      await keyboard.pressKey(Key.LeftSuper, Key.W);
      await keyboard.releaseKey(Key.LeftSuper, Key.W);
      await wait(500);

      log(`done [${i + 1}/${targets.length}] "${name}"`);
      onStatus(bizNo, 'done');
      stats.success++;
    } catch (err: any) {
      log(`failed "${name}": ${err.message}`);
      onStatus(bizNo, 'failed');
      stats.failed++;
    }

    if (i < targets.length - 1) {
      await randomWait(1000, 2000);
    }
  }

  log(`\nKakaoTalk send complete - success ${stats.success} / failed ${stats.failed} / skipped ${stats.skipped}`);
  return stats;
}
```

- [ ] **Step 3: Create server/plugins/kakao-send/routes.ts**

Port all `/api/kakao/*` routes from current `src/server.js`:

```typescript
import * as path from 'path';
import * as fs from 'fs';
import type { Express } from 'express';
import type { ServerContext } from '../types';
import { withErrorHandler, MacroError } from '../../core/errors';
import { ocrVerifyImage } from '../../shared/ocr';
import { scanDateFolders, scanKakaoTargets } from './scanner';
import { runKakaoSend } from './sender';
import { BASE_DOWNLOAD_DIR } from '../vat-notice/config';

const KAKAO_LOGS_DIR = path.resolve(__dirname, '../../src/../logs');
const CARD_IMAGES_BASE = path.resolve(__dirname, '../../src/images/cardImages');
const CARD_IMAGES_DIR = path.join(CARD_IMAGES_BASE, '부가가치세예정고지납부');

let kakaoRunning = false;
let kakaoStopRequested = false;

export function registerKakaoRoutes(app: Express, ctx: ServerContext): void {
  app.use('/card-images', require('express').static(CARD_IMAGES_BASE));

  app.get('/api/kakao/folders', (_req, res) => {
    res.json(scanDateFolders());
  });

  app.get('/api/kakao/targets', (req, res) => {
    const folder = (req.query.folder as string) || undefined;
    res.json(scanKakaoTargets(folder));
  });

  app.patch('/api/kakao/info', withErrorHandler(ctx, async (req, res) => {
    const { imagePath, fields } = req.body;
    if (!imagePath || !fields) throw new MacroError('missing parameters', 'MISSING_PARAMS');
    const infoPath = path.join(path.dirname(imagePath), 'info.json');
    if (!fs.existsSync(infoPath)) throw new MacroError('info.json not found', 'NOT_FOUND');
    const info = JSON.parse(fs.readFileSync(infoPath, 'utf8'));
    Object.assign(info, fields, { updatedAt: new Date().toISOString() });
    fs.writeFileSync(infoPath, JSON.stringify(info, null, 2), 'utf8');
    res.json({ ok: true });
  }));

  app.post('/api/kakao/fix-group-names', withErrorHandler(ctx, async (req, res) => {
    const { dateFolder } = req.body;
    const imagesDir = BASE_DOWNLOAD_DIR;

    let targetFolder = dateFolder;
    if (!targetFolder) {
      const folders = fs.readdirSync(imagesDir)
        .filter((f) => /^\d{8}_\d{4}$/.test(f))
        .sort().reverse();
      if (folders.length === 0) throw new MacroError('no date folder', 'NOT_FOUND');
      targetFolder = folders[0];
    }

    const folderPath = path.join(imagesDir, targetFolder);
    if (!fs.existsSync(folderPath)) throw new MacroError('folder not found', 'NOT_FOUND');

    const updated: string[] = [];
    const skipped: { bizNoRaw: string; reason: string }[] = [];

    for (const sub of fs.readdirSync(folderPath).sort()) {
      const subPath = path.join(folderPath, sub);
      if (!fs.statSync(subPath).isDirectory()) continue;
      const lastUnderscore = sub.lastIndexOf('_');
      if (lastUnderscore === -1) continue;
      const bizNoRaw = sub.substring(lastUnderscore + 1);
      if (!/^\d{10}$/.test(bizNoRaw)) continue;

      const infoPath = path.join(subPath, 'info.json');
      try {
        const info = fs.existsSync(infoPath)
          ? JSON.parse(fs.readFileSync(infoPath, 'utf8'))
          : {};
        info.groupName = bizNoRaw;
        info.updatedAt = new Date().toISOString();
        fs.writeFileSync(infoPath, JSON.stringify(info, null, 2), 'utf8');
        updated.push(bizNoRaw);
      } catch (e: any) {
        skipped.push({ bizNoRaw, reason: e.message });
      }
    }

    res.json({ ok: true, updated: updated.length, skipped: skipped.length, updatedList: updated });
  }));

  // Card images CRUD
  app.get('/api/kakao/card-images', (_req, res) => {
    if (!fs.existsSync(CARD_IMAGES_DIR)) return res.json([]);
    const files = fs.readdirSync(CARD_IMAGES_DIR)
      .filter((f) => /\.(png|jpg|jpeg|gif|webp)$/i.test(f))
      .map((f) => {
        const fp = path.join(CARD_IMAGES_DIR, f);
        return { name: f, mtime: fs.statSync(fp).mtimeMs, path: fp };
      })
      .sort((a, b) => b.mtime - a.mtime)
      .map(({ name, mtime, path: fp }) => ({
        name,
        mtime,
        url: `/card-images/${encodeURIComponent('부가가치세예정고지납부')}/${encodeURIComponent(name)}`,
        path: fp,
      }));
    res.json(files);
  });

  app.post('/api/kakao/card-images', withErrorHandler(ctx, async (req, res) => {
    const { filename, data } = req.body;
    if (!filename || !data) throw new MacroError('filename and data required', 'MISSING_PARAMS');
    const safe = path.basename(filename);
    if (!/\.(png|jpg|jpeg|gif|webp)$/i.test(safe)) throw new MacroError('image files only', 'INVALID_TYPE');
    fs.mkdirSync(CARD_IMAGES_DIR, { recursive: true });
    const buf = Buffer.from(data.replace(/^data:[^;]+;base64,/, ''), 'base64');
    const fp = path.join(CARD_IMAGES_DIR, safe);
    fs.writeFileSync(fp, buf);
    res.json({
      ok: true,
      name: safe,
      url: `/card-images/${encodeURIComponent('부가가치세예정고지납부')}/${encodeURIComponent(safe)}`,
      path: fp,
    });
  }));

  app.delete('/api/kakao/card-images/:filename', withErrorHandler(ctx, async (req, res) => {
    const filename = path.basename(req.params.filename);
    const filePath = path.join(CARD_IMAGES_DIR, filename);
    if (!fs.existsSync(filePath)) throw new MacroError('file not found', 'NOT_FOUND');
    fs.unlinkSync(filePath);
    res.json({ ok: true });
  }));

  // OCR verification
  app.post('/api/kakao/verify-image', withErrorHandler(ctx, async (req, res) => {
    const { imagePath } = req.body;
    const result = await ocrVerifyImage(imagePath);
    if (!result.ok) {
      res.status(result.error ? 400 : 500).json({ error: result.error });
      return;
    }
    res.json({ ok: true, text: result.text, bizNos: [], amounts: result.amounts });
  }));

  // Logs
  app.get('/api/kakao/logs', (_req, res) => {
    if (!fs.existsSync(KAKAO_LOGS_DIR)) return res.json([]);
    const files = fs.readdirSync(KAKAO_LOGS_DIR)
      .filter((f) => f.startsWith('kakao_') && f.endsWith('.log'))
      .sort().reverse()
      .map((f) => ({
        name: f,
        size: fs.statSync(path.join(KAKAO_LOGS_DIR, f)).size,
        mtime: fs.statSync(path.join(KAKAO_LOGS_DIR, f)).mtime,
      }));
    res.json(files);
  });

  app.get('/api/kakao/logs/:filename', (req, res) => {
    const filename = path.basename(req.params.filename);
    if (!filename.startsWith('kakao_') || !filename.endsWith('.log')) {
      return res.status(400).json({ error: 'invalid filename' });
    }
    const filePath = path.join(KAKAO_LOGS_DIR, filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'file not found' });
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(fs.readFileSync(filePath, 'utf8'));
  });

  // Start/Stop send
  app.post('/api/kakao/stop', withErrorHandler(ctx, async (_req, res) => {
    if (!kakaoRunning) throw new MacroError('not sending', 'NOT_RUNNING', true);
    kakaoStopRequested = true;
    ctx.log('kakao send stop requested');
    res.json({ ok: true });
  }));

  app.post('/api/kakao/start', withErrorHandler(ctx, async (req, res) => {
    if (kakaoRunning) throw new MacroError('already sending', 'ALREADY_RUNNING', true);

    const { targets, message = '', cardImagePath = '' } = req.body;
    if (!Array.isArray(targets) || targets.length === 0) {
      throw new MacroError('empty target list', 'EMPTY_LIST');
    }

    res.json({ ok: true });
    kakaoRunning = true;
    kakaoStopRequested = false;
    ctx.broadcast('kakao-status-update', { bizNo: null, status: 'running' });

    // Log file
    fs.mkdirSync(KAKAO_LOGS_DIR, { recursive: true });
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const ts = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
    const logFileName = `kakao_${ts}.log`;
    const logFilePath = path.join(KAKAO_LOGS_DIR, logFileName);

    const writeLog = (line: string) => {
      const time = new Date().toLocaleTimeString('ko-KR');
      fs.appendFileSync(logFilePath, `[${time}] ${line}\n`, 'utf8');
    };

    fs.writeFileSync(logFilePath, [
      `================================================`,
      ` KakaoTalk Send Log`,
      ` Started: ${now.toLocaleString('ko-KR')}`,
      ` Targets: ${targets.length}`,
      ` Message: ${message ? `"${message}"` : '(none)'}`,
      `================================================\n`,
    ].join('\n'), 'utf8');

    ctx.log(`log file: logs/${logFileName}`);

    try {
      const stats = await runKakaoSend(
        targets,
        message,
        cardImagePath,
        () => kakaoStopRequested,
        (msg) => { ctx.broadcast('kakao-log', msg); writeLog(msg); },
        (bizNo, status) => {
          ctx.broadcast('kakao-status-update', { bizNo, status });
          const t = targets.find((t: any) => t.bizNo.replace(/-/g, '') === bizNo.replace(/-/g, ''));
          if (t && t.imagePath) {
            const infoPath = path.join(path.dirname(t.imagePath), 'info.json');
            if (fs.existsSync(infoPath)) {
              try {
                const info = JSON.parse(fs.readFileSync(infoPath, 'utf8'));
                info.status = status;
                info.updatedAt = new Date().toISOString();
                fs.writeFileSync(infoPath, JSON.stringify(info, null, 2), 'utf8');
              } catch {}
            }
          }
        },
      );

      const endTime = new Date();
      const elapsed = Math.round((endTime.getTime() - now.getTime()) / 1000);
      const summary = stats
        ? `success ${stats.success} / failed ${stats.failed} / skipped ${stats.skipped}`
        : `${targets.length} processed`;

      fs.appendFileSync(logFilePath, [
        `\n================================================`,
        ` Completed: ${endTime.toLocaleString('ko-KR')}`,
        ` Elapsed: ${elapsed}s`,
        ` Result: ${summary}`,
        `================================================\n`,
      ].join('\n'), 'utf8');

      ctx.broadcast('kakao-done', `done - ${summary}`);
      ctx.log(`log saved: logs/${logFileName}`);
    } catch (err: any) {
      ctx.logError(`kakao error: ${err.message}`);
      writeLog(`error: ${err.message}`);
      ctx.broadcast('kakao-done', `error: ${err.message}`);
    } finally {
      kakaoRunning = false;
    }
  }));
}
```

- [ ] **Step 4: Create server/plugins/kakao-send/index.ts**

```typescript
import type { MacroPlugin } from '../types';
import { registerKakaoRoutes } from './routes';

export const kakaoSendPlugin: MacroPlugin = {
  id: 'kakao-send',
  name: '카카오톡 전송',
  icon: '💬',
  status: 'ready',
  registerRoutes: registerKakaoRoutes,
};
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `cd /Users/hany/workzone/codetax-macro/jeeves/server && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add server/plugins/kakao-send/
git commit -m "feat: create kakao-send backend plugin"
```

---

### Task 8: Create messages Backend Plugin + Plugin Registry + Server Entry

**Files:**
- Create: `server/plugins/messages/routes.ts`
- Create: `server/plugins/messages/index.ts`
- Create: `server/plugins/index.ts`
- Create: `server/index.ts`

- [ ] **Step 1: Create server/plugins/messages/routes.ts**

```typescript
import * as path from 'path';
import * as fs from 'fs';
import type { Express } from 'express';
import type { ServerContext } from '../types';

const MESSAGES_PATH = path.resolve(__dirname, '../../src/messages.json');

function readMessages(): string[] {
  try { return JSON.parse(fs.readFileSync(MESSAGES_PATH, 'utf8')); }
  catch { return []; }
}

function saveMessages(list: string[]): void {
  fs.writeFileSync(MESSAGES_PATH, JSON.stringify(list, null, 2), 'utf8');
}

export function registerMessageRoutes(app: Express, _ctx: ServerContext): void {
  app.get('/api/messages', (_req, res) => {
    res.json(readMessages());
  });

  app.post('/api/messages', (req, res) => {
    const { text } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ error: 'content required' });
    const list = readMessages();
    list.push(text.trim());
    saveMessages(list);
    res.json({ ok: true, index: list.length - 1, list });
  });

  app.put('/api/messages/:index', (req, res) => {
    const idx = parseInt(req.params.index);
    const { text } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ error: 'content required' });
    const list = readMessages();
    if (idx < 0 || idx >= list.length) return res.status(404).json({ error: 'not found' });
    list[idx] = text.trim();
    saveMessages(list);
    res.json({ ok: true, list });
  });

  app.delete('/api/messages/:index', (req, res) => {
    const idx = parseInt(req.params.index);
    const list = readMessages();
    if (idx < 0 || idx >= list.length) return res.status(404).json({ error: 'not found' });
    list.splice(idx, 1);
    saveMessages(list);
    res.json({ ok: true, list });
  });
}
```

- [ ] **Step 2: Create server/plugins/messages/index.ts**

```typescript
import type { MacroPlugin } from '../types';
import { registerMessageRoutes } from './routes';

export const messagesPlugin: MacroPlugin = {
  id: 'messages',
  name: 'Message Templates',
  icon: '📝',
  status: 'ready',
  registerRoutes: registerMessageRoutes,
};
```

- [ ] **Step 3: Create server/plugins/index.ts**

```typescript
import type { MacroPlugin } from './types';
import { vatNoticePlugin } from './vat-notice';
import { kakaoSendPlugin } from './kakao-send';
import { messagesPlugin } from './messages';

export const plugins: MacroPlugin[] = [
  vatNoticePlugin,
  kakaoSendPlugin,
  messagesPlugin,
];
```

- [ ] **Step 4: Create server/index.ts**

```typescript
import express from 'express';
import * as path from 'path';
import * as os from 'os';
import { BrowserSession } from './core/session';
import { SSEManager } from './core/sse';
import { createLogger } from './core/logger';
import { plugins } from './plugins';
import type { ServerContext } from './plugins/types';
import { BASE_DOWNLOAD_DIR } from './plugins/vat-notice/config';

const app = express();
const PORT = 3001;

app.use(express.json({ limit: '20mb' }));

// Static files
app.use('/images', express.static(BASE_DOWNLOAD_DIR));

// Serve client build in production
const clientDist = path.join(__dirname, '../client/dist');
app.use(express.static(clientDist));

// Core services
const session = new BrowserSession();
const sse = new SSEManager();
const { log, logError } = createLogger(sse);

const ctx: ServerContext = {
  session,
  broadcast: sse.broadcast.bind(sse),
  log,
  logError,
};

// SSE endpoint
app.get('/api/events', (req, res) => {
  sse.addClient(res);
});

// Session status
app.get('/api/status', (_req, res) => {
  res.json(session.getStatus());
});

// Login
app.post('/api/login', async (req, res) => {
  if (session.isLoggingIn) return res.status(409).json({ error: 'login in progress' });
  if (session.loggedIn) return res.status(409).json({ error: 'already logged in' });

  res.json({ ok: true });
  session.isLoggingIn = true;
  ctx.broadcast('status', 'logging-in');

  try {
    session.setOnDisconnect(() => {
      log('browser closed');
      ctx.broadcast('status', 'idle');
    });

    await session.launch(log);
    await session.waitForLogin(log);

    session.loggedIn = true;
    session.isLoggingIn = false;
    ctx.broadcast('status', 'logged-in');
    log('login complete');
  } catch (err: any) {
    logError(`login error: ${err.message}`);
    await session.close();
    ctx.broadcast('status', 'idle');
  }
});

// Logout
app.post('/api/logout', async (_req, res) => {
  await session.close();
  ctx.broadcast('status', 'idle');
  res.json({ ok: true });
});

// Register all plugin routes
for (const plugin of plugins) {
  plugin.registerRoutes(app, ctx);
}

// SPA fallback
app.get('*', (_req, res) => {
  const indexPath = path.join(clientDist, 'index.html');
  if (require('fs').existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).json({ error: 'client not built' });
  }
});

app.listen(PORT, () => {
  const nets = os.networkInterfaces();
  const localIP =
    Object.values(nets).flat().find((n) => n?.family === 'IPv4' && !n.internal)?.address || 'unknown';
  console.log(`\n========================================`);
  console.log(`  Jeeves server running`);
  console.log(`  Local:   http://localhost:${PORT}`);
  console.log(`  Network: http://${localIP}:${PORT}`);
  console.log(`========================================\n`);
});
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `cd /Users/hany/workzone/codetax-macro/jeeves/server && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Verify server starts**

Run: `cd /Users/hany/workzone/codetax-macro/jeeves/server && npm run dev`
Expected: Server starts on port 3001, prints startup banner

- [ ] **Step 7: Commit**

```bash
git add server/plugins/messages/ server/plugins/index.ts server/index.ts
git commit -m "feat: add messages plugin, plugin registry, and server entry point"
```

---

## Phase 3: Frontend Components

### Task 9: Create Frontend Core - Types, Store, Hooks

**Files:**
- Create: `client/src/plugins/types.ts`
- Create: `client/src/core/types.ts`
- Create: `client/src/core/store/sessionStore.ts`
- Create: `client/src/core/hooks/useApi.ts`
- Create: `client/src/core/hooks/useSSE.ts`
- Create: `client/src/core/hooks/useSession.ts`

- [ ] **Step 1: Create client/src/plugins/types.ts**

```typescript
import type { ComponentType } from 'react';

export interface MacroPagePlugin {
  id: string;
  name: string;
  icon: string;
  status: 'ready' | 'coming-soon';
  description: string;
  Page: ComponentType;
  badge?: string;
}
```

- [ ] **Step 2: Create client/src/core/types.ts**

```typescript
export interface SessionStatus {
  loggedIn: boolean;
  isLoggingIn: boolean;
  isRunning: boolean;
  progress: {
    current: number;
    total: number;
    success: number;
    failed: number;
  };
}

export interface SSEEvent {
  type: string;
  message: any;
  time: string;
}

export interface KakaoTarget {
  name: string;
  bizNo: string;
  groupName: string;
  taxAmount: number;
  imageFile: string | null;
  imagePath: string | null;
  imageUrl: string | null;
  dateFolder: string;
  status: string;
  ocrStatus: string | null;
  ocrNote: string | null;
  ocrVerifiedAt: string | null;
  note: string | null;
  taxList: any[];
  taxYear: number;
  taxPeriod: number;
}

export interface DateFolder {
  folder: string;
  bizCount: number;
  taxYear: number | null;
  taxPeriod: number | null;
  startedAt: string | null;
}
```

- [ ] **Step 3: Create client/src/core/store/sessionStore.ts**

```typescript
import { create } from 'zustand';
import type { SessionStatus } from '../types';

interface SessionState {
  status: SessionStatus;
  setStatus: (status: Partial<SessionStatus>) => void;
  reset: () => void;
}

const initialStatus: SessionStatus = {
  loggedIn: false,
  isLoggingIn: false,
  isRunning: false,
  progress: { current: 0, total: 0, success: 0, failed: 0 },
};

export const useSessionStore = create<SessionState>((set) => ({
  status: initialStatus,
  setStatus: (partial) =>
    set((state) => ({ status: { ...state.status, ...partial } })),
  reset: () => set({ status: initialStatus }),
}));
```

- [ ] **Step 4: Create client/src/core/hooks/useApi.ts**

```typescript
const API = `${window.location.origin}/api`;

export function useApi() {
  async function get<T = any>(path: string): Promise<T> {
    const res = await fetch(`${API}${path}`);
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
  }

  async function post<T = any>(path: string, body?: any): Promise<T> {
    const res = await fetch(`${API}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'unknown error' }));
      throw new Error(err.error || `API error: ${res.status}`);
    }
    return res.json();
  }

  async function put<T = any>(path: string, body?: any): Promise<T> {
    const res = await fetch(`${API}${path}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
  }

  async function patch<T = any>(path: string, body?: any): Promise<T> {
    const res = await fetch(`${API}${path}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
  }

  async function del<T = any>(path: string): Promise<T> {
    const res = await fetch(`${API}${path}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
  }

  return { get, post, put, patch, del };
}
```

- [ ] **Step 5: Create client/src/core/hooks/useSSE.ts**

```typescript
import { useEffect, useRef } from 'react';
import type { SSEEvent } from '../types';

const API = `${window.location.origin}/api`;

export function useSSE(onEvent: (event: SSEEvent) => void): void {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    const source = new EventSource(`${API}/events`);

    source.onmessage = (e) => {
      try {
        const data: SSEEvent = JSON.parse(e.data);
        onEventRef.current(data);
      } catch {
        /* ignore parse errors */
      }
    };

    return () => {
      source.close();
    };
  }, []);
}
```

- [ ] **Step 6: Create client/src/core/hooks/useSession.ts**

```typescript
import { useCallback } from 'react';
import { useSessionStore } from '../store/sessionStore';
import { useApi } from './useApi';

export function useSession() {
  const { status, setStatus } = useSessionStore();
  const api = useApi();

  const fetchStatus = useCallback(async () => {
    try {
      const data = await api.get('/status');
      setStatus(data);
    } catch {
      /* server offline */
    }
  }, [api, setStatus]);

  const login = useCallback(async () => {
    await api.post('/login');
  }, [api]);

  const logout = useCallback(async () => {
    await api.post('/logout');
    setStatus({ loggedIn: false, isLoggingIn: false, isRunning: false });
  }, [api, setStatus]);

  return { status, fetchStatus, login, logout, setStatus };
}
```

- [ ] **Step 7: Verify client compiles**

Run: `cd /Users/hany/workzone/codetax-macro/jeeves/client && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 8: Commit**

```bash
git add client/src/plugins/types.ts client/src/core/
git commit -m "feat: add frontend core types, store, and hooks"
```

---

### Task 10: Create Frontend Core Components (Layout, Sidebar, Dashboard)

**Files:**
- Create: `client/src/core/components/Layout.tsx`
- Create: `client/src/core/components/Sidebar.tsx`
- Create: `client/src/core/components/Dashboard.tsx`
- Create: `client/src/core/components/LogViewer.tsx`
- Create: `client/src/core/components/ProgressBar.tsx`
- Create: `client/src/core/components/ImagePopup.tsx`
- Create: `client/src/core/components/Toast.tsx`

- [ ] **Step 1: Create client/src/core/components/Sidebar.tsx**

```tsx
import { NavLink } from 'react-router-dom';
import type { MacroPagePlugin } from '../../plugins/types';

interface SidebarProps {
  plugins: MacroPagePlugin[];
}

export function Sidebar({ plugins }: SidebarProps) {
  return (
    <aside className="w-[220px] bg-surface border-r border-border flex flex-col shrink-0 py-6">
      <div className="px-5 pb-6 border-b border-border mb-4">
        <h1 className="text-[22px] font-extrabold tracking-tight text-white">
          <span className="text-accent">J</span>eeves
        </h1>
        <p className="text-[11px] text-muted mt-[3px]">CodeTax Macro</p>
      </div>

      <nav className="px-3 mb-2">
        <div className="text-[10px] uppercase tracking-widest text-muted px-2 mb-1.5">Home</div>
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            `flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13.5px] transition-all ${
              isActive
                ? 'bg-accent/15 text-accent font-semibold'
                : 'text-muted hover:bg-surface2 hover:text-text'
            }`
          }
        >
          <span className="text-base w-5 text-center">🏠</span>
          Dashboard
        </NavLink>
      </nav>

      <nav className="px-3 mb-2">
        <div className="text-[10px] uppercase tracking-widest text-muted px-2 mb-1.5">Macros</div>
        {plugins.map((p) => (
          <NavLink
            key={p.id}
            to={p.status === 'ready' ? `/${p.id}` : '#'}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13.5px] transition-all ${
                p.status === 'coming-soon'
                  ? 'opacity-40 cursor-default text-muted'
                  : isActive
                    ? 'bg-accent/15 text-accent font-semibold'
                    : 'text-muted hover:bg-surface2 hover:text-text'
              }`
            }
            onClick={(e) => p.status === 'coming-soon' && e.preventDefault()}
          >
            <span className="text-base w-5 text-center">{p.icon}</span>
            {p.name}
            {p.badge && (
              <span className="ml-auto bg-accent text-white text-[10px] px-1.5 py-px rounded-full">
                {p.badge}
              </span>
            )}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
```

- [ ] **Step 2: Create client/src/core/components/Dashboard.tsx**

```tsx
import { useNavigate } from 'react-router-dom';
import type { MacroPagePlugin } from '../../plugins/types';

interface DashboardProps {
  plugins: MacroPagePlugin[];
}

export function Dashboard({ plugins }: DashboardProps) {
  const navigate = useNavigate();

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-lg font-bold">Hello, Jeeves here</h2>
        <p className="text-sm text-muted mt-1">
          Automate your tax accounting tasks. Choose a macro below.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {plugins.map((p) => (
          <div
            key={p.id}
            onClick={() => p.status === 'ready' && navigate(`/${p.id}`)}
            className={`bg-surface border border-border rounded-xl p-6 transition-all ${
              p.status === 'ready'
                ? 'cursor-pointer hover:border-accent hover:shadow-lg hover:shadow-accent/10'
                : 'opacity-50 cursor-not-allowed'
            }`}
          >
            <div
              className={`inline-block text-[10px] px-2 py-0.5 rounded-full mb-3 ${
                p.status === 'ready'
                  ? 'bg-success/20 text-success'
                  : 'bg-muted/20 text-muted'
              }`}
            >
              {p.status === 'ready' ? 'Available' : 'Coming Soon'}
            </div>
            <div className="text-3xl mb-3">{p.icon}</div>
            <h3 className="font-bold text-sm mb-1">{p.name}</h3>
            <p className="text-xs text-muted">{p.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create client/src/core/components/Layout.tsx**

```tsx
import type { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import type { MacroPagePlugin } from '../../plugins/types';

interface LayoutProps {
  plugins: MacroPagePlugin[];
  children: ReactNode;
}

export function Layout({ plugins, children }: LayoutProps) {
  return (
    <div className="flex min-h-screen">
      <Sidebar plugins={plugins} />
      <main className="flex-1 p-8 overflow-y-auto">{children}</main>
    </div>
  );
}
```

- [ ] **Step 4: Create client/src/core/components/LogViewer.tsx**

```tsx
import { useEffect, useRef } from 'react';

interface LogEntry {
  type: 'info' | 'error' | 'success';
  message: string;
}

interface LogViewerProps {
  logs: LogEntry[];
  height?: string;
}

export function LogViewer({ logs, height = '200px' }: LogViewerProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [logs]);

  const colorMap = {
    info: 'text-text',
    error: 'text-danger',
    success: 'text-success',
  };

  return (
    <div
      ref={ref}
      className="bg-surface2 rounded-lg p-3.5 overflow-y-auto font-mono text-xs leading-7 whitespace-pre-wrap"
      style={{ height }}
    >
      {logs.map((log, i) => (
        <div key={i} className={colorMap[log.type]}>
          {log.message}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Create client/src/core/components/ProgressBar.tsx**

```tsx
interface ProgressBarProps {
  current: number;
  total: number;
  success: number;
  failed: number;
}

export function ProgressBar({ current, total, success, failed }: ProgressBarProps) {
  const pct = total ? Math.round((current / total) * 100) : 0;

  return (
    <div>
      <div className="bg-surface2 rounded-lg h-2.5 mb-4 overflow-hidden">
        <div
          className="h-full bg-accent rounded-lg transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex gap-5">
        <Stat value={total} label="Total" />
        <Stat value={success} label="Success" className="text-success" />
        <Stat value={failed} label="Failed" className="text-danger" />
        <Stat value={current} label="Current" className="text-accent" />
      </div>
    </div>
  );
}

function Stat({ value, label, className = '' }: { value: number; label: string; className?: string }) {
  return (
    <div className="text-center">
      <div className={`text-lg font-bold ${className}`}>{value}</div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  );
}
```

- [ ] **Step 6: Create client/src/core/components/ImagePopup.tsx**

```tsx
interface ImagePopupProps {
  src: string | null;
  onClose: () => void;
}

export function ImagePopup({ src, onClose }: ImagePopupProps) {
  if (!src) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[2000] bg-black/85 backdrop-blur-sm flex items-center justify-center cursor-zoom-out"
    >
      <img
        src={src}
        onClick={(e) => e.stopPropagation()}
        className="max-w-[90vw] max-h-[90vh] rounded-lg shadow-2xl object-contain cursor-default"
      />
      <button
        onClick={onClose}
        className="fixed top-5 right-6 bg-white/10 border border-white/20 text-white rounded-full w-9 h-9 text-lg cursor-pointer flex items-center justify-center"
      >
        x
      </button>
    </div>
  );
}
```

- [ ] **Step 7: Create client/src/core/components/Toast.tsx**

```tsx
import { useEffect, useState } from 'react';

interface ToastProps {
  message: string | null;
  duration?: number;
  onDone: () => void;
}

export function Toast({ message, duration = 2000, onDone }: ToastProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!message) return;
    setVisible(true);
    const timer = setTimeout(() => {
      setVisible(false);
      onDone();
    }, duration);
    return () => clearTimeout(timer);
  }, [message, duration, onDone]);

  if (!visible || !message) return null;

  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[3000] bg-surface border border-border text-text px-5 py-2.5 rounded-lg shadow-xl text-sm font-medium">
      {message}
    </div>
  );
}
```

- [ ] **Step 8: Verify client compiles**

Run: `cd /Users/hany/workzone/codetax-macro/jeeves/client && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 9: Commit**

```bash
git add client/src/core/components/
git commit -m "feat: add core UI components (Layout, Sidebar, Dashboard, LogViewer, ProgressBar, ImagePopup, Toast)"
```

---

### Task 11: Create Plugin Registry + App.tsx Wiring

**Files:**
- Create: `client/src/plugins/index.ts`
- Modify: `client/src/App.tsx`

- [ ] **Step 1: Create client/src/plugins/index.ts**

For now, register placeholder plugins. The actual page components will be built in subsequent tasks.

```typescript
import type { MacroPagePlugin } from './types';

// Placeholder pages - will be replaced in Tasks 12-13
function PlaceholderPage() {
  return <div className="text-muted">Coming soon...</div>;
}

export const plugins: MacroPagePlugin[] = [
  {
    id: 'vat-notice',
    name: '부가가치세 예정고지',
    icon: '⚡',
    status: 'ready',
    description: 'Excel upload -> HomeTax auto-collection -> KakaoTalk send',
    Page: PlaceholderPage,
    badge: 'NEW',
  },
  {
    id: 'kakao-send',
    name: '카카오톡 전송',
    icon: '💬',
    status: 'ready',
    description: 'Send images and messages to KakaoTalk group chats',
    Page: PlaceholderPage,
  },
  {
    id: 'income-tax',
    name: '소득세 집계',
    icon: '📊',
    status: 'coming-soon',
    description: 'HomeTax income data aggregation',
    Page: PlaceholderPage,
  },
  {
    id: 'withholding-tax',
    name: '원천세 정리',
    icon: '🧾',
    status: 'coming-soon',
    description: 'Withholding tax auto-classification',
    Page: PlaceholderPage,
  },
  {
    id: 'biz-lookup',
    name: '사업자 조회',
    icon: '🔍',
    status: 'coming-soon',
    description: 'Batch business number verification',
    Page: PlaceholderPage,
  },
];
```

- [ ] **Step 2: Update client/src/App.tsx**

```tsx
import { Routes, Route } from 'react-router-dom';
import { Layout } from './core/components/Layout';
import { Dashboard } from './core/components/Dashboard';
import { plugins } from './plugins';

function App() {
  return (
    <Layout plugins={plugins}>
      <Routes>
        <Route path="/" element={<Dashboard plugins={plugins} />} />
        {plugins
          .filter((p) => p.status === 'ready')
          .map((p) => (
            <Route key={p.id} path={`/${p.id}`} element={<p.Page />} />
          ))}
      </Routes>
    </Layout>
  );
}

export default App;
```

- [ ] **Step 3: Verify dev server renders correctly**

Run: `cd /Users/hany/workzone/codetax-macro/jeeves/client && npm run dev`
Expected: Browser shows dark UI with sidebar (Dashboard, macros listed), dashboard with plugin cards. Clicking "부가가치세 예정고지" navigates to placeholder page.

- [ ] **Step 4: Commit**

```bash
git add client/src/plugins/index.ts client/src/App.tsx
git commit -m "feat: add plugin registry and App routing"
```

---

### Task 12: Create vat-notice Frontend Plugin

**Files:**
- Create: `client/src/plugins/vat-notice/hooks/useVatWorkflow.ts`
- Create: `client/src/plugins/vat-notice/components/WorkflowBar.tsx`
- Create: `client/src/plugins/vat-notice/steps/ExcelUpload.tsx`
- Create: `client/src/plugins/vat-notice/steps/HometaxLogin.tsx`
- Create: `client/src/plugins/vat-notice/steps/AutoCollection.tsx`
- Create: `client/src/plugins/vat-notice/steps/CollectionProgress.tsx`
- Create: `client/src/plugins/vat-notice/steps/KakaoSendStep.tsx`
- Create: `client/src/plugins/vat-notice/VatNoticePage.tsx`
- Create: `client/src/plugins/vat-notice/index.ts`
- Modify: `client/src/plugins/index.ts`

This is a large task. Each step creates one file. All files port the existing index.html inline JS logic into React components.

- [ ] **Step 1: Create useVatWorkflow hook**

File: `client/src/plugins/vat-notice/hooks/useVatWorkflow.ts`

```typescript
import { useState, useCallback } from 'react';

export type VatStep = 1 | 2 | 3 | 4 | 5;

export function useVatWorkflow() {
  const [step, setStepRaw] = useState<VatStep>(() => {
    const saved = localStorage.getItem('wfStep');
    return (saved ? parseInt(saved) : 1) as VatStep;
  });

  const [dateFolder, setDateFolder] = useState<string | null>(
    () => localStorage.getItem('kakaoFolder'),
  );

  const setStep = useCallback((s: VatStep) => {
    setStepRaw(s);
    localStorage.setItem('wfStep', String(s));
  }, []);

  const startFresh = useCallback(() => {
    localStorage.removeItem('wfStep');
    localStorage.removeItem('kakaoFolder');
    localStorage.removeItem('kakaoFilter');
    setStepRaw(1);
    setDateFolder(null);
  }, []);

  const saveFolder = useCallback((folder: string) => {
    setDateFolder(folder);
    localStorage.setItem('kakaoFolder', folder);
  }, []);

  return { step, setStep, dateFolder, setDateFolder: saveFolder, startFresh };
}
```

- [ ] **Step 2: Create WorkflowBar**

File: `client/src/plugins/vat-notice/components/WorkflowBar.tsx`

```tsx
import type { VatStep } from '../hooks/useVatWorkflow';

interface WorkflowBarProps {
  currentStep: VatStep;
  onJumpToKakao: () => void;
}

const steps = [
  { num: 1, title: 'Excel Upload', sub: 'Set query criteria' },
  { num: 2, title: 'HomeTax Login', sub: 'Certificate auth' },
  { num: 3, title: 'Start Collection', sub: 'VAT notice query' },
  { num: 4, title: 'In Progress', sub: 'Saving notices' },
  { num: 5, title: 'KakaoTalk Send', sub: 'Group chat auto-send' },
];

export function WorkflowBar({ currentStep, onJumpToKakao }: WorkflowBarProps) {
  return (
    <div className="flex gap-0 mb-6 overflow-x-auto">
      {steps.map((s, i) => {
        const isDone = s.num < currentStep;
        const isActive = s.num === currentStep;
        const isKakao = s.num === 5;

        return (
          <div key={s.num} className="flex items-center">
            {i > 0 && <div className="text-muted text-lg px-1">›</div>}
            <div
              onClick={isKakao ? onJumpToKakao : undefined}
              className={`flex items-center gap-2.5 px-4 py-2.5 rounded-lg transition-all ${
                isKakao ? 'cursor-pointer' : ''
              } ${
                isActive
                  ? 'bg-accent/15 border border-accent/30'
                  : isDone
                    ? 'bg-success/10 border border-success/20'
                    : 'bg-surface2 border border-border'
              }`}
            >
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  isActive
                    ? 'bg-accent text-white'
                    : isDone
                      ? 'bg-success text-white'
                      : 'bg-border text-muted'
                }`}
              >
                {isDone ? '✓' : s.num}
              </div>
              <div>
                <div className={`text-xs font-semibold ${isActive ? 'text-accent' : isDone ? 'text-success' : 'text-muted'}`}>
                  {s.title}
                </div>
                <div className="text-[10px] text-muted">{s.sub}</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: Create ExcelUpload step**

File: `client/src/plugins/vat-notice/steps/ExcelUpload.tsx`

```tsx
import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';

interface Business {
  name: string;
  bizNo: string;
  taxAmount: number;
}

interface ExcelUploadProps {
  onParsed: (businesses: Business[], taxYear: number, taxPeriod: number) => void;
}

export function ExcelUpload({ onParsed }: ExcelUploadProps) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [taxYear, setTaxYear] = useState(() =>
    parseInt(localStorage.getItem('jeeves_tax_year') || '') || new Date().getFullYear(),
  );
  const [taxPeriod, setTaxPeriod] = useState(() =>
    parseInt(localStorage.getItem('jeeves_tax_period') || '') || 1,
  );
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const data = new Uint8Array(ev.target!.result as ArrayBuffer);
      const wb = XLSX.read(data, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const range = XLSX.utils.decode_range(ws['!ref']!);

      const results: Business[] = [];
      const seen = new Set<string>();

      for (let r = 1; r <= range.e.r; r++) {
        const targetCell = ws[XLSX.utils.encode_cell({ r, c: 0 })];
        if (!targetCell || String(targetCell.v).trim() !== '여') continue;

        const bizCell = ws[XLSX.utils.encode_cell({ r, c: 4 })];
        const nameCell = ws[XLSX.utils.encode_cell({ r, c: 5 })];
        const taxAmountCell = ws[XLSX.utils.encode_cell({ r, c: 7 })];
        if (!bizCell) continue;

        let bizNo = String(bizCell.v).replace(/[^0-9]/g, '');
        if (bizNo.length !== 10) continue;
        bizNo = `${bizNo.substring(0, 3)}-${bizNo.substring(3, 5)}-${bizNo.substring(5)}`;

        if (seen.has(bizNo)) continue;
        seen.add(bizNo);

        results.push({
          name: nameCell ? String(nameCell.v).trim() : '',
          bizNo,
          taxAmount: taxAmountCell ? Math.round(Number(taxAmountCell.v)) : 0,
        });
      }

      localStorage.setItem('jeeves_tax_year', String(taxYear));
      localStorage.setItem('jeeves_tax_period', String(taxPeriod));
      onParsed(results, taxYear, taxPeriod);
    };
    reader.readAsArrayBuffer(file);
  }

  return (
    <div className="bg-surface border border-border rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="bg-accent text-white text-[10px] px-2 py-0.5 rounded-full font-bold">STEP 1</span>
        <h3 className="font-bold text-sm">Excel Upload</h3>
      </div>

      <div className="flex items-center gap-2.5 mb-3.5">
        <span className="text-[13px] text-muted shrink-0">Query Criteria</span>
        <input
          type="number"
          value={taxYear}
          onChange={(e) => setTaxYear(parseInt(e.target.value))}
          min={2020}
          max={2040}
          className="w-[76px] bg-surface2 border border-border rounded-md text-text px-2.5 py-1.5 text-[13px] outline-none text-center"
        />
        <span className="text-[13px] text-muted">Year</span>
        <select
          value={taxPeriod}
          onChange={(e) => setTaxPeriod(parseInt(e.target.value))}
          className="bg-surface2 border border-border rounded-md text-text px-2.5 py-1.5 text-[13px] outline-none"
        >
          <option value={1}>Period 1 (April)</option>
          <option value={2}>Period 2 (October)</option>
        </select>
      </div>

      <div
        onClick={() => inputRef.current?.click()}
        className="border-2 border-dashed border-border rounded-xl p-7 text-center cursor-pointer hover:border-accent/50 transition-colors"
      >
        <input ref={inputRef} type="file" accept=".xlsx,.xls" onChange={handleFile} className="hidden" />
        <div className="text-3xl mb-2">📂</div>
        <h3 className="text-sm font-medium">Upload Excel</h3>
        {fileName && (
          <div className="mt-2 text-xs text-accent">📄 {fileName}</div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create HometaxLogin step**

File: `client/src/plugins/vat-notice/steps/HometaxLogin.tsx`

```tsx
import { useSession } from '../../../core/hooks/useSession';

interface HometaxLoginProps {
  onLoggedIn: () => void;
}

export function HometaxLogin({ onLoggedIn }: HometaxLoginProps) {
  const { status, login } = useSession();

  async function handleLogin() {
    try {
      await login();
    } catch (err: any) {
      console.error('Login error:', err.message);
    }
  }

  if (status.loggedIn) {
    onLoggedIn();
  }

  return (
    <div className="bg-surface border border-border rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="bg-accent text-white text-[10px] px-2 py-0.5 rounded-full font-bold">STEP 2</span>
        <h3 className="font-bold text-sm">HomeTax Login</h3>
        <span className={`text-[11px] px-2 py-0.5 rounded-full ${
          status.loggedIn ? 'bg-success/20 text-success' : 'bg-accent/20 text-accent'
        }`}>
          {status.loggedIn ? 'Session confirmed' : status.isLoggingIn ? 'Logging in...' : 'Waiting'}
        </span>
      </div>

      <div className="p-5 bg-surface2 rounded-lg text-[13.5px] leading-[1.9] text-muted">
        Login with your certificate in the Chrome window.
        <br />
        The next step will activate automatically after login.
      </div>

      {status.isLoggingIn && (
        <div className="mt-3 text-sm text-muted flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          Checking session...
        </div>
      )}

      <div className="mt-3">
        <button
          onClick={handleLogin}
          disabled={status.isLoggingIn || status.loggedIn}
          className="bg-accent text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-accent/90 transition-colors"
        >
          🔐 Start HomeTax Login
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Create AutoCollection step**

File: `client/src/plugins/vat-notice/steps/AutoCollection.tsx`

```tsx
import { useApi } from '../../../core/hooks/useApi';

interface Business {
  name: string;
  bizNo: string;
  taxAmount: number;
}

interface AutoCollectionProps {
  businesses: Business[];
  taxYear: number;
  taxPeriod: number;
  onStarted: () => void;
}

export function AutoCollection({ businesses, taxYear, taxPeriod, onStarted }: AutoCollectionProps) {
  const api = useApi();

  async function handleStart() {
    try {
      await api.post('/vat/start', {
        businesses: businesses.map((b) => ({
          ...b,
          groupName: b.name,
        })),
        taxYear,
        taxPeriod,
      });
      onStarted();
    } catch (err: any) {
      console.error('Start failed:', err.message);
    }
  }

  return (
    <div className="bg-surface border border-border rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="bg-accent text-white text-[10px] px-2 py-0.5 rounded-full font-bold">STEP 3</span>
        <h3 className="font-bold text-sm">Auto Collection</h3>
        <span className="bg-success/20 text-success text-[11px] px-2 py-0.5 rounded-full">
          Session confirmed
        </span>
      </div>

      <button
        onClick={handleStart}
        disabled={businesses.length === 0}
        className="bg-accent text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-accent/90 transition-colors"
      >
        ⬇ Start Collection ({businesses.length} items)
      </button>
    </div>
  );
}
```

- [ ] **Step 6: Create CollectionProgress step**

File: `client/src/plugins/vat-notice/steps/CollectionProgress.tsx`

```tsx
import { useState, useCallback } from 'react';
import { ProgressBar } from '../../../core/components/ProgressBar';
import { LogViewer } from '../../../core/components/LogViewer';
import { useSSE } from '../../../core/hooks/useSSE';
import { useApi } from '../../../core/hooks/useApi';
import type { SSEEvent } from '../../../core/types';

interface CollectionProgressProps {
  onDone: () => void;
}

export function CollectionProgress({ onDone }: CollectionProgressProps) {
  const api = useApi();
  const [progress, setProgress] = useState({ current: 0, total: 0, success: 0, failed: 0 });
  const [logs, setLogs] = useState<{ type: 'info' | 'error' | 'success'; message: string }[]>([]);
  const [running, setRunning] = useState(true);

  const handleEvent = useCallback((event: SSEEvent) => {
    if (event.type === 'progress') setProgress(event.message);
    if (event.type === 'log') setLogs((prev) => [...prev, { type: 'info', message: event.message }]);
    if (event.type === 'error') setLogs((prev) => [...prev, { type: 'error', message: event.message }]);
    if (event.type === 'done') {
      setLogs((prev) => [...prev, { type: 'success', message: event.message }]);
      setRunning(false);
      onDone();
    }
  }, [onDone]);

  useSSE(handleEvent);

  async function handleStop() {
    try {
      await api.post('/vat/stop');
      setRunning(false);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="bg-surface border border-border rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="bg-accent text-white text-[10px] px-2 py-0.5 rounded-full font-bold">STEP 4</span>
        <h3 className="font-bold text-sm">Collection Progress</h3>
        <span className="text-[11px] text-accent bg-accent/20 px-2 py-0.5 rounded-full">
          {progress.current}/{progress.total}
        </span>
        {running && (
          <button
            onClick={handleStop}
            className="ml-auto bg-danger text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-danger/90"
          >
            ⏹ Stop
          </button>
        )}
      </div>

      <ProgressBar {...progress} />

      <div className="mt-4">
        <div className="text-xs text-muted mb-1.5">Live Log</div>
        <LogViewer logs={logs} />
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Create KakaoSendStep step**

File: `client/src/plugins/vat-notice/steps/KakaoSendStep.tsx`

This is a thin wrapper that embeds the kakao-send plugin page. The actual KakaoSendPage will be built in Task 13.

```tsx
interface KakaoSendStepProps {
  dateFolder: string | null;
}

export function KakaoSendStep({ dateFolder }: KakaoSendStepProps) {
  // Will import and render KakaoSendPage from kakao-send plugin
  // For now, placeholder
  return (
    <div className="bg-surface border border-border rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="bg-accent text-white text-[10px] px-2 py-0.5 rounded-full font-bold">STEP 5</span>
        <h3 className="font-bold text-sm">KakaoTalk Send</h3>
      </div>
      <div className="text-muted text-sm">
        KakaoTalk send component will be embedded here. Folder: {dateFolder || 'latest'}
      </div>
    </div>
  );
}
```

- [ ] **Step 8: Create VatNoticePage**

File: `client/src/plugins/vat-notice/VatNoticePage.tsx`

```tsx
import { useCallback } from 'react';
import { useVatWorkflow } from './hooks/useVatWorkflow';
import { WorkflowBar } from './components/WorkflowBar';
import { ExcelUpload } from './steps/ExcelUpload';
import { HometaxLogin } from './steps/HometaxLogin';
import { AutoCollection } from './steps/AutoCollection';
import { CollectionProgress } from './steps/CollectionProgress';
import { KakaoSendStep } from './steps/KakaoSendStep';
import { useState } from 'react';

interface Business {
  name: string;
  bizNo: string;
  taxAmount: number;
}

export function VatNoticePage() {
  const { step, setStep, dateFolder, setDateFolder, startFresh } = useVatWorkflow();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [taxYear, setTaxYear] = useState(new Date().getFullYear());
  const [taxPeriod, setTaxPeriod] = useState(1);

  const handleExcelParsed = useCallback(
    (biz: Business[], year: number, period: number) => {
      setBusinesses(biz);
      setTaxYear(year);
      setTaxPeriod(period);
      setStep(2);
    },
    [setStep],
  );

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-lg font-bold">⚡ VAT Preliminary Notice Macro</h2>
        <p className="text-sm text-muted mt-1">
          Excel upload → HomeTax auto-collection → KakaoTalk send
        </p>
        <div className="flex gap-2 mt-2">
          <button
            onClick={startFresh}
            className="bg-accent text-white px-3 py-1.5 rounded-lg text-[13px] font-medium hover:bg-accent/90"
          >
            🚀 Start Fresh
          </button>
          <button
            onClick={() => setStep(5)}
            className="border border-border text-text px-3 py-1.5 rounded-lg text-[13px] font-medium hover:bg-surface2"
          >
            📂 Resume Previous
          </button>
        </div>
      </div>

      <WorkflowBar currentStep={step} onJumpToKakao={() => setStep(5)} />

      <div className="flex flex-col gap-4">
        {step >= 1 && step < 5 && <ExcelUpload onParsed={handleExcelParsed} />}
        {step >= 2 && step < 5 && <HometaxLogin onLoggedIn={() => step === 2 && setStep(3)} />}
        {step >= 3 && step < 5 && (
          <AutoCollection
            businesses={businesses}
            taxYear={taxYear}
            taxPeriod={taxPeriod}
            onStarted={() => setStep(4)}
          />
        )}
        {step === 4 && <CollectionProgress onDone={() => setStep(5)} />}
        {step === 5 && <KakaoSendStep dateFolder={dateFolder} />}
      </div>
    </div>
  );
}
```

- [ ] **Step 9: Create plugin index**

File: `client/src/plugins/vat-notice/index.ts`

```typescript
import type { MacroPagePlugin } from '../types';
import { VatNoticePage } from './VatNoticePage';

export const vatNoticePlugin: MacroPagePlugin = {
  id: 'vat-notice',
  name: '부가가치세 예정고지',
  icon: '⚡',
  status: 'ready',
  description: 'Excel upload → HomeTax auto-collection → KakaoTalk send',
  Page: VatNoticePage,
  badge: 'NEW',
};
```

- [ ] **Step 10: Update plugin registry**

Modify `client/src/plugins/index.ts`:

```typescript
import type { MacroPagePlugin } from './types';
import { vatNoticePlugin } from './vat-notice';

// Placeholder for future plugins
function PlaceholderPage() {
  return <div className="text-muted">Coming soon...</div>;
}

export const plugins: MacroPagePlugin[] = [
  vatNoticePlugin,
  {
    id: 'kakao-send',
    name: '카카오톡 전송',
    icon: '💬',
    status: 'ready',
    description: 'Send images and messages to KakaoTalk group chats',
    Page: PlaceholderPage,
  },
  {
    id: 'income-tax',
    name: '소득세 집계',
    icon: '📊',
    status: 'coming-soon',
    description: 'HomeTax income data aggregation',
    Page: PlaceholderPage,
  },
  {
    id: 'withholding-tax',
    name: '원천세 정리',
    icon: '🧾',
    status: 'coming-soon',
    description: 'Withholding tax auto-classification',
    Page: PlaceholderPage,
  },
  {
    id: 'biz-lookup',
    name: '사업자 조회',
    icon: '🔍',
    status: 'coming-soon',
    description: 'Batch business number verification',
    Page: PlaceholderPage,
  },
];
```

- [ ] **Step 11: Verify client compiles and renders**

Run: `cd /Users/hany/workzone/codetax-macro/jeeves/client && npx tsc --noEmit`
Expected: No errors

Run dev server and verify VAT notice page shows workflow bar and step components.

- [ ] **Step 12: Commit**

```bash
git add client/src/plugins/vat-notice/ client/src/plugins/index.ts
git commit -m "feat: create vat-notice frontend plugin with workflow steps"
```

---

### Task 13: Create kakao-send Frontend Plugin

**Files:**
- Create: `client/src/plugins/kakao-send/hooks/useKakaoTargets.ts`
- Create: `client/src/plugins/kakao-send/hooks/useKakaoSend.ts`
- Create: `client/src/plugins/kakao-send/components/TargetTable.tsx`
- Create: `client/src/plugins/kakao-send/components/MessagePanel.tsx`
- Create: `client/src/plugins/kakao-send/components/CardImagePanel.tsx`
- Create: `client/src/plugins/kakao-send/components/KakaoPreview.tsx`
- Create: `client/src/plugins/kakao-send/components/FilterBar.tsx`
- Create: `client/src/plugins/kakao-send/components/SendConfirmModal.tsx`
- Create: `client/src/plugins/kakao-send/KakaoSendPage.tsx`
- Create: `client/src/plugins/kakao-send/index.ts`
- Modify: `client/src/plugins/index.ts`
- Modify: `client/src/plugins/vat-notice/steps/KakaoSendStep.tsx`

This is the largest task. It ports the ~1200 lines of KakaoTalk UI from index.html into React components.

- [ ] **Step 1: Create useKakaoTargets hook**

File: `client/src/plugins/kakao-send/hooks/useKakaoTargets.ts`

```typescript
import { useState, useCallback } from 'react';
import { useApi } from '../../../core/hooks/useApi';
import type { KakaoTarget, DateFolder } from '../../../core/types';

export function useKakaoTargets() {
  const api = useApi();
  const [targets, setTargets] = useState<KakaoTarget[]>([]);
  const [loading, setLoading] = useState(false);

  const loadTargets = useCallback(async (folder?: string) => {
    setLoading(true);
    try {
      const url = folder ? `/kakao/targets?folder=${encodeURIComponent(folder)}` : '/kakao/targets';
      const data: KakaoTarget[] = await api.get(url);
      setTargets(data.sort((a, b) => (a.status === 'done' ? 1 : 0) - (b.status === 'done' ? 1 : 0)));
    } catch {
      setTargets([]);
    } finally {
      setLoading(false);
    }
  }, [api]);

  const loadFolders = useCallback(async (): Promise<DateFolder[]> => {
    return api.get('/kakao/folders');
  }, [api]);

  const updateInfo = useCallback(async (imagePath: string, fields: Record<string, any>) => {
    await api.patch('/kakao/info', { imagePath, fields });
  }, [api]);

  return { targets, setTargets, loading, loadTargets, loadFolders, updateInfo };
}
```

- [ ] **Step 2: Create useKakaoSend hook**

File: `client/src/plugins/kakao-send/hooks/useKakaoSend.ts`

```typescript
import { useState, useCallback } from 'react';
import { useApi } from '../../../core/hooks/useApi';

export function useKakaoSend() {
  const api = useApi();
  const [sending, setSending] = useState(false);

  const startSend = useCallback(async (targets: any[], message: string, cardImagePath: string) => {
    setSending(true);
    try {
      await api.post('/kakao/start', { targets, message, cardImagePath });
    } catch {
      setSending(false);
    }
  }, [api]);

  const stopSend = useCallback(async () => {
    try {
      await api.post('/kakao/stop');
    } catch {}
    setSending(false);
  }, [api]);

  return { sending, setSending, startSend, stopSend };
}
```

- [ ] **Step 3: Create FilterBar component**

File: `client/src/plugins/kakao-send/components/FilterBar.tsx`

```tsx
interface FilterBarProps {
  textFilter: string;
  onTextChange: (v: string) => void;
  imageFilter: string;
  onImageChange: (v: string) => void;
  statusFilter: string;
  onStatusChange: (v: string) => void;
  noteFilter: string;
  onNoteChange: (v: string) => void;
  noteOptions: string[];
  sortValue: string;
  onSortChange: (v: string) => void;
  shownCount: number;
  totalCount: number;
}

export function FilterBar(props: FilterBarProps) {
  const selectClass = 'bg-surface2 border border-border rounded-lg text-text py-[7px] px-2.5 text-[13px] outline-none';

  return (
    <div className="flex gap-2 flex-nowrap items-center mb-2.5">
      <span className="text-xs text-muted whitespace-nowrap">Filter:</span>
      <input
        type="text"
        placeholder="Search..."
        value={props.textFilter}
        onChange={(e) => props.onTextChange(e.target.value)}
        className="bg-surface2 border border-border rounded-lg text-text py-[7px] px-3 text-[13px] outline-none w-40"
      />
      <select value={props.imageFilter} onChange={(e) => props.onImageChange(e.target.value)} className={selectClass}>
        <option value="">Verify: All</option>
        <option value="ok">✅ Match</option>
        <option value="warn">⚠️ Warning</option>
      </select>
      <select value={props.noteFilter} onChange={(e) => props.onNoteChange(e.target.value)} className={selectClass}>
        <option value="">Notes: All</option>
        <option value="__none__">— None</option>
        {props.noteOptions.map((n) => (
          <option key={n} value={n}>{n}</option>
        ))}
      </select>
      <select value={props.statusFilter} onChange={(e) => props.onStatusChange(e.target.value)} className={selectClass}>
        <option value="">Status: All</option>
        <option value="done">Done</option>
        <option value="sending">Sending</option>
        <option value="failed">Failed</option>
        <option value="skipped">Skipped</option>
        <option value="pending">Pending</option>
      </select>
      <span className="text-xs text-muted whitespace-nowrap ml-4">Sort:</span>
      <select value={props.sortValue} onChange={(e) => props.onSortChange(e.target.value)} className={selectClass}>
        <option value="default">Default (done last)</option>
        <option value="status-asc">Status asc</option>
        <option value="status-desc">Status desc</option>
      </select>
      <span className="text-xs text-muted whitespace-nowrap">{props.shownCount} / {props.totalCount}</span>
    </div>
  );
}
```

- [ ] **Step 4: Create TargetTable component**

File: `client/src/plugins/kakao-send/components/TargetTable.tsx`

```tsx
import type { KakaoTarget } from '../../../core/types';

interface TargetTableProps {
  targets: KakaoTarget[];
  checkedKeys: Set<string>;
  onToggle: (key: string) => void;
  onToggleAll: (checked: boolean) => void;
  allChecked: boolean;
  onHover: (target: KakaoTarget) => void;
  onImageClick: (url: string) => void;
  onGroupNameChange: (key: string, value: string) => void;
  onGroupNameSave: (key: string, imagePath: string) => void;
  statusMap: Record<string, string>;
}

function formatTax(n: number) {
  return n ? Number(n).toLocaleString('ko-KR') + '원' : '—';
}

const statusStyles: Record<string, { bg: string; color: string; label: string }> = {
  done: { bg: 'bg-success/20', color: 'text-success', label: 'Done' },
  sending: { bg: 'bg-accent/20', color: 'text-accent', label: 'Sending' },
  failed: { bg: 'bg-danger/20', color: 'text-danger', label: 'Failed' },
  skipped: { bg: 'bg-yellow-400/20', color: 'text-yellow-400', label: 'Skipped' },
};

export function TargetTable(props: TargetTableProps) {
  return (
    <div className="overflow-y-auto flex-1" style={{ height: 0 }}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left">
            <th className="w-9 text-center p-2">
              <input
                type="checkbox"
                checked={props.allChecked}
                onChange={(e) => props.onToggleAll(e.target.checked)}
                className="w-[15px] h-[15px] cursor-pointer accent-accent"
              />
            </th>
            <th className="p-2">Name</th>
            <th className="p-2">Biz No</th>
            <th className="p-2">Group Chat</th>
            <th className="p-2">Tax Amount</th>
            <th className="p-2">Image</th>
            <th className="p-2">Verify</th>
            <th className="p-2">Notes</th>
            <th className="p-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {props.targets.map((t) => {
            const key = t.bizNo.replace(/-/g, '');
            const liveStatus = props.statusMap[key] || t.status;
            const style = statusStyles[liveStatus] || { bg: 'bg-muted/15', color: 'text-muted', label: 'Pending' };

            return (
              <tr
                key={key}
                onMouseEnter={() => props.onHover(t)}
                className={`border-b border-border/50 hover:bg-surface2/50 ${liveStatus === 'done' ? 'bg-success/[0.04]' : ''}`}
              >
                <td className="text-center p-2">
                  <input
                    type="checkbox"
                    checked={props.checkedKeys.has(key)}
                    onChange={() => props.onToggle(key)}
                    className="w-[15px] h-[15px] cursor-pointer accent-accent"
                  />
                </td>
                <td className="p-2">{t.name}</td>
                <td className="p-2 font-mono text-xs">{t.bizNo}</td>
                <td className="p-2">
                  <div className="flex gap-1 items-center">
                    <input
                      value={t.groupName}
                      onChange={(e) => props.onGroupNameChange(key, e.target.value)}
                      className="bg-surface2 border border-border rounded-md text-text px-2.5 py-1 text-[13px] flex-1 outline-none"
                    />
                    {t.imagePath && (
                      <button
                        onClick={() => props.onGroupNameSave(key, t.imagePath!)}
                        className="border border-border rounded-md text-[11px] px-2 py-1 text-muted hover:text-text shrink-0"
                      >
                        Save
                      </button>
                    )}
                  </div>
                </td>
                <td className="p-2 text-xs text-muted">{formatTax(t.taxAmount)}</td>
                <td className="p-2 text-xs">
                  {t.imageUrl ? (
                    <span
                      onClick={() => props.onImageClick(t.imageUrl!)}
                      className="text-accent cursor-pointer underline"
                    >
                      {t.imageFile}
                    </span>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
                <td className="p-2 text-xs text-center">
                  {t.ocrStatus === 'ok' ? (
                    <span className="text-success">✅</span>
                  ) : t.note ? (
                    <span className="text-danger">⚠️</span>
                  ) : !t.imageUrl ? (
                    <span className="text-danger">⚠️</span>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
                <td className="p-2 text-xs text-muted">{t.note || ''}</td>
                <td className="p-2">
                  <span className={`${style.bg} ${style.color} text-[11px] px-2 py-0.5 rounded-full`}>
                    {style.label}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 5: Create MessagePanel, CardImagePanel, KakaoPreview, SendConfirmModal**

File: `client/src/plugins/kakao-send/components/MessagePanel.tsx`

```tsx
import { useState, useEffect } from 'react';
import { useApi } from '../../../core/hooks/useApi';

interface MessagePanelProps {
  selectedMessage: string;
  onSelect: (msg: string, idx: number) => void;
}

export function MessagePanel({ selectedMessage, onSelect }: MessagePanelProps) {
  const api = useApi();
  const [messages, setMessages] = useState<string[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const [newMsg, setNewMsg] = useState('');

  useEffect(() => {
    api.get('/messages').then((data) => {
      setMessages(data);
      if (data.length > 0 && selectedIdx === -1) {
        setSelectedIdx(data.length - 1);
        onSelect(data[data.length - 1], data.length - 1);
      }
    });
  }, []);

  function select(idx: number) {
    if (selectedIdx === idx) {
      setSelectedIdx(-1);
      onSelect('', -1);
    } else {
      setSelectedIdx(idx);
      onSelect(messages[idx], idx);
    }
  }

  async function addMessage() {
    if (!newMsg.trim()) return;
    const data = await api.post('/messages', { text: newMsg.trim() });
    setMessages(data.list);
    setNewMsg('');
  }

  async function deleteMessage(idx: number) {
    const data = await api.del(`/messages/${idx}`);
    setMessages(data.list);
    if (selectedIdx === idx) { setSelectedIdx(-1); onSelect('', -1); }
    else if (selectedIdx > idx) setSelectedIdx(selectedIdx - 1);
  }

  return (
    <div className="mb-4">
      <div className="text-xs text-muted mb-2">
        Send Message <span className="text-border">(skip to send image only)</span>
      </div>
      <div className="flex flex-col gap-1.5 mb-2.5">
        {messages.map((msg, i) => (
          <div
            key={i}
            onClick={() => select(i)}
            className={`flex items-start gap-2 p-2.5 rounded-lg cursor-pointer border transition-all ${
              selectedIdx === i
                ? 'border-accent bg-accent/[0.08]'
                : 'border-border bg-surface2'
            }`}
          >
            <div className="flex-1 text-[13px] text-text leading-relaxed whitespace-pre-wrap">{msg}</div>
            <button
              onClick={(e) => { e.stopPropagation(); deleteMessage(i); }}
              className="text-muted text-[15px] hover:text-danger"
            >
              x
            </button>
          </div>
        ))}
      </div>
      <div className="flex gap-2 items-start">
        <textarea
          value={newMsg}
          onChange={(e) => setNewMsg(e.target.value)}
          rows={2}
          placeholder="New message..."
          className="flex-1 bg-surface2 border border-border rounded-lg text-text p-2 text-[13px] resize-y outline-none font-[inherit]"
        />
        <button
          onClick={addMessage}
          className="border border-border rounded-lg px-3 py-2 text-sm text-muted hover:text-text shrink-0"
        >
          + Add
        </button>
      </div>
    </div>
  );
}
```

File: `client/src/plugins/kakao-send/components/CardImagePanel.tsx`

```tsx
import { useState, useEffect } from 'react';
import { useApi } from '../../../core/hooks/useApi';

interface CardImage {
  name: string;
  url: string;
  path: string;
  mtime: number;
}

interface CardImagePanelProps {
  selected: CardImage | null;
  onSelect: (img: CardImage | null) => void;
}

export function CardImagePanel({ selected, onSelect }: CardImagePanelProps) {
  const api = useApi();
  const [images, setImages] = useState<CardImage[]>([]);

  async function load() {
    const data = await api.get('/kakao/card-images');
    setImages(data);
    if (!selected && data.length > 0) onSelect(data[0]);
  }

  useEffect(() => { load(); }, []);

  async function upload(files: FileList) {
    for (const file of Array.from(files)) {
      const data = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target!.result as string);
        reader.readAsDataURL(file);
      });
      await api.post('/kakao/card-images', { filename: file.name, data });
    }
    await load();
  }

  async function remove(name: string) {
    await api.del(`/kakao/card-images/${encodeURIComponent(name)}`);
    if (selected?.name === name) onSelect(null);
    await load();
  }

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2.5 mb-2">
        <span className="text-xs text-muted">Card Image <span className="text-border">(skip to not send)</span></span>
        <label className="cursor-pointer text-accent text-xs border border-accent rounded-md px-2.5 py-[3px]">
          + Upload
          <input type="file" accept="image/*" multiple onChange={(e) => e.target.files && upload(e.target.files)} className="hidden" />
        </label>
      </div>
      <div className="flex flex-wrap gap-2 min-h-[32px]">
        {images.length === 0 && <div className="text-muted text-[13px]">No card images uploaded.</div>}
        {images.map((img) => {
          const isSel = selected?.name === img.name;
          return (
            <div
              key={img.name}
              onClick={() => onSelect(isSel ? null : img)}
              className={`relative cursor-pointer w-20 h-20 border-2 rounded-lg overflow-hidden bg-surface2 shrink-0 ${
                isSel ? 'border-accent shadow-[0_0_0_2px_rgba(79,127,255,0.3)]' : 'border-border'
              }`}
            >
              <img src={img.url} className="w-full h-full object-cover" />
              {isSel && (
                <div className="absolute top-[3px] right-[3px] bg-accent rounded-full w-[18px] h-[18px] flex items-center justify-center text-[11px] text-white">
                  ✓
                </div>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); remove(img.name); }}
                className="absolute bottom-[3px] right-[3px] bg-black/65 border-none text-white rounded-full w-[18px] h-[18px] cursor-pointer text-[11px] flex items-center justify-center"
              >
                x
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

File: `client/src/plugins/kakao-send/components/KakaoPreview.tsx`

```tsx
interface KakaoPreviewProps {
  groupName: string;
  message: string;
  cardImageUrl: string | null;
  bizImageUrl: string | null;
}

export function KakaoPreview({ groupName, message, cardImageUrl, bizImageUrl }: KakaoPreviewProps) {
  const time = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="w-[260px] shrink-0 sticky top-0 self-start">
      <div className="text-xs text-muted mb-2">Send Preview</div>
      <div className="bg-[#1e1e1e] rounded-[14px] overflow-hidden border border-[#333] shadow-xl font-sans">
        {/* Window chrome */}
        <div className="bg-[#2a2a2a] px-3.5 py-2.5 flex items-center gap-1.5">
          <span className="w-[11px] h-[11px] rounded-full bg-[#ff5f56] inline-block" />
          <span className="w-[11px] h-[11px] rounded-full bg-[#ffbd2e] inline-block" />
          <span className="w-[11px] h-[11px] rounded-full bg-[#27c93f] inline-block" />
        </div>
        {/* Header */}
        <div className="bg-[#2a2a2a] px-3.5 py-2.5 flex items-center gap-2.5 border-b border-[#333]">
          <div className="w-9 h-9 rounded-full bg-[#444] flex items-center justify-center text-base shrink-0">👤</div>
          <div>
            <div className="text-[13px] font-semibold text-white">{groupName || '(group chat)'}</div>
            <div className="text-[11px] text-[#888]">KakaoTalk</div>
          </div>
        </div>
        {/* Chat area */}
        <div className="bg-[#0a0a0a] p-3.5 flex flex-col justify-end gap-1.5">
          {message && (
            <div className="flex flex-col items-end gap-0.5">
              <div className="bg-[#f9e000] text-[#2a2000] rounded-xl rounded-br-sm px-3 py-2 text-xs leading-relaxed max-w-[200px] break-all shadow-md whitespace-pre-wrap">
                {message}
              </div>
              <div className="text-[10px] text-[#555]">{time}</div>
            </div>
          )}
          {cardImageUrl && (
            <div className="flex flex-col items-end gap-0.5">
              <div className="bg-[#f9e000] rounded-xl rounded-br-sm overflow-hidden w-40 shadow-lg">
                <img src={cardImageUrl} className="w-full h-auto block" />
              </div>
            </div>
          )}
          <div className="flex flex-col items-end gap-0.5">
            <div className={`${bizImageUrl ? 'bg-[#f9e000]' : 'bg-[#222]'} rounded-xl rounded-br-sm overflow-hidden w-40 h-[200px] flex items-center justify-center shadow-lg`}>
              {bizImageUrl ? (
                <img src={bizImageUrl} className="w-full h-full object-cover" />
              ) : (
                <div className="text-[#555] text-[11px]">No image</div>
              )}
            </div>
            <div className="text-[10px] text-[#555]">{time}</div>
          </div>
        </div>
        {/* Input bar */}
        <div className="bg-[#1a1a1a] px-2.5 py-2 flex items-center gap-2 border-t border-[#333]">
          <div className="flex-1 bg-[#2a2a2a] rounded-[18px] px-3.5 py-[7px] text-xs text-[#555]">Message</div>
          <div className="bg-[#f9e000] rounded-lg px-3 py-1.5 text-xs font-bold text-[#3a3000]">Send</div>
        </div>
      </div>
    </div>
  );
}
```

File: `client/src/plugins/kakao-send/components/SendConfirmModal.tsx`

```tsx
import type { KakaoTarget } from '../../../core/types';

interface SendConfirmModalProps {
  targets: KakaoTarget[];
  message: string;
  cardImageName: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export function SendConfirmModal({ targets, message, cardImageName, onConfirm, onCancel }: SendConfirmModalProps) {
  const withImg = targets.filter((t) => t.imageUrl).length;
  const noImg = targets.length - withImg;

  return (
    <div
      onClick={onCancel}
      className="fixed inset-0 z-[1000] bg-black/65 backdrop-blur-sm flex items-center justify-center"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-surface border border-border rounded-2xl w-[620px] max-w-[90vw] max-h-[80vh] p-7 shadow-2xl flex flex-col"
      >
        <div className="flex items-center justify-between mb-4">
          <span className="text-base font-bold">💬 Confirm KakaoTalk Send</span>
          <button onClick={onCancel} className="text-muted text-xl cursor-pointer bg-transparent border-none">x</button>
        </div>

        <div className="text-[13px] text-muted mb-3">
          Total <b className="text-accent">{targets.length}</b> items
          {' '}(with image: {withImg}{noImg > 0 && <>, <span className="text-danger">no image: {noImg}</span></>})
        </div>

        {message ? (
          <div className="text-xs text-muted bg-surface2 rounded-lg p-2.5 mb-3 whitespace-pre-wrap">
            <b>Message:</b><br />{message}
          </div>
        ) : (
          <div className="text-xs text-yellow-400 mb-3">⚠ No message selected — images only</div>
        )}

        {cardImageName && (
          <div className="text-xs text-muted mb-3">Card image: <b>{cardImageName}</b></div>
        )}

        <div className="flex-1 overflow-y-auto max-h-[320px] mb-4">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left p-1">Name</th>
                <th className="text-left p-1">Biz No</th>
                <th className="text-left p-1">Chat</th>
                <th className="text-center p-1">Image</th>
              </tr>
            </thead>
            <tbody>
              {targets.map((t) => (
                <tr key={t.bizNo} className="border-b border-border/50">
                  <td className="p-1">{t.name}</td>
                  <td className="p-1 font-mono">{t.bizNo}</td>
                  <td className="p-1 text-muted">{t.groupName}</td>
                  <td className="p-1 text-center">{t.imageUrl ? '✅' : <span className="text-danger">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end gap-2.5">
          <button onClick={onCancel} className="border border-border rounded-lg px-4 py-2 text-sm text-muted hover:bg-surface2">
            Cancel
          </button>
          <button onClick={onConfirm} className="bg-accent text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-accent/90">
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Create KakaoSendPage**

File: `client/src/plugins/kakao-send/KakaoSendPage.tsx`

```tsx
import { useState, useEffect, useCallback } from 'react';
import { useKakaoTargets } from './hooks/useKakaoTargets';
import { useKakaoSend } from './hooks/useKakaoSend';
import { useSSE } from '../../core/hooks/useSSE';
import { TargetTable } from './components/TargetTable';
import { MessagePanel } from './components/MessagePanel';
import { CardImagePanel } from './components/CardImagePanel';
import { KakaoPreview } from './components/KakaoPreview';
import { FilterBar } from './components/FilterBar';
import { SendConfirmModal } from './components/SendConfirmModal';
import { LogViewer } from '../../core/components/LogViewer';
import { ImagePopup } from '../../core/components/ImagePopup';
import type { KakaoTarget, SSEEvent } from '../../core/types';

interface KakaoSendPageProps {
  folder?: string | null;
}

export function KakaoSendPage({ folder }: KakaoSendPageProps = {}) {
  const { targets, setTargets, loading, loadTargets, updateInfo } = useKakaoTargets();
  const { sending, setSending, startSend, stopSend } = useKakaoSend();

  // Selection
  const [checkedKeys, setCheckedKeys] = useState<Set<string>>(new Set());
  const [selectedMessage, setSelectedMessage] = useState('');
  const [selectedCard, setSelectedCard] = useState<any>(null);
  const [hoveredTarget, setHoveredTarget] = useState<KakaoTarget | null>(null);

  // Filter state
  const [textFilter, setTextFilter] = useState('');
  const [imageFilter, setImageFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [noteFilter, setNoteFilter] = useState('');
  const [sortValue, setSortValue] = useState('default');

  // UI state
  const [showConfirm, setShowConfirm] = useState(false);
  const [popupImage, setPopupImage] = useState<string | null>(null);
  const [logs, setLogs] = useState<{ type: 'info' | 'error' | 'success'; message: string }[]>([]);
  const [statusMap, setStatusMap] = useState<Record<string, string>>({});

  // Load targets on mount
  useEffect(() => {
    loadTargets(folder || undefined);
  }, [folder]);

  // Initialize checked keys
  useEffect(() => {
    const keys = new Set(
      targets.filter((t) => t.imageUrl && t.status !== 'done').map((t) => t.bizNo.replace(/-/g, '')),
    );
    setCheckedKeys(keys);
  }, [targets]);

  // SSE events
  const handleEvent = useCallback((event: SSEEvent) => {
    if (event.type === 'kakao-log') {
      setLogs((prev) => [...prev, { type: 'info', message: event.message }]);
    }
    if (event.type === 'kakao-status-update' && event.message?.bizNo) {
      setStatusMap((prev) => ({ ...prev, [event.message.bizNo.replace(/-/g, '')]: event.message.status }));
    }
    if (event.type === 'kakao-done') {
      setLogs((prev) => [...prev, { type: 'success', message: event.message }]);
      setSending(false);
      loadTargets(folder || undefined);
    }
  }, [folder]);

  useSSE(handleEvent);

  // Filter logic
  const noteOptions = [...new Set(targets.map((t) => t.note).filter(Boolean) as string[])].sort();

  const filteredTargets = targets.filter((t) => {
    const key = t.bizNo.replace(/-/g, '');
    if (textFilter && ![t.name, t.bizNo, t.groupName].some((v) => v.toLowerCase().includes(textFilter.toLowerCase()))) return false;
    if (imageFilter === 'ok' && t.ocrStatus !== 'ok') return false;
    if (imageFilter === 'warn' && !t.note && t.imageUrl) return false;
    const liveStatus = statusMap[key] || t.status;
    if (statusFilter && liveStatus !== statusFilter) return false;
    if (noteFilter === '__none__' && t.note) return false;
    if (noteFilter && noteFilter !== '__none__' && t.note !== noteFilter) return false;
    return true;
  });

  // Handlers
  function toggleCheck(key: string) {
    setCheckedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function handleGroupNameChange(key: string, value: string) {
    setTargets((prev) => prev.map((t) => (t.bizNo.replace(/-/g, '') === key ? { ...t, groupName: value } : t)));
  }

  async function handleGroupNameSave(key: string, imagePath: string) {
    const target = targets.find((t) => t.bizNo.replace(/-/g, '') === key);
    if (!target) return;
    await updateInfo(imagePath, { groupName: target.groupName });
  }

  function handleSend() {
    const sendTargets = targets.filter((t) => checkedKeys.has(t.bizNo.replace(/-/g, '')));
    if (sendTargets.length === 0) return;
    setShowConfirm(true);
  }

  async function confirmSend() {
    setShowConfirm(false);
    setLogs([]);
    const sendTargets = targets.filter((t) => checkedKeys.has(t.bizNo.replace(/-/g, '')));
    await startSend(sendTargets, selectedMessage, selectedCard?.path || '');
  }

  const allChecked = filteredTargets.length > 0 && filteredTargets.every((t) => checkedKeys.has(t.bizNo.replace(/-/g, '')));
  const preview = hoveredTarget || targets[0];

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <h3 className="font-bold text-sm">KakaoTalk Auto Send</h3>
        <button onClick={() => loadTargets(folder || undefined)} className="border border-border rounded-lg px-3 py-1 text-xs text-muted hover:text-text">
          🔄 Refresh
        </button>
        <button
          onClick={handleSend}
          disabled={sending || checkedKeys.size === 0}
          className="ml-auto bg-accent text-white px-4 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-accent/90"
        >
          💬 Send ({checkedKeys.size})
        </button>
        {sending && (
          <button onClick={stopSend} className="bg-danger text-white px-3 py-1.5 rounded-lg text-sm hover:bg-danger/90">
            ⏹ Stop
          </button>
        )}
      </div>

      <MessagePanel selectedMessage={selectedMessage} onSelect={(msg) => setSelectedMessage(msg)} />
      <CardImagePanel selected={selectedCard} onSelect={setSelectedCard} />

      {targets.length > 0 && (
        <FilterBar
          textFilter={textFilter} onTextChange={setTextFilter}
          imageFilter={imageFilter} onImageChange={setImageFilter}
          statusFilter={statusFilter} onStatusChange={setStatusFilter}
          noteFilter={noteFilter} onNoteChange={setNoteFilter}
          noteOptions={noteOptions}
          sortValue={sortValue} onSortChange={setSortValue}
          shownCount={filteredTargets.length} totalCount={targets.length}
        />
      )}

      <div className="flex gap-5 items-start">
        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          <TargetTable
            targets={filteredTargets}
            checkedKeys={checkedKeys}
            onToggle={toggleCheck}
            onToggleAll={(checked) => {
              const keys = new Set(checked ? filteredTargets.map((t) => t.bizNo.replace(/-/g, '')) : []);
              setCheckedKeys(keys);
            }}
            allChecked={allChecked}
            onHover={setHoveredTarget}
            onImageClick={setPopupImage}
            onGroupNameChange={handleGroupNameChange}
            onGroupNameSave={handleGroupNameSave}
            statusMap={statusMap}
          />
        </div>

        {preview && (
          <KakaoPreview
            groupName={preview.groupName}
            message={selectedMessage}
            cardImageUrl={selectedCard?.url || null}
            bizImageUrl={preview.imageUrl}
          />
        )}
      </div>

      {logs.length > 0 && (
        <div className="mt-4">
          <div className="text-xs text-muted mb-1.5">Send Log</div>
          <LogViewer logs={logs} height="260px" />
        </div>
      )}

      {showConfirm && (
        <SendConfirmModal
          targets={targets.filter((t) => checkedKeys.has(t.bizNo.replace(/-/g, '')))}
          message={selectedMessage}
          cardImageName={selectedCard?.name || null}
          onConfirm={confirmSend}
          onCancel={() => setShowConfirm(false)}
        />
      )}

      <ImagePopup src={popupImage} onClose={() => setPopupImage(null)} />
    </div>
  );
}
```

- [ ] **Step 7: Create kakao-send plugin index**

File: `client/src/plugins/kakao-send/index.ts`

```typescript
import type { MacroPagePlugin } from '../types';
import { KakaoSendPage } from './KakaoSendPage';

export const kakaoSendPlugin: MacroPagePlugin = {
  id: 'kakao-send',
  name: '카카오톡 전송',
  icon: '💬',
  status: 'ready',
  description: 'Send images and messages to KakaoTalk group chats',
  Page: KakaoSendPage,
};
```

- [ ] **Step 8: Update vat-notice KakaoSendStep to embed real component**

Replace `client/src/plugins/vat-notice/steps/KakaoSendStep.tsx`:

```tsx
import { KakaoSendPage } from '../../kakao-send/KakaoSendPage';

interface KakaoSendStepProps {
  dateFolder: string | null;
}

export function KakaoSendStep({ dateFolder }: KakaoSendStepProps) {
  return (
    <div className="bg-surface border border-border rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="bg-accent text-white text-[10px] px-2 py-0.5 rounded-full font-bold">STEP 5</span>
      </div>
      <KakaoSendPage folder={dateFolder} />
    </div>
  );
}
```

- [ ] **Step 9: Update plugin registry with real plugins**

Replace `client/src/plugins/index.ts`:

```typescript
import type { MacroPagePlugin } from './types';
import { vatNoticePlugin } from './vat-notice';
import { kakaoSendPlugin } from './kakao-send';

function PlaceholderPage() {
  return <div className="text-muted">Coming soon...</div>;
}

export const plugins: MacroPagePlugin[] = [
  vatNoticePlugin,
  kakaoSendPlugin,
  {
    id: 'income-tax',
    name: '소득세 집계',
    icon: '📊',
    status: 'coming-soon',
    description: 'HomeTax income data aggregation',
    Page: PlaceholderPage,
  },
  {
    id: 'withholding-tax',
    name: '원천세 정리',
    icon: '🧾',
    status: 'coming-soon',
    description: 'Withholding tax auto-classification',
    Page: PlaceholderPage,
  },
  {
    id: 'biz-lookup',
    name: '사업자 조회',
    icon: '🔍',
    status: 'coming-soon',
    description: 'Batch business number verification',
    Page: PlaceholderPage,
  },
];
```

- [ ] **Step 10: Verify client compiles**

Run: `cd /Users/hany/workzone/codetax-macro/jeeves/client && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 11: Commit**

```bash
git add client/src/plugins/kakao-send/ client/src/plugins/vat-notice/steps/KakaoSendStep.tsx client/src/plugins/index.ts
git commit -m "feat: create kakao-send frontend plugin with full UI"
```

---

## Phase 4: Integration & Cleanup

### Task 14: Build Integration & Verification

**Files:**
- Modify: `server/index.ts` (if needed for static serving adjustments)

- [ ] **Step 1: Build client**

Run: `cd /Users/hany/workzone/codetax-macro/jeeves/client && npm run build`
Expected: `client/dist/` created with index.html, JS/CSS bundles

- [ ] **Step 2: Start server and verify full app**

Run: `cd /Users/hany/workzone/codetax-macro/jeeves/server && npm run dev`
Expected: Server starts on port 3001. Open `http://localhost:3001` in browser and verify:
- Dashboard shows with plugin cards
- Sidebar navigation works
- VAT Notice page shows workflow steps
- KakaoTalk Send page shows (empty state if no data)

- [ ] **Step 3: Verify API endpoints work**

Run these curl commands:
```bash
curl http://localhost:3001/api/status
curl http://localhost:3001/api/kakao/folders
curl http://localhost:3001/api/messages
```
Expected: JSON responses with no errors

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: build integration - full app served from Express"
```

---

### Task 15: Clean Up Old Files

**Files:**
- Remove: `jeeves/src/server.js` (replaced by `server/index.ts`)
- Remove: `jeeves/src/automation.js` (replaced by `server/plugins/vat-notice/automation.ts`)
- Remove: `jeeves/src/kakao.js` (replaced by `server/plugins/kakao-send/`)
- Remove: `jeeves/src/login.js` (replaced by `server/core/session.ts`)
- Remove: `jeeves/src/config.js` (replaced by `server/plugins/vat-notice/config.ts`)
- Remove: `jeeves/src/pdf2png.js` (replaced by `server/shared/pdf2png.ts`)
- Remove: `jeeves/index.html` (replaced by `client/`)
- Modify: `jeeves/package.json` (update scripts to point to new server)

- [ ] **Step 1: Update root package.json**

Replace `jeeves/package.json`:

```json
{
  "name": "jeeves",
  "version": "2.0.0",
  "description": "CodeTax Macro App - Plugin Architecture",
  "scripts": {
    "dev": "cd server && npm run dev",
    "dev:client": "cd client && npm run dev",
    "start": "cd server && npm start",
    "build": "cd client && npm run build",
    "install:browser": "npx playwright install chromium",
    "postinstall": "cd server && npm install && cd ../client && npm install"
  }
}
```

- [ ] **Step 2: Remove old source files**

```bash
cd /Users/hany/workzone/codetax-macro/jeeves
rm -f src/server.js src/automation.js src/kakao.js src/login.js src/config.js src/pdf2png.js
rm -f index.html
```

- [ ] **Step 3: Verify the app still works**

Run: `cd /Users/hany/workzone/codetax-macro/jeeves && npm run build && npm start`
Expected: Client builds, server starts, app accessible at http://localhost:3001

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove old monolithic files, update root package.json"
```
