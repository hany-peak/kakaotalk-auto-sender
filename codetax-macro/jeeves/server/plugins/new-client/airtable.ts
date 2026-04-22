import Airtable, { FieldSet } from 'airtable';
import type { NewClientConfig } from './config';
import type {
  BusinessScope,
  BizRegStatus,
  ChecklistItemState,
  NewClientRecord,
} from './types';
import type { ChecklistItemKey } from './checklist-config';

const BUSINESS_SCOPE_MAP: Record<BusinessScope, string> = {
  '기장': '1.기장',
  '신고대리': '2.신고대리',
};

const BIZ_REG_MAP: Record<BizRegStatus, string> = {
  '기존': '기존발급',
  '신규생성': '자료요청',
};

export function buildAirtableFields(r: NewClientRecord): Record<string, unknown> {
  const fields: Record<string, unknown> = {
    '업체명': r.companyName,
    '대표자': r.representative,
    '업무착수일': r.startDate,
    '기장료': r.bookkeepingFee,
    '유입경로': r.inflowRoute,
    '상태': '2.계약중',
    '업무범위': BUSINESS_SCOPE_MAP[r.businessScope],
    '사업자등록증': BIZ_REG_MAP[r.bizRegStatus],
    '홈택스 업종': [r.industry],
  };

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
};

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
