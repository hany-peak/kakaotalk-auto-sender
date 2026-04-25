import type { NewClientRecord } from '../../../types';

/**
 * 모든 PDF 템플릿이 공유하는 props.
 * record: 거래처 마스터 데이터, rrn: 대표자 주민번호 (Airtable 별도 필드),
 * date: 표시용 일자 문자열 (예: "2026년 04월 25일").
 */
export interface TemplateProps {
  record: NewClientRecord;
  rrn: string | null;
  date: string;
}
