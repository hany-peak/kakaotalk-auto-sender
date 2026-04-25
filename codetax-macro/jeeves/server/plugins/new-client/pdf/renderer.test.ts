import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { renderHtml, closePdfRenderer } from './renderer';

after(async () => {
  await closePdfRenderer();
});

test('renderHtml: 단순 HTML → PDF Buffer (PDF 헤더 검증)', async () => {
  const html = '<!doctype html><html><body><h1>안녕하세요</h1></body></html>';
  const buf = await renderHtml(html);
  assert.ok(buf.length > 1000, `PDF too small: ${buf.length}`);
  assert.equal(buf.slice(0, 4).toString(), '%PDF', 'PDF magic bytes 누락');
});
