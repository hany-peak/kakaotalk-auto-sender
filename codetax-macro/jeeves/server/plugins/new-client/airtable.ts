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
  airtableField: string;
  /** jeeves ChecklistItemState → Airtable 셀 값 */
  transform: (state: ChecklistItemState) => unknown;
}

/**
 * 체크리스트 항목 변경 시 Airtable 의 어느 필드를 어떻게 갱신할지 매핑.
 * 새 매핑 추가 시 여기에 엔트리만 넣으면 됨.
 */
const REVERSE_MAPPINGS: Partial<Record<ChecklistItemKey, ReverseMapping>> = {
  katalkRoom: {
    airtableField: '카톡방',
    transform: (s) => s.status === 'done',
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

  try {
    const value = mapping.transform(state);
    const fields = { [mapping.airtableField]: value } as FieldSet;
    const base = new Airtable({ apiKey: cfg.airtableNewClientPat }).base(cfg.airtableNewClientBaseId);
    await base(cfg.airtableNewClientTableName).update([{ id: airtableRecordId, fields }]);
    return true;
  } catch (err: any) {
    logError(
      `[new-client] airtable reverse sync failed (${itemKey} → ${mapping.airtableField}): ${err.message || err}`,
    );
    return false;
  }
}
