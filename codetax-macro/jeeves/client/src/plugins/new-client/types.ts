// NOTE: 이 타입은 서버 측 jeeves/server/plugins/new-client/checklist-config.ts 및
// types.ts 와 동기화되어야 한다. 향후 공유 패키지로 추출 검토.

export type ChecklistItemKey =
  | 'katalkRoom' | 'businessLicense' | 'transferData' | 'dropboxFolder'
  | 'hometaxCredentials' | 'wehago' | 'bookkeepingFeeConfirmed' | 'contract'
  | 'feeBillingDate' | 'paymentMethod' | 'cms' | 'hometaxDelegation'
  | 'ediDelegation' | 'businessAccount' | 'creditCard' | 'cashReceiptStore'
  | 'assignee' | 'wemembers' | 'semoreport' | 'onboardingComplete';

export type ItemKind = 'binary' | 'enum' | 'value';
export type ValueKind = 'text' | 'date';

export interface ChecklistItemDefinition {
  key: ChecklistItemKey;
  label: string;
  step?: number;
  kind: ItemKind;
  states?: string[];
  valueKind?: ValueKind;
  description?: string;
  doneStates?: string[];
}

export interface ChecklistItemState {
  status?: string;
  value?: string;
  note?: string;
  updatedAt: string;
}

export type ChecklistState = Partial<Record<ChecklistItemKey, ChecklistItemState>>;

export type BusinessScope = '기장' | '신고대리';
export type InflowRoute = '소개1' | '소개2' | '블로그';
export type TransferStatus = '이관' | '신규';
export type BizRegStatus = '기존' | '신규생성';

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
  startDate: string;
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
 * Airtable 에서 읽어온 레코드도 수용하므로 Jeeves 등록에서만 필수인 필드들을 optional 로 완화.
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
  createdAt: string;
  checklist: ChecklistState;
  entityType?: EntityType;
  dropboxFolderPath?: string;
  inflowRoute?: InflowRoute;
  transferStatus?: TransferStatus;
  bizRegStatus?: BizRegStatus;
  industry?: Industry;
  bookkeepingFee?: number;
  adjustmentFee?: number;
}

export interface NewClientListItem {
  id: string;
  companyName: string;
  representative: string;
  industry: string;
  startDate: string;
  createdAt: string;
  progress: { done: number; total: number };
  checklistUpdatedAt?: string;
}

export interface ChecklistUpdateInput {
  status?: string;
  value?: string;
  note?: string;
}

export interface ChecklistUpdateResponse {
  ok: true;
  itemKey: ChecklistItemKey;
  state: ChecklistItemState;
}

export const CHECKLIST_ITEMS: ChecklistItemDefinition[] = [
  { key: 'katalkRoom', label: '카톡방', step: 1, kind: 'binary',
    states: ['none', 'done'], description: '단톡방 개설 후 체크' },
  { key: 'businessLicense', label: '사업자등록증', step: 2, kind: 'enum',
    states: ['none', '기존발급', '자료요청', '접수완료', '발급완료'],
    doneStates: ['기존발급', '발급완료'],
    description: '사업자등록 신청·발급 진행 상태' },
  { key: 'transferData', label: '업체자료', step: 3, kind: 'enum',
    states: ['none', '자료요청', '자료저장', '전달완료'],
    doneStates: ['전달완료'],
    description: '자료요청 / 자료저장 / 전달완료 (메모는 Airtable 이관사무실)' },
  { key: 'dropboxFolder', label: '드롭박스 생성', step: 3, kind: 'enum',
    states: ['none', 'done', 'error'],
    doneStates: ['done'],
    description: '등록 시 자동 생성 (실패 시 error + 재시도 버튼)' },
  { key: 'hometaxCredentials', label: '홈택스 ID/PW', step: 4, kind: 'binary',
    states: ['none', 'done'], description: '거래처에게 전달받아 기재' },
  { key: 'wehago', label: '위하고', step: 5, kind: 'binary',
    states: ['none', 'done'], description: '위하고 업체 생성 확인 후 체크' },
  { key: 'bookkeepingFeeConfirmed', label: '기장료', step: 6, kind: 'binary',
    states: ['none', 'done'], description: '정세무사님 기장료 확인 완료' },
  { key: 'contract', label: '기장계약서', step: 7, kind: 'binary',
    states: ['none', 'done'], description: '기장계약서 거래처 전달 완료' },
  { key: 'feeBillingDate', label: '수수료 청구일', step: 8, kind: 'value',
    valueKind: 'date', description: 'CMS 출금일 (기본 매월 25일)' },
  { key: 'paymentMethod', label: '결제방식', step: 9, kind: 'enum',
    states: ['none', 'CMS', '계좌이체', '해당없음'] },
  { key: 'cms', label: 'CMS', step: 10, kind: 'enum',
    states: ['none', '등록대기', '등록완료'], description: '더빌 자동출금 등록 상태' },
  { key: 'hometaxDelegation', label: '홈택스 수임', step: 11, kind: 'binary',
    states: ['none', 'done'], description: '홈택스 수임동의 완료' },
  { key: 'ediDelegation', label: 'EDI 수임', step: 12, kind: 'binary',
    states: ['none', 'done'], description: '연금/건강공단 EDI 수임등록' },
  { key: 'businessAccount', label: '사업용계좌', step: 13, kind: 'enum',
    states: ['none', '등록대기', '등록완료'] },
  { key: 'creditCard', label: '신용카드', step: 14, kind: 'enum',
    states: ['none', '등록대기', '등록완료'] },
  { key: 'cashReceiptStore', label: '현영가맹점', step: 15, kind: 'enum',
    states: ['none', '등록대기', '등록완료'] },
  { key: 'assignee', label: '실무자', step: 16, kind: 'value', valueKind: 'text',
    description: '담당자 이름 또는 "미배정"' },
  { key: 'wemembers', label: '위멤버스', step: 17, kind: 'binary',
    states: ['none', 'done'] },
  { key: 'semoreport', label: '세모리포트', step: 18, kind: 'binary',
    states: ['none', 'done'] },
  { key: 'onboardingComplete', label: '수임완료', step: 19, kind: 'binary',
    states: ['none', 'done'], description: '위 절차가 모두 완료되면 체크' },
];

export function isItemDone(
  def: ChecklistItemDefinition,
  state: ChecklistItemState | undefined,
): boolean {
  if (!state) return false;
  if (def.kind === 'value') {
    return typeof state.value === 'string' && state.value.trim() !== '';
  }
  if (state.status === undefined) return false;
  const doneStates = def.doneStates ?? [def.states![def.states!.length - 1]];
  return doneStates.includes(state.status);
}
