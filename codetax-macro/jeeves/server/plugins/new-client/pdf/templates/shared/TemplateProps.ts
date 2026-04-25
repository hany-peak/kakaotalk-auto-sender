import type { NewClientRecord } from '../../../types';

export interface AgentInfo {
  bizRegNumber: string;
  industry1: string;
  industry2: string;
  companyName: string;
  address: string;
  homepage: string;
  phone: string;
  fax: string;
  email: string;
  representative: string;
}

export const DEFAULT_AGENT: AgentInfo = {
  bizRegNumber: '306-29-93669',
  industry1: '전문,과학 및 기술서비스업',
  industry2: '세무사',
  companyName: '코드세무회계',
  address: '서울 강남구 테헤란로1길 28-11 4층 4035호',
  homepage: 'https://codetax.co.kr/',
  phone: '010-7276-2430',
  fax: '0506-200-1788',
  email: 'help@codetax.co.kr',
  representative: '정 주 희 세 무 사',
};

export interface TemplateProps {
  record: NewClientRecord;
  rrn: string | null;
  date: string;
  agent?: AgentInfo;
  /** 제 3 조 ③: 소급기장수 (VAT 포함). 미지정 시 placeholder. */
  retroactiveFee?: string;
}
