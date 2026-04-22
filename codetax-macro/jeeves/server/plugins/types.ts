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

export interface RunResult {
  status: 'success' | 'error';
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  summary: string;
  error?: string;
  meta?: Record<string, unknown>;
}

export interface PluginSchedule {
  defaultCron: string;
  defaultEnabled: boolean;
  timezone: string;
  run: (ctx: ServerContext) => Promise<RunResult>;
}

export interface MacroPlugin {
  id: string;
  name: string;
  icon: string;
  status: 'ready' | 'coming-soon';
  registerRoutes(app: Express, ctx: ServerContext): void;
  schedule?: PluginSchedule;
}

export type RequestHandler = (req: Request, res: Response, next: NextFunction) => Promise<void> | void;
