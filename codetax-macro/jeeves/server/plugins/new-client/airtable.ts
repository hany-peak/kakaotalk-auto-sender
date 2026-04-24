import Airtable, { FieldSet } from 'airtable';
import type { NewClientConfig } from './config';
import type {
  BusinessScope,
  BizRegStatus,
  ChecklistItemState,
  ChecklistState,
  EntityType,
  Industry,
  NewClientListItem,
  NewClientRecord,
} from './types';
import type { ChecklistItemKey } from './checklist-config';
import { CHECKLIST_ITEMS, isItemDone } from './checklist-config';

const BUSINESS_SCOPE_MAP: Record<BusinessScope, string> = {
  '기장': '1.기장',
  '신고대리': '2.신고대리',
};

const BIZ_REG_MAP: Record<BizRegStatus, string> = {
  '기존': '기존발급',
  '신규생성': '자료요청',
};

// Reverse maps (Airtable → app types) for reading records.
const ENTITY_TYPE_FROM_AIRTABLE: Record<string, EntityType> = {
  '가.법인': '법인',
  '나.개인': '개인',
};

const BUSINESS_SCOPE_FROM_AIRTABLE: Record<string, BusinessScope> = {
  '1.기장': '기장',
  '2.신고대리': '신고대리',
};

export function buildAirtableFields(r: NewClientRecord): Record<string, unknown> {
  const fields: Record<string, unknown> = {
    '업체명': r.companyName,
    '대표자': r.representative,
    '업무착수일': r.startDate,
    '상태': '2.계약중',
    '업무범위': BUSINESS_SCOPE_MAP[r.businessScope],
  };

  if (r.bookkeepingFee !== undefined) fields['기장료'] = r.bookkeepingFee;
  if (r.inflowRoute !== undefined) fields['유입경로'] = r.inflowRoute;
  if (r.bizRegStatus !== undefined) fields['사업자등록증'] = BIZ_REG_MAP[r.bizRegStatus];
  if (r.industry !== undefined) fields['홈택스 업종'] = [r.industry];

  if (r.contractNote && r.contractNote.trim() !== '') {
    fields['계약특이사항'] = r.contractNote;
  }

  if (r.transferStatus === '이관') {
    if (r.transferSourceOffice && r.transferSourceOffice.trim() !== '') {
      fields['이관사무실'] = r.transferSourceOffice;
    }
    if (r.transferReason && r.transferReason.trim() !== '') {
      fields['이관사유'] = r.transferReason;
    }
  }

  return fields;
}

/**
 * Creates a new record in the configured Airtable base/table. Returns the
 * Airtable record id on success, null on any failure (missing config, network,
 * Airtable API error). Never throws.
 */
export async function syncToAirtable(
  record: NewClientRecord,
  cfg: NewClientConfig,
  logError: (msg: string) => void,
): Promise<string | null> {
  if (!cfg.airtableNewClientPat) {
    logError('[new-client] AIRTABLE_NEW_CLIENT_PAT not set — skipping airtable sync');
    return null;
  }
  if (!cfg.airtableNewClientBaseId) {
    logError('[new-client] AIRTABLE_NEW_CLIENT_BASE_ID not set — skipping airtable sync');
    return null;
  }

  try {
    const fields = buildAirtableFields(record);
    const base = new Airtable({ apiKey: cfg.airtableNewClientPat }).base(cfg.airtableNewClientBaseId);
    const created = await base(cfg.airtableNewClientTableName).create([{ fields: fields as FieldSet }]);
    const recordId = created[0]?.id;
    return recordId ?? null;
  } catch (err: any) {
    logError(`[new-client] airtable sync failed: ${err.message || err}`);
    return null;
  }
}

// ============================================================================
// Checklist → Airtable reverse sync
// ============================================================================

