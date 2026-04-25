import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveParentPath, parseLeadingNumber, formatFolderName } from './dropbox';

test('resolveParentPath: 개인 × 기장', () => {
  assert.equal(
    resolveParentPath('개인', '기장'),
    '/세무법인의 팀 폴더/2.기장/개인/일반기장',
  );
});

test('resolveParentPath: 개인 × 신고대리', () => {
  assert.equal(
    resolveParentPath('개인', '신고대리'),
    '/세무법인의 팀 폴더/2.기장/개인/신고대리',
  );
});

test('resolveParentPath: 법인 × 기장', () => {
  assert.equal(
    resolveParentPath('법인', '기장'),
    '/세무법인의 팀 폴더/2.기장/법인',
  );
});

test('resolveParentPath: 법인 × 신고대리', () => {
  assert.equal(
    resolveParentPath('법인', '신고대리'),
    '/세무법인의 팀 폴더/2.기장/법인/000 신고대리',
  );
});

test('parseLeadingNumber: "334. 메이저랩" → 334', () => {
  assert.equal(parseLeadingNumber('334. 메이저랩'), 334);
});

test('parseLeadingNumber: "096 (주)힐스타" → 96', () => {
  assert.equal(parseLeadingNumber('096 (주)힐스타'), 96);
});

test('parseLeadingNumber: "99 전태빈_50,000원 신고" → 99', () => {
  assert.equal(parseLeadingNumber('99 전태빈_50,000원 신고'), 99);
});

test('parseLeadingNumber: "기한후신고.xlsx" → null (no leading digits)', () => {
  assert.equal(parseLeadingNumber('기한후신고.xlsx'), null);
});

test('parseLeadingNumber: empty string → null', () => {
  assert.equal(parseLeadingNumber(''), null);
});

test('formatFolderName: zero-pad to 3 digits', () => {
  assert.equal(formatFolderName(1, '홍길동'), '001. 홍길동');
  assert.equal(formatFolderName(97, '(주)아모레'), '097. (주)아모레');
  assert.equal(formatFolderName(335, '메이저랩'), '335. 메이저랩');
});

test('formatFolderName: 4-digit number stays as-is', () => {
  assert.equal(formatFolderName(1000, 'X'), '1000. X');
});
