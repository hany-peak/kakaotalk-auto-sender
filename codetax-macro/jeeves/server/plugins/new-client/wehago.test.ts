import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  wehagoEntityTypeValue,
  wehagoScopeValue,
  fiscalYearStart,
  fiscalYearEnd,
  buildWehagoForm,
} from './wehago';
import type { NewClientRecord } from './types';

test('wehagoEntityTypeValue: 법인 → 0.법인사업자', () => {
  assert.equal(wehagoEntityTypeValue('법인'), '0.법인사업자');
});

test('wehagoEntityTypeValue: 개인 → 1.개인사업자', () => {
  assert.equal(wehagoEntityTypeValue('개인'), '1.개인사업자');
});

test('wehagoEntityTypeValue: undefined → 1.개인사업자 (safer default)', () => {
  assert.equal(wehagoEntityTypeValue(undefined), '1.개인사업자');
});

test('wehagoScopeValue: 기장 → 0.기장', () => {
  assert.equal(wehagoScopeValue('기장'), '0.기장');
});

test('wehagoScopeValue: 신고대리 → 1.신고대리', () => {
  assert.equal(wehagoScopeValue('신고대리'), '1.신고대리');
});

test('fiscalYearStart: 개업일 있으면 그 연도 1/1', () => {
  assert.equal(fiscalYearStart('2024-07-15'), '2024.01.01');
});

test('fiscalYearStart: 개업일 없으면 현재 연도', () => {
  const cur = new Date().getFullYear();
  assert.equal(fiscalYearStart(undefined), `${cur}.01.01`);
});

test('fiscalYearEnd: 개업일 있으면 그 연도 12/31', () => {
  assert.equal(fiscalYearEnd('2024-07-15'), '2024.12.31');
});

test('buildWehagoForm: 법인 레코드 변환', () => {
  const record: NewClientRecord = {
    id: 'rec1',
    airtableRecordId: 'rec1',
    createdAt: '2026-01-01T00:00:00Z',
    companyName: '(주)테스트',
    representative: '홍길동',
    businessScope: '기장',
    entityType: '법인',
    startDate: '2026-04-01',
    bizRegNumber: '123-45-67890',
    corpRegNumber: '110111-0000000',
    bizAddress: '서울시 강남구 ...',
    bizPhone: '02-1234-5678',
    openDate: '2024-03-15',
    industry: '제조업',
    checklist: {},
  };
  const f = buildWehagoForm(record);
  assert.equal(f.companyName, '(주)테스트');
  assert.equal(f.entityType, '0.법인사업자');
  assert.equal(f.bizRegNumber, '123-45-67890');
  assert.equal(f.corpRegNumber, '110111-0000000');
  assert.equal(f.scope, '0.기장');
  assert.equal(f.fiscalStart, '2024.01.01');
  assert.equal(f.fiscalEnd, '2024.12.31');
  assert.equal(f.personnelYear, '2024');
});

test('buildWehagoForm: 개인사업자는 법인등록번호 drop', () => {
  const record: NewClientRecord = {
    id: 'rec1',
    createdAt: '',
    companyName: '홍길동상회',
    representative: '홍길동',
    businessScope: '기장',
    entityType: '개인',
    startDate: '2026-04-01',
    bizRegNumber: '123-45-67890',
    corpRegNumber: 'should-be-dropped',
    checklist: {},
  };
  const f = buildWehagoForm(record);
  assert.equal(f.entityType, '1.개인사업자');
  assert.equal(f.corpRegNumber, undefined);
});

test('buildWehagoForm: 사업자등록번호 없으면 throw', () => {
  const record: NewClientRecord = {
    id: 'rec1', createdAt: '', companyName: 'X', representative: 'Y',
    businessScope: '기장', startDate: '2026-04-01', checklist: {},
  };
  assert.throws(() => buildWehagoForm(record), /사업자등록번호/);
});
