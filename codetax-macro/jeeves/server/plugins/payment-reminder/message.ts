import type { UnpaidRecord } from './airtable';

export interface MessageContext {
  yearMonth: string; // 'YYYY-MM'
  bankAccount: string;
}

export function formatAmount(n: number): string {
  return new Intl.NumberFormat('ko-KR').format(n);
}

const TEMPLATE = [
  '안녕하세요 대표님.',
  '{귀속월}월 기장료 {금액}원(부가세포함)이 잔액부족으로 출금이 실패된 것으로 확인됩니다.',
  '아래 계좌로 입금 후 말씀한번 부탁드립니다.',
  '{계좌번호}',
  '',
  'CMS 자동이체 계좌 변경이나 별도 협의가 필요하신 경우, 편하게 연락 주시면 빠르게 도와드리겠습니다.',
  '감사합니다.',
].join('\n');

export function buildMessage(record: UnpaidRecord, ctx: MessageContext): string {
  const month = ctx.yearMonth.slice(5, 7);
  return TEMPLATE
    .replace('{귀속월}', month)
    .replace('{금액}', formatAmount(record.amount))
    .replace('{계좌번호}', ctx.bankAccount);
}
