import * as React from 'react';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';

const FONTS_DIR = path.join(__dirname, '..', '..', 'fonts');
const CSS_PATH = path.join(__dirname, 'fonts.css');

function fontUrl(...segments: string[]): string {
  return `file://${path.join(FONTS_DIR, ...segments)}`;
}

let cachedCss: string | null = null;
function loadFontsCss(): string {
  if (cachedCss) return cachedCss;
  cachedCss = readFileSync(CSS_PATH, 'utf-8')
    .replace('FONT_URL_HCR_REG', fontUrl('hcr-batang', 'HCRBatang.ttf'))
    .replace('FONT_URL_HCR_BOLD', fontUrl('hcr-batang', 'HCRBatang-Bold.ttf'))
    .replace('FONT_URL_PRE_REG', fontUrl('Pretendard-Regular.otf'))
    .replace('FONT_URL_PRE_BOLD', fontUrl('Pretendard-Bold.otf'));
  return cachedCss;
}

export interface PageMargin {
  top: string;
  right: string;
  bottom: string;
  left: string;
}

export interface PageFrameProps {
  margin?: PageMargin;
  size?: 'A4' | 'A3' | 'Letter';
  children: React.ReactNode;
}

const DEFAULT_MARGIN: PageMargin = {
  top: '15mm',
  right: '12mm',
  bottom: '15mm',
  left: '12mm',
};

export function PageFrame({
  margin = DEFAULT_MARGIN,
  size = 'A4',
  children,
}: PageFrameProps) {
  const pageCss = `@page { size: ${size}; margin: ${margin.top} ${margin.right} ${margin.bottom} ${margin.left}; }`;
  const fontsCss = loadFontsCss();
  return (
    <html lang="ko">
      <head>
        <meta charSet="utf-8" />
        <style dangerouslySetInnerHTML={{ __html: pageCss + '\n' + fontsCss }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