interface ReverseMapping {
  /**
   * 체크리스트 항목 상태를 Airtable 필드 집합으로 변환한다.
   * 한 항목이 여러 Airtable 필드에 영향을 줄 수 있어 dict 반환.
   * 비어있는 dict 를 반환하면 no-op.
   */
  toFields: (state: ChecklistItemState) => Record<string, unknown>;
  /**
   * Airtable 레코드의 필드값들에서 체크리스트 항목 상태를 추출한다.
   * `null` 반환: 이 항목은 Airtable 에서 반영할 값이 없음 → 기존 jeeves 상태 유지.
   * `Partial<ChecklistItemState>` 반환: 기존 상태에 merge.
   */
  fromFields: (airtableFields: Record<string, unknown>) => Partial<ChecklistItemState> | null;
}

function selectOrNull(status: string | undefined): string | null {
  if (!status || status === 'none') return null;
  return status;
}

function textOrNull(note: string | undefined): string | null {
  if (note === undefined) return null; // '미제공' — 이 경우는 caller 가 skip
  if (note.trim() === '') return null;
  return note;
}

/**
 * 체크리스트 항목 변경 시 Airtable 의 어느 필드를 어떻게 갱신할지 매핑.
 * 새 매핑 추가 시 여기에 엔트리만 넣으면 됨.
 */
const REVERSE_MAPPINGS: Partial<Record<ChecklistItemKey, ReverseMapping>> = {
  katalkRoom: {
    toFields: (s) => ({ '카톡방': s.status === 'done' }),
    // 체크박스: Airtable 미체크 시 필드 자체가 응답에 없음 → 'none' 으로 판정.
    fromFields: (f) => ({ status: f['카톡방'] === true ? 'done' : 'none' }),
  },
  businessLicense: {
    toFields: (s) => ({ '사업자등록증': selectOrNull(s.status) }),
    // singleSelect: 값 있으면 적용. 없으면 jeeves 상태 유지(null).
    fromFields: (f) => {
      const val = f['사업자등록증'];
      if (typeof val === 'string' && val.length > 0) return { status: val };
      return null;
    },
  },
  transferData: {
    toFields: (s) => {
      const fields: Record<string, unknown> = {
        '업체자료': selectOrNull(s.status),
      };
      if (s.note !== undefined) {
        fields['이관사무실'] = textOrNull(s.note);
      }
      return fields;
    },
    // 업체자료(singleSelect) + 이관사무실(text) 둘 다 체크. 어느 한쪽이라도 있으면 반영.
    fromFields: (f) => {
      const statusRaw = f['업체자료'];
      const noteRaw = f['이관사무실'];
      const hasStatus = typeof statusRaw === 'string' && statusRaw.length > 0;
      const hasNote = typeof noteRaw === 'string';
      if (!hasStatus && !hasNote) return null;
      const partial: Partial<ChecklistItemState> = {};
      if (hasStatus) partial.status = statusRaw as string;
      if (hasNote) partial.note = noteRaw as string;
      return partial;
    },
  },
  // ── Checkbox fields (5) ────────────────────────────────────────────────
  wehago: checkboxMapping('위하고'),
  cms: checkboxMapping('CMS'),
  cashReceiptStore: checkboxMapping('현영가맹점'),
  wemembers: checkboxMapping('위멤버스'),
  semoreport: checkboxMapping('세모리포트'),
  onboardingComplete: checkboxMapping('수임완료'),
  // ── Date value ─────────────────────────────────────────────────────────
  feeBillingDate: {
    toFields: (s) => ({ '수수료청구일': s.value && s.value.trim() !== '' ? s.value : null }),
    fromFields: (f) => {
      const v = f['수수료청구일'];
      if (typeof v === 'string' && v.length > 0) return { value: v };
      return null;
    },
  },
  // ── singleSelect fields (perfect 1:1) ──────────────────────────────────
  paymentMethod: singleSelectMapping('결제방식'),
  contract: singleSelectMapping('기장계약서'),
  hometaxDelegation: singleSelectMapping('홈택스수임'),
  ediDelegation: singleSelectMapping('EDI수임'),
  businessAccount: singleSelectMapping('사업용계좌'),
  creditCard: singleSelectMapping('신용카드'),
  // ── Edge cases ─────────────────────────────────────────────────────────
  // Airtable stores actual ID/PW in two multilineText fields. Jeeves just
  // tracks "completed" (both filled). Jeeves→Airtable is a no-op — the user
  // edits those fields directly in Airtable.
  hometaxCredentials: {
    toFields: () => ({}),
    fromFields: (f) => {
      const id = f['홈택스아이디'];
      const pw = f['홈택스패스워드'];
      const both =
        typeof id === 'string' && id.trim() !== '' &&
        typeof pw === 'string' && pw.trim() !== '';
      return { status: both ? 'done' : 'none' };
    },
  },
  // multipleSelects field — we use first selected element as Jeeves status.
  assignee: {
    toFields: (s) => ({ '실무자': s.status && s.status !== 'none' ? [s.status] : null }),
    fromFields: (f) => {
      const arr = f['실무자'];
      if (Array.isArray(arr) && typeof arr[0] === 'string') return { status: arr[0] };
      return null;
    },
  },
};

