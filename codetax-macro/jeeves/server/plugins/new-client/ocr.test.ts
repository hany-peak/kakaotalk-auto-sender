import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseBizAddress } from './ocr';

test('parseBizAddress: 사업장 소재지 : 주소', () => {
  const txt = '사업장 소재지 : 서울특별시 강남구 테헤란로 123 상호 (주)예시';
  assert.equal(parseBizAddress(txt), '서울특별시 강남구 테헤란로 123');
});

test('parseBizAddress: 다음 줄에 주소가 오는 경우', () => {
  const txt = `사업자 등록증
상호 (주)예시
사업장 소재지
서울특별시 강남구 테헤란로 123 4층
업태 서비스업`;
  assert.equal(parseBizAddress(txt), '서울특별시 강남구 테헤란로 123 4층');
});

test('parseBizAddress: 괄호 제거', () => {
  const txt = '사업장 소재지 : 서울시 강남구 (역삼동) 상호 (주)예시';
  const out = parseBizAddress(txt);
  assert.ok(out && out.includes('역삼동'), `got: ${out}`);
  assert.ok(out && !out.includes('('), `brackets should be gone: ${out}`);
});

test('parseBizAddress: 인식 실패 시 null', () => {
  assert.equal(parseBizAddress('아무 관련 없는 텍스트'), null);
});
