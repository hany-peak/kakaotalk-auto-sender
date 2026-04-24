import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import { readFile } from 'node:fs/promises';
import * as path from 'node:path';
import { BUNDLE_GROUPS, splitForBundle, sanitizeFilename } from './contract-pdf';

const TEMPLATE = path.join(__dirname, 'references', 'sheet.xlsx');

test('BUNDLE_GROUPS: 4개 묶음, 모든 시트명이 템플릿에 존재', async () => {
  const raw = await readFile(TEMPLATE);
  const wb = XLSX.read(raw, { type: 'buffer' });
  const templateSheets = new Set(wb.SheetNames);
  assert.equal(BUNDLE_GROUPS.length, 4);
  for (const group of BUNDLE_GROUPS) {
    for (const s of group.sheets) {
      assert.ok(templateSheets.has(s), `sheet "${s}" not in template (available: ${wb.SheetNames.join('|')})`);
    }
  }
});

test('splitForBundle: CMS 그룹 → CMS 만 visible, 나머지 hidden', async () => {
  const raw = await readFile(TEMPLATE);
  const wb = XLSX.read(raw, { type: 'buffer' });
  const cms = BUNDLE_GROUPS.find((g) => g.id === 'cms')!;
  const out = splitForBundle(wb, cms);
  // 전 시트 유지
  assert.equal(out.SheetNames.length, wb.SheetNames.length);
  const meta = out.Workbook?.Sheets ?? [];
  const hiddenFlag = (name: string) => meta.find((s) => s.name === name)?.Hidden;
  assert.equal(hiddenFlag('CMS '), 0);
  assert.equal(hiddenFlag('입력시트'), 1);
  assert.equal(hiddenFlag('기장계약서 1 '), 1);
  assert.equal(hiddenFlag('수임동의'), 1);
});

test('splitForBundle: 기장계약서 그룹 → 표지/1/2 만 visible', async () => {
  const raw = await readFile(TEMPLATE);
  const wb = XLSX.read(raw, { type: 'buffer' });
  const contract = BUNDLE_GROUPS.find((g) => g.id === 'contract')!;
  const out = splitForBundle(wb, contract);
  const meta = out.Workbook?.Sheets ?? [];
  const hiddenFlag = (name: string) => meta.find((s) => s.name === name)?.Hidden;
  assert.equal(hiddenFlag('기장계약서표지 '), 0);
  assert.equal(hiddenFlag('기장계약서 1 '), 0);
  assert.equal(hiddenFlag('기장계약서 2 '), 0);
  assert.equal(hiddenFlag('입력시트'), 1);
  assert.equal(hiddenFlag('CMS '), 1);
  assert.equal(hiddenFlag('수임동의'), 1);
});

test('splitForBundle: EDI 그룹 → 국민+건강 visible', async () => {
  const raw = await readFile(TEMPLATE);
  const wb = XLSX.read(raw, { type: 'buffer' });
  const edi = BUNDLE_GROUPS.find((g) => g.id === 'edi')!;
  const out = splitForBundle(wb, edi);
  const meta = out.Workbook?.Sheets ?? [];
  const hiddenFlag = (name: string) => meta.find((s) => s.name === name)?.Hidden;
  assert.equal(hiddenFlag('국민 EDI'), 0);
  assert.equal(hiddenFlag('건강 EDI '), 0);
  assert.equal(hiddenFlag('기장계약서표지 '), 1);
  assert.equal(hiddenFlag('입력시트'), 1);
});

test('sanitizeFilename: 공백→_, 특수문자 제거', () => {
  assert.equal(sanitizeFilename('(주) 길동/상점'), '(주)_길동상점');
});
