import type { ChecklistState } from './checklist-config';

export { CHECKLIST_ITEMS, CHECKLIST_ITEM_MAP } from './checklist-config';
export type {
  ChecklistItemKey,
  ChecklistItemDefinition,
  ChecklistItemState,
  ChecklistState,
  ItemKind,
  ValueKind,
} from './checklist-config';

export const BUSINESS_SCOPES = ['기장', '신고대리'] as const;
export type BusinessScope = typeof BUSINESS_SCOPES[number];

export const INFLOW_ROUTES = ['소개1', '소개2', '블로그'] as const;
export type InflowRoute = typeof INFLOW_ROUTES[number];

export const TRANSFER_STATUSES = ['이관', '신규'] as const;
export type TransferStatus = typeof TRANSFER_STATUSES[number];

export const BIZ_REG_STATUSES = ['기존', '신규생성'] as const;
export type BizRegStatus = typeof BIZ_REG_STATUSES[number];

export const INDUSTRIES = [
  '건설업',
  '제조업',
  '도소매업',
  '음식점업',
  '부동산업',
  '서비스업',
  '정보통신업',
] as const;
export type Industry = typeof INDUSTRIES[number];

export interface NewClientInput {
  companyName: string;
  businessScope: BusinessScope;
  representative: string;
  startDate: string; // YYYY-MM-DD
  industry: Industry;
  bookkeepingFee: number;
  adjustmentFee: number;
  inflowRoute: InflowRoute;
  contractNote?: string;
  transferStatus: TransferStatus;
  bizRegStatus: BizRegStatus;
  transferSourceOffice?: string;
  transferReason?: string;
}

export interface NewClientRecord extends NewClientInput {
  id: string;
  createdAt: string; // ISO 8601
  checklist: ChecklistState;
  airtableRecordId?: string; // 등록 시 Airtable 에 생성된 레코드 ID. 없으면 역동기화 불가.
}

export interface SubmitResponse {
  ok: true;
  id: string;
  slackNotified: boolean;
  airtableSynced: boolean;
}

export interface ErrorResponse {
  error: string;
}