/**
 * Standard checkbox ↔ binary mapping. `done` ↔ true, anything else ↔ false/absent.
 */
function checkboxMapping(fieldName: string): ReverseMapping {
  return {
    toFields: (s) => ({ [fieldName]: s.status === 'done' }),
    fromFields: (f) => ({ status: f[fieldName] === true ? 'done' : 'none' }),
  };
}

/**
 * Standard singleSelect ↔ enum mapping using Jeeves status = Airtable value.
 * When Airtable field is empty/absent → fromFields returns null (preserve local state).
 * When Jeeves status is 'none'/empty → toFields sends null (clear field).
 */
function singleSelectMapping(fieldName: string): ReverseMapping {
  return {
    toFields: (s) => ({ [fieldName]: selectOrNull(s.status) }),
    fromFields: (f) => {
      const v = f[fieldName];
      if (typeof v === 'string' && v.length > 0) return { status: v };
      return null;
    },
  };
}

/**
 * Airtable 의 기존 레코드를 체크리스트 항목에 맞춰 갱신한다.
 * 매핑이 없는 항목은 no-op (성공 반환). 실패 시 false.
 */
export async function updateAirtableChecklist(
  airtableRecordId: string,
  itemKey: ChecklistItemKey,
  state: ChecklistItemState,
  cfg: NewClientConfig,
  logError: (msg: string) => void,
): Promise<boolean> {
  const mapping = REVERSE_MAPPINGS[itemKey];
  if (!mapping) return true; // 매핑 없음 — 조용히 스킵

  if (!cfg.airtableNewClientPat || !cfg.airtableNewClientBaseId) {
    logError('[new-client] airtable env missing — skip checklist reverse sync');
    return false;
  }

  const fields = mapping.toFields(state);
  if (Object.keys(fields).length === 0) return true;

  try {
    const base = new Airtable({ apiKey: cfg.airtableNewClientPat }).base(cfg.airtableNewClientBaseId);
    await base(cfg.airtableNewClientTableName).update([
      { id: airtableRecordId, fields: fields as FieldSet },
    ]);
    return true;
  } catch (err: any) {
    logError(
      `[new-client] airtable reverse sync failed (${itemKey} → ${Object.keys(fields).join(',')}): ${err.message || err}`,
    );
    return false;
  }
}

export interface PullResult {
  /** Airtable 에서 당겨온 뒤, 기존과 비교해 실제로 변경된 항목별 state */
  updatedItems: Partial<Record<ChecklistItemKey, ChecklistItemState>>;
  /** 전체 병합된 최신 checklist */
  merged: Record<ChecklistItemKey, ChecklistItemState> | Partial<Record<ChecklistItemKey, ChecklistItemState>>;
}

/**
 * Airtable 에 해당 airtableRecordId 로 있는 레코드를 읽어 REVERSE_MAPPINGS 정의에 따라
 * checklist 로 변환, 기존 checklist 와 비교해 실제 변경된 항목만 리턴한다.
 * 실패/미설정/대상없음 시 null 반환.
 */
