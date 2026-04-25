import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  BUNDLE_GROUPS,
  sanitizeFilename,
  assembleBundle,
  zipFiles,
} from './bundles';
import { closePdfRenderer } from './renderer';
import type { NewClientRecord } from '../types';

after(async () => {
  await closePdfRenderer();
});

test('BUNDLE_GROUPS: 4개 묶음 (contract/cms/consent/edi)', () => {
  assert.equal(BUNDLE_GROUPS.length, 4);
  assert.deepEqual(
    BUNDLE_GROUPS.map((g) => g.id).sort(),
    ['cms', 'consent', 'contract', 'edi'],
  );
});

test('sanitizeFilename: 공백→_, 특수문자 제거', () => {
  assert.equal(sanitizeFilename('(주) 길동/상점'), '(주)_길동상점');
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
  bizAddress: '서울시 강남구',
  bankName: '국민은행',
  accountNumber: '123-45-678901',
  bookkeepingFee: 100000,
  openDate: '2020-01-01',
};

test('assembleBundle(cms): 단일 페이지 PDF 반환', async () => {
  const cms = BUNDLE_GROUPS.find((g) => g.id === 'cms')!;
  const buf = await assembleBundle(cms, sampleRecord, '8001011234567');
  assert.equal(buf.slice(0, 4).toString(), '%PDF');
});

test('assembleBundle(contract): 표지+본문1+본문2 → 3페이지 병합 PDF', async () => {
  const c = BUNDLE_GROUPS.find((g) => g.id === 'contract')!;
  const buf = await assembleBundle(c, sampleRecord, '8001011234567');
  assert.equal(buf.slice(0, 4).toString(), '%PDF');
  const { PDFDocument } = await import('pdf-lib');
  const doc = await PDFDocument.load(buf);
  assert.equal(doc.getPageCount(), 3);
});

test('assembleBundle(edi): 국민+건강 → 2페이지 병합 PDF', async () => {
  const edi = BUNDLE_GROUPS.find((g) => g.id === 'edi')!;
  const buf = await assembleBundle(edi, sampleRecord, '8001011234567');
  const { PDFDocument } = await import('pdf-lib');
  const doc = await PDFDocument.load(buf);
  assert.equal(doc.getPageCount(), 2);
});

test('zipFiles: 입력 파일이 zip 안에 모두 존재', async () => {
  const zip = await zipFiles([
    { name: 'a.pdf', data: Buffer.from('aaa') },
    { name: 'b.pdf', data: Buffer.from('bbb') },
  ]);
  assert.equal(zip.slice(0, 2).toString(), 'PK');
});
