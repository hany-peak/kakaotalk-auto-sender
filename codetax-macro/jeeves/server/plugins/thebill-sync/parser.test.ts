import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeBizNo, classifyStatus } from './parser';

test('normalizeBizNo strips hyphens', () => {
  assert.equal(normalizeBizNo('123-45-67890'), '1234567890');
});

test('normalizeBizNo strips spaces', () => {
  assert.equal(normalizeBizNo(' 123 45 67890 '), '1234567890');
});

test('normalizeBizNo passes through individual ID prefix (6 digits)', () => {
  assert.equal(normalizeBizNo('880101'), '880101');
});

test('normalizeBizNo handles number input', () => {
  assert.equal(normalizeBizNo(1234567890 as unknown as string), '1234567890');
});

test('classifyStatus maps success values', () => {
  assert.equal(classifyStatus('출금성공'), 'success');
  assert.equal(classifyStatus('승인성공'), 'success');
  assert.equal(classifyStatus('정상출금'), 'success');
});

test('classifyStatus maps failure values', () => {
  assert.equal(classifyStatus('승인실패'), 'failure');
  assert.equal(classifyStatus('출금실패'), 'failure');
  assert.equal(classifyStatus('출금실패 [기타수취불가] [자동재출금]'), 'failure');
  // 더빌 실패 사유 변종 — 모두 '실패' 키워드 매칭
  assert.equal(classifyStatus('출금실패 잔액부족 [자동재출금]'), 'failure');
  assert.equal(classifyStatus('출금실패 기타수취불가 [자동재출금]'), 'failure');
  assert.equal(classifyStatus('출금실패 출금중지 [자동재출금]'), 'failure');
  assert.equal(classifyStatus('미납'), 'failure');
  assert.equal(classifyStatus('출금불능'), 'failure');
  assert.equal(classifyStatus('미납(출금불능)'), 'failure');
});

test('classifyStatus: 재출금중지 단독은 unknown (수동 검토)', () => {
  // standalone "재출금중지" 만 있는 row — failure 컨텍스트 없음, manual review.
  assert.equal(classifyStatus('재출금중지'), 'unknown');
});

test('classifyStatus returns unknown for in-progress states', () => {
  assert.equal(classifyStatus('대기'), 'unknown');
  assert.equal(classifyStatus('출금등록중'), 'unknown');
  assert.equal(classifyStatus('출금중 [자동출금]'), 'unknown');
  assert.equal(classifyStatus(''), 'unknown');
});