export async function pullFromAirtable(
  airtableRecordId: string,
  existing: Partial<Record<ChecklistItemKey, ChecklistItemState>>,
  cfg: NewClientConfig,
  logError: (msg: string) => void,
): Promise<Partial<Record<ChecklistItemKey, ChecklistItemState>> | null> {
  if (!cfg.airtableNewClientPat || !cfg.airtableNewClientBaseId) return null;

  try {
    const base = new Airtable({ apiKey: cfg.airtableNewClientPat }).base(cfg.airtableNewClientBaseId);
    const airtableRecord = await base(cfg.airtableNewClientTableName).find(airtableRecordId);
    const f = (airtableRecord.fields as unknown) as Record<string, unknown>;

    const now = new Date().toISOString();
    const changed: Partial<Record<ChecklistItemKey, ChecklistItemState>> = {};

    for (const [rawKey, mapping] of Object.entries(REVERSE_MAPPINGS)) {
      if (!mapping) continue;
      const key = rawKey as ChecklistItemKey;
      const partial = mapping.fromFields(f);
      if (!partial) continue;

      const prev = existing[key];
      const next: ChecklistItemState = {
        ...(prev ?? { updatedAt: now }),
        ...partial,
      };

      // 실제로 바뀌지 않았다면 스킵(updatedAt 불필요 갱신 방지)
      if (prev && prev.status === next.status && prev.note === next.note) continue;

      next.updatedAt = now;
      changed[key] = next;
    }

    return changed;
  } catch (err: any) {
    logError(`[new-client] airtable pull failed: ${err.message || err}`);
    return null;
  }
}

// ============================================================================
// Airtable → NewClientRecord / NewClientListItem (list passthrough)
// ============================================================================

/** Extract first element if the field is an array (Airtable multi-select/linked). */
function firstString(v: unknown): string | undefined {
  if (typeof v === 'string') return v;
  if (Array.isArray(v) && typeof v[0] === 'string') return v[0];
  return undefined;
}

function firstNumber(v: unknown): number | undefined {
  if (typeof v === 'number') return v;
  return undefined;
}

/**
 * Convert raw Airtable fields → ChecklistState via REVERSE_MAPPINGS.
 * Items with no mapping are omitted (remain undefined in the returned state).
 */
export function airtableToChecklist(
  fields: Record<string, unknown>,
  now: string = new Date().toISOString(),
): ChecklistState {
  const out: ChecklistState = {};
  for (const [rawKey, mapping] of Object.entries(REVERSE_MAPPINGS)) {
    if (!mapping) continue;
    const partial = mapping.fromFields(fields);
    if (!partial) continue;
    out[rawKey as ChecklistItemKey] = {
      updatedAt: now,
      ...partial,
    };
  }
  return out;
}

function optionalString(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const trimmed = v.trim();
  return trimmed === '' ? undefined : trimmed;
}

/** Convert an Airtable record → NewClientRecord shape. Missing fields become undefined. */
export function airtableToRecord(
  airtableRecordId: string,
  fields: Record<string, unknown>,
  createdTime: string | undefined,
): NewClientRecord {
  const entityTypeRaw = typeof fields['기업구분'] === 'string' ? (fields['기업구분'] as string) : undefined;
  const scopeRaw = typeof fields['업무범위'] === 'string' ? (fields['업무범위'] as string) : undefined;
  const industryArr = fields['홈택스 업종'];
  const industry = firstString(industryArr) as Industry | undefined;
  const createdAt = createdTime ?? new Date().toISOString();
  return {
    id: airtableRecordId,
    airtableRecordId,
    createdAt,
    companyName: (fields['업체명'] as string) ?? '(이름 없음)',
    representative: (fields['대표자'] as string) ?? '',
    startDate: (fields['업무착수일'] as string) ?? '',
    businessScope: (scopeRaw ? BUSINESS_SCOPE_FROM_AIRTABLE[scopeRaw] : undefined) ?? '기장',
    entityType: entityTypeRaw ? ENTITY_TYPE_FROM_AIRTABLE[entityTypeRaw] : undefined,
    industry,
    bookkeepingFee: firstNumber(fields['기장료']),
    contractNote: optionalString(fields['계약특이사항']),
    transferSourceOffice: optionalString(fields['이관사무실']),
    transferReason: optionalString(fields['이관사유']),
    bizRegNumber: optionalString(fields['사업자번호']),
    openDate: optionalString(fields['개업일']),
    corpRegNumber: optionalString(fields['법인등록번호']),
    bizAddress: optionalString(fields['사업장주소']),
    bizPhone: optionalString(fields['전화번호']),
    bankName: optionalString(fields['은행명']),
    accountNumber: optionalString(fields['계좌번호']),
    checklist: airtableToChecklist(fields, createdAt),
  };
}

