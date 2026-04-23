export type ChecklistItemKey =
  | 'katalkRoom'
  | 'businessLicense'
  | 'transferData'
  | 'dropboxFolder'
  | 'hometaxCredentials'
  | 'wehago'
  | 'bookkeepingFeeConfirmed'
  | 'contract'
  | 'feeBillingDate'
  | 'paymentMethod'
  | 'cms'
  | 'hometaxDelegation'
  | 'ediDelegation'
  | 'businessAccount'
  | 'creditCard'
  | 'cashReceiptStore'
  | 'assignee'
  | 'wemembers'
  | 'semoreport'
  | 'onboardingComplete';

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
  /**
   * 완료로 간주되는 상태 목록. 미지정 시 `states` 의 마지막 값만 완료로 판정.
   * 예: 사업자등록증은 '기존발급' 또는 '발급완료' 둘 다 완료.
   */
  doneStates?: string[];
}

export interface ChecklistItemState {
  status?: string;
  value?: string;
  note?: string;
  updatedAt: string;
}

export type ChecklistState = Partial<Record<ChecklistItemKey, ChecklistItemState>>;

export const CHECKLIST_ITEMS: ChecklistItemDefinition[] = [
  { key: 'katalkRoom', label: '카톡방', step: 1, kind: 'binary',
    states: ['none', 'done'],
    description: '단톡방 개설 후 체크 (정세무사님+과장님+지원팀)' },
  { key: 'businessLicense', label: '사업자등록증', step: 2, kind: 'enum',
    states: ['none', '기존발급', '자료요청', '접수완료', '발급완료'],
    doneStates: ['기존발급', '발급완료'],
    description: '사업자등록 신청·발급 진행 상태' },
  { key: 'transferData', label: '업체자료', step: 3, kind: 'enum',
    states: ['none', '자료요청', '자료저장', '전달완료'],
    doneStates: ['전달완료'],
    description: '자료요청 / 자료저장 / 전달완료 (Airtable 업체자료 필드와 동기화)' },
  { key: 'dropboxFolder', label: '드롭박스 생성', step: 3, kind: 'enum',
    states: ['none', 'done', 'error'],
    doneStates: ['done'],
    description: '등록 시 자동 생성 (실패 시 error + 재시도 버튼)' },
  { key: 'hometaxCredentials', label: '홈택스 ID/PW', kind: 'binary',
    states: ['none', 'done'],
    description: '거래처에게 전달받아 기재, 정상 로그인 확인' },
  { key: 'wehago', label: '위하고', step: 4, kind: 'binary',
    states: ['none', 'done'],
    description: '위하고 업체 생성 확인 후 체크' },
  { key: 'bookkeepingFeeConfirmed', label: '기장료', kind: 'binary',
    states: ['none', 'done'],
    description: '정세무사님 기장료 확인 완료 (금액은 등록 시 입력됨)' },
  { key: 'contract', label: '기장계약서', step: 6, kind: 'binary',
    states: ['none', 'done'],
    description: '기장계약서 거래처 전달 완료' },
  { key: 'feeBillingDate', label: '수수료 청구일', kind: 'value',
    valueKind: 'date',
    description: 'CMS 출금일. 매월 25일 고정이 기본' },
  { key: 'paymentMethod', label: '결제방식', kind: 'enum',
    states: ['none', 'CMS', '계좌이체', '해당없음'],
    description: 'CMS 자동이체 / 직접 입금 / 신고대리' },
  { key: 'cms', label: 'CMS', step: 7, kind: 'enum',
    states: ['none', '등록대기', '등록완료'],
    description: '더빌 자동출금 등록 상태' },
  { key: 'hometaxDelegation', label: '홈택스 수임', step: 8, kind: 'binary',
    states: ['none', 'done'],
    description: '홈택스 수임동의 완료' },
  { key: 'ediDelegation', label: 'EDI 수임', step: 9, kind: 'binary',
    states: ['none', 'done'],
    description: '국민연금/건강보험공단 EDI 수임등록 완료' },
  { key: 'businessAccount', label: '사업용계좌', step: 10, kind: 'enum',
    states: ['none', '등록대기', '등록완료'],
    description: '홈택스 사업용계좌 등록 상태' },
  { key: 'creditCard', label: '신용카드', step: 10, kind: 'enum',
    states: ['none', '등록대기', '등록완료'],
    description: '사업용카드 등록 상태' },
  { key: 'cashReceiptStore', label: '현영가맹점', step: 11, kind: 'enum',
    states: ['none', '등록대기', '등록완료'],
    description: '현금영수증 가맹점 등록 상태' },
  { key: 'assignee', label: '실무자', kind: 'value',
    valueKind: 'text',
    description: '담당자 이름 또는 "미배정"' },
  { key: 'wemembers', label: '위멤버스', step: 12, kind: 'binary',
    states: ['none', 'done'],
    description: '위멤버스 수임처 거래처 등록 완료' },
  { key: 'semoreport', label: '세모리포트', step: 13, kind: 'binary',
    states: ['none', 'done'],
    description: '세모리포트 등록 완료' },
  { key: 'onboardingComplete', label: '수임완료', kind: 'binary',
    states: ['none', 'done'],
    description: '위 절차가 모두 완료되면 체크' },
];

export const CHECKLIST_ITEM_MAP: Record<ChecklistItemKey, ChecklistItemDefinition> =
  Object.fromEntries(CHECKLIST_ITEMS.map((item) => [item.key, item])) as Record<
    ChecklistItemKey,
    ChecklistItemDefinition
  >;

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

export function computeProgress(
  checklist: ChecklistState,
): { done: number; total: number } {
  let done = 0;
  for (const def of CHECKLIST_ITEMS) {
    if (isItemDone(def, checklist[def.key])) done++;
  }
  return { done, total: CHECKLIST_ITEMS.length };
}

export function latestChecklistUpdate(
  checklist: ChecklistState,
): string | undefined {
  let latest: string | undefined;
  for (const state of Object.values(checklist)) {
    if (!state) continue;
    if (!latest || state.updatedAt > latest) latest = state.updatedAt;
  }
  return latest;
}
