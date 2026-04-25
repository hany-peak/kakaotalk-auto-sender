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