function computeProgressFromChecklist(checklist: ChecklistState): { done: number; total: number } {
  let done = 0;
  for (const def of CHECKLIST_ITEMS) {
    if (isItemDone(def, checklist[def.key])) done++;
  }
  return { done, total: CHECKLIST_ITEMS.length };
}

function latestUpdateFromChecklist(checklist: ChecklistState): string | undefined {
  let latest: string | undefined;
  for (const state of Object.values(checklist)) {
    if (!state) continue;
    if (!latest || state.updatedAt > latest) latest = state.updatedAt;
  }
  return latest;
}

/**
 * Fetch all records from the configured 거래처 view and convert them to
 * NewClientListItem. Paginates through Airtable automatically.
 * Returns `null` on any failure (missing config, network, API error).
 */
export async function fetchViewList(
  cfg: NewClientConfig,
  logError: (msg: string) => void,
): Promise<NewClientListItem[] | null> {
  if (!cfg.airtableNewClientPat || !cfg.airtableNewClientBaseId) {
    logError('[new-client] airtable env missing — cannot fetch view list');
    return null;
  }
  try {
    const base = new Airtable({ apiKey: cfg.airtableNewClientPat }).base(cfg.airtableNewClientBaseId);
    const records = await base(cfg.airtableNewClientTableName)
      .select({ view: cfg.airtableNewClientViewName })
      .all();
    return records.map((r) => {
      const fields = r.fields as Record<string, unknown>;
      const checklist = airtableToChecklist(fields);
      return {
        id: r.id,
        companyName: (fields['업체명'] as string) ?? '(이름 없음)',
        representative: (fields['대표자'] as string) ?? '',
        industry: firstString(fields['홈택스 업종']),
        startDate: (fields['업무착수일'] as string) ?? '',
        createdAt: (r as unknown as { _rawJson?: { createdTime?: string } })._rawJson?.createdTime,
        progress: computeProgressFromChecklist(checklist),
        checklistUpdatedAt: latestUpdateFromChecklist(checklist),
      };
    });
  } catch (err: any) {
    logError(`[new-client] airtable view fetch failed: ${err.message || err}`);
    return null;
  }
}

/**
 * Fetch a single record by Airtable record id and return as NewClientRecord.
 * Returns null on missing config, 404, or any other error.
 */
export async function fetchAirtableRecord(
  airtableRecordId: string,
  cfg: NewClientConfig,
  logError: (msg: string) => void,
): Promise<NewClientRecord | null> {
  if (!cfg.airtableNewClientPat || !cfg.airtableNewClientBaseId) return null;
  try {
    const base = new Airtable({ apiKey: cfg.airtableNewClientPat }).base(cfg.airtableNewClientBaseId);
    const rec = await base(cfg.airtableNewClientTableName).find(airtableRecordId);
    const fields = rec.fields as Record<string, unknown>;
    const createdTime = (rec as unknown as { _rawJson?: { createdTime?: string } })._rawJson?.createdTime;
    return airtableToRecord(airtableRecordId, fields, createdTime);
  } catch (err: any) {
    logError(`[new-client] airtable fetch record ${airtableRecordId} failed: ${err.message || err}`);
    return null;
  }
}

export function isAirtableId(id: string): boolean {
  return id.startsWith('rec') && id.length >= 14;
}

/**
 * 대표자 주민번호는 민감정보라 `NewClientRecord` 에 포함시키지 않고 (→ 클라이언트
 * 로 절대 내려가지 않음), WEHAGO 자동등록 시점에만 별도로 읽는다.
 * 실패/미설정/값 없음 시 null.
 *
 * 필드명 매칭 전략: 정확 일치 → 공백 정규화 일치 → "주민" 포함 스트링 키 중
 * 비어있지 않은 첫 값. 매칭 실패 시 발견된 키 목록을 로그에 남겨 Airtable
 * 쪽 실제 컬럼명을 확인할 수 있게 한다.
 */
