import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import * as React from 'react';
import { renderReact, closePdfRenderer } from '../renderer';
import { CMS } from './CMS';
import { Consent } from './Consent';
import { EdiKb } from './EdiKb';
import { EdiNhis } from './EdiNhis';
import { ContractCover } from './ContractCover';
import { ContractMain1 } from './ContractMain1';
import { ContractMain2 } from './ContractMain2';
import type { TemplateProps } from './shared/TemplateProps';
import type { NewClientRecord } from '../../types';

after(async () => {
  await closePdfRenderer();
});

const sampleRecord: NewClientRecord = {
  id: 'rec_test',
  companyName: '주식회사 코드택스',
  representative: '홍길동',
  businessScope: '기장',
  startDate: '2026-04-25',
  createdAt: '2026-04-25T00:00:00Z',
  checklist: {} as any,
  entityType: '법인',
  bizRegNumber: '1234567890',
  corpRegNumber: '0987654321',
  bizPhone: '02-1234-5678',
  bizAddress: '서울시 강남구 테헤란로 1',
  bankName: '국민은행',
  accountNumber: '123-45-678901',
  bookkeepingFee: 100000,
  openDate: '2020-01-01',
};

const sample: TemplateProps = {
  record: sampleRecord,
  rrn: '8001011234567',
  date: '2026년 04월 25일',
};

const components: Array<[string, (p: TemplateProps) => React.ReactElement]> = [
  ['CMS', CMS],
  ['Consent', Consent],
  ['EdiKb', EdiKb],
  ['EdiNhis', EdiNhis],
  ['ContractCover', ContractCover],
  ['ContractMain1', ContractMain1],
  ['ContractMain2', ContractMain2],
];

for (const [name, Component] of components) {
  test(`${name}: 샘플 데이터로 PDF 렌더`, async () => {
    const buf = await renderReact(React.createElement(Component, sample));
    assert.equal(buf.slice(0, 4).toString(), '%PDF', `${name} PDF 헤더 없음`);
    assert.ok(buf.length > 5000, `${name} PDF too small: ${buf.length}`);
  });
}
