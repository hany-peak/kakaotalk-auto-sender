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

test('splitForBundle: CMS 그룹 → 입력시트 hidden + CMS만', async () => {
  const raw = await readFile(TEMPLATE);
  const wb = XLSX.read(raw, { type: 'buffer' });
  const cms = BUNDLE_GROUPS.find((g) => g.id === 'cms')!;
  const out = splitForBundle(wb, cms);
  assert.deepEqual(out.SheetNames, ['입력시트', 'CMS ']);
  const inputMeta = out.Workbook?.Sheets?.find((s) => s.name === '입력시트');
  assert.equal(inputMeta?.Hidden, 1);
});

test('splitForBundle: 기장계약서 그룹 → 입력시트 + 표지/1/2', async () => {
  const raw = await readFile(TEMPLATE);
  const wb = XLSX.read(raw, { type: 'buffer' });
  const contract = BUNDLE_GROUPS.find((g) => g.id === 'contract')!;
  const out = splitForBundle(wb, contract);
  assert.deepEqual(
    out.SheetNames,
    ['입력시트', '기장계약서표지 ', '기장계약서 1 ', '기장계약서 2 '],
  );
});

test('splitForBundle: EDI 그룹 → 입력시트 + 국민 + 건강', async () => {
  const raw = await readFile(TEMPLATE);
  const wb = XLSX.read(raw, { type: 'buffer' });
  const edi = BUNDLE_GROUPS.find((g) => g.id === 'edi')!;
  const out = splitForBundle(wb, edi);
  assert.deepEqual(out.SheetNames, ['입력시트', '국민 EDI', '건강 EDI ']);
});

test('sanitizeFilename: 공백→_, 특수문자 제거', () => {
  assert.equal(sanitizeFilename('(주) 길동/상점'), '(주)_길동상점');
});