export async function fetchRepRrn(
  airtableRecordId: string,
  cfg: NewClientConfig,
  logError: (msg: string) => void,
  log?: (msg: string) => void,
): Promise<string | null> {
  if (!cfg.airtableNewClientPat || !cfg.airtableNewClientBaseId) return null;
  try {
    const base = new Airtable({ apiKey: cfg.airtableNewClientPat }).base(cfg.airtableNewClientBaseId);
    const rec = await base(cfg.airtableNewClientTableName).find(airtableRecordId);
    const fields = rec.fields as Record<string, unknown>;

    const normalize = (s: string): string => s.replace(/\s+/g, '').normalize('NFC');
    const targetNormalized = normalize('대표자주민번호');

    // Candidate keys: anything whose normalized form matches, or contains "주민".
    const candidates: Array<{ key: string; value: unknown }> = [];
    for (const [key, value] of Object.entries(fields)) {
      const n = normalize(key);
      if (n === targetNormalized || n.includes('주민')) {
        candidates.push({ key, value });
      }
    }

    // Pick the first candidate that has a non-empty string value.
    for (const c of candidates) {
      if (typeof c.value === 'string' && c.value.trim() !== '') {
        return c.value.trim();
      }
      if (typeof c.value === 'number') {
        return String(c.value);
      }
    }

    // Nothing usable — log diagnostic so user can see what Airtable actually
    // returned. Never log the values themselves (could be sensitive) — only
    // key names and whether the value is empty.
    const rrnKeyDiag = candidates.length > 0
      ? candidates.map((c) => `${c.key}(${typeof c.value}${c.value === '' || c.value == null ? ':empty' : ''})`).join(', ')
      : 'none';
    const allKeys = Object.keys(fields).join(', ');
    (log ?? logError)(
      `[new-client] fetchRepRrn: 매칭되는 주민번호 필드 값이 비어있거나 없음. ` +
        `주민 관련 키=[${rrnKeyDiag}] · 전체 키=[${allKeys}]`,
    );
    return null;
  } catch (err: any) {
    logError(`[new-client] airtable fetchRepRrn ${airtableRecordId} failed: ${err.message || err}`);
    return null;
  }
}

/**
 * 거래처 레코드의 개업일/은행명/계좌번호를 부분 업데이트한다. `undefined`
 * 필드는 전송하지 않음 (기존 Airtable 값 유지). 빈 문자열은 null 로 보내
 * Airtable 측 값 클리어. 실패 시 false.
 */
export async function updateAirtableAuxFields(
  airtableRecordId: string,
  patch: { openDate?: string; bankName?: string; accountNumber?: string; bizAddress?: string },
  cfg: NewClientConfig,
  logError: (msg: string) => void,
): Promise<boolean> {
  if (!cfg.airtableNewClientPat || !cfg.airtableNewClientBaseId) {
    logError('[new-client] airtable env missing — skip aux update');
    return false;
  }

  const fields: Record<string, unknown> = {};
  if (patch.openDate !== undefined) {
    fields['개업일'] = patch.openDate.trim() === '' ? null : patch.openDate;
  }
  if (patch.bankName !== undefined) {
    fields['은행명'] = patch.bankName.trim() === '' ? null : patch.bankName;
  }
  if (patch.accountNumber !== undefined) {
    fields['계좌번호'] = patch.accountNumber.trim() === '' ? null : patch.accountNumber;
  }
  if (patch.bizAddress !== undefined) {
    fields['사업장주소'] = patch.bizAddress.trim() === '' ? null : patch.bizAddress;
  }
  if (Object.keys(fields).length === 0) return true;

  try {
    const base = new Airtable({ apiKey: cfg.airtableNewClientPat }).base(cfg.airtableNewClientBaseId);
    await base(cfg.airtableNewClientTableName).update([
      { id: airtableRecordId, fields: fields as FieldSet },
    ]);
    return true;
  } catch (err: any) {
    logError(`[new-client] airtable aux update failed: ${err.message || err}`);
    return false;
  }
}
