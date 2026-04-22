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
  },
  businessLicense: {
    toFields: (s) => ({ '사업자등록증': selectOrNull(s.status) }),
  },
  transferData: {
    toFields: (s) => {
      const fields: Record<string, unknown> = {
        '업체자료': selectOrNull(s.status),
      };
      // 메모 → 이관사무실. 메모가 아예 제공되지 않은 업데이트(상태만 바뀜) 에서는
      // 기존 이관사무실 값을 건드리지 않기 위해 생략.
      if (s.note !== undefined) {
        fields['이관사무실'] = textOrNull(s.note);
      }
      return fields;
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
