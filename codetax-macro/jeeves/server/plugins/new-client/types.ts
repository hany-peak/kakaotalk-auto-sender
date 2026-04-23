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

export const ENTITY_TYPES = ['개인', '법인'] as const;
export type EntityType = typeof ENTITY_TYPES[number];

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
  entityType: EntityType;
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

/**
 * Airtable 에서 읽어온 레코드도 수용해야 하므로, jeeves 로컬 등록에서만 필수인
 * 필드들(`inflowRoute`, `transferStatus`, `bizRegStatus`, `industry`,
 * `bookkeepingFee`, `adjustmentFee`)을 optional 로 완화한다.
 */
export interface NewClientRecord
  extends Omit<
    NewClientInput,
    | 'entityType'
    | 'inflowRoute'
    | 'transferStatus'
    | 'bizRegStatus'
    | 'industry'
    | 'bookkeepingFee'
    | 'adjustmentFee'
  > {
  id: string;
  createdAt: string; // ISO 8601
  checklist: ChecklistState;
  airtableRecordId?: string;
  entityType?: EntityType;
  dropboxFolderPath?: string;
  inflowRoute?: InflowRoute;
  transferStatus?: TransferStatus;
  bizRegStatus?: BizRegStatus;
  industry?: Industry;
  bookkeepingFee?: number;
  adjustmentFee?: number;
  // 추가 필드 — Airtable 에서만 존재, WEHAGO 수임처 신규생성에 사용.
  bizRegNumber?: string;   // 사업자등록번호
  openDate?: string;       // 개업일 (YYYY-MM-DD)
  corpRegNumber?: string;  // 법인등록번호 (법인만)
  bizAddress?: string;     // 사업장주소
  bizPhone?: string;       // 사업장전화번호
}

export interface NewClientListItem {
  id: string; // airtableRecordId (when sourced from Airtable) or local UUID
  companyName: string;
  representative: string;
  industry?: string;
  startDate: string;
  createdAt?: string;
  progress: { done: number; total: number };
  checklistUpdatedAt?: string;
}

export interface SubmitResponse {
  ok: true;
  id: string;
  slackNotified: boolean;
  airtableSynced: boolean;
  dropboxFolderCreated: boolean;
  dropboxFolderPath?: string;
}

export interface ErrorResponse {
  error: string;
}
