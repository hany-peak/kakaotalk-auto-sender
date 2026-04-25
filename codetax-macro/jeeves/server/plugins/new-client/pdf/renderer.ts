import { chromium, type Browser, type LaunchOptions } from 'playwright';
import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

let browserPromise: Promise<Browser> | null = null;

function launch(options?: LaunchOptions): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = chromium.launch({ headless: true, ...options });
  }
  return browserPromise;
}

export async function initPdfRenderer(): Promise<void> {
  await launch();
}

export async function closePdfRenderer(): Promise<void> {
  if (!browserPromise) return;
  const browser = await browserPromise;
  browserPromise = null;
  await browser.close();
}

export async function renderHtml(html: string): Promise<Buffer> {
  const browser = await launch();
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await page.setContent(html, { waitUntil: 'load' });
    await page.evaluate(async () => {
      await (document as any).fonts.ready;
    });
    const pdf = await page.pdf({ printBackground: true, preferCSSPageSize: true });
    return pdf;
  } finally {
    await context.close();
  }
}

export async function renderReact(element: ReactElement): Promise<Buffer> {
  const body = renderToStaticMarkup(element);
  const html =
    body.startsWith('<!doctype') || body.startsWith('<!DOCTYPE')
      ? body
      : `<!doctype html>${body}`;
  return renderHtml(html);
}
