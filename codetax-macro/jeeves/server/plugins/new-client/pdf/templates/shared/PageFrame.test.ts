import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import * as React from 'react';
import { renderReact, closePdfRenderer } from '../../renderer';
import { PageFrame } from './PageFrame';

after(async () => {
  await closePdfRenderer();
});

test('PageFrame: 한글 본문이 PDF 로 렌더되고 폰트 임베드 수행', async () => {
  const buf = await renderReact(
    React.createElement(
      PageFrame,
      null,
      React.createElement('h1', null, '계약서 테스트 — 한글'),
    ),
  );
  assert.equal(buf.slice(0, 4).toString(), '%PDF');
  assert.ok(buf.length > 5000, `PDF unexpectedly small: ${buf.length}`);
});
