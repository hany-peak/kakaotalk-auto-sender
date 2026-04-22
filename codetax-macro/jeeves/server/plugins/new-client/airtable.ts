import Airtable, { FieldSet } from 'airtable';
import type { NewClientConfig } from './config';
import type { BusinessScope, BizRegStatus, NewClientRecord } from './types';

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
 * Creates a new record in the configured Airtable base/table. Returns true on
 * success, false on any failure (missing config, network, Airtable API error).
 * Never throws.
 */
export async function syncToAirtable(
  record: NewClientRecord,
  cfg: NewClientConfig,
  logError: (msg: string) => void,
): Promise<boolean> {
  if (!cfg.airtableNewClientPat) {
    logError('[new-client] AIRTABLE_NEW_CLIENT_PAT not set — skipping airtable sync');
    return false;
  }
  if (!cfg.airtableNewClientBaseId) {
    logError('[new-client] AIRTABLE_NEW_CLIENT_BASE_ID not set — skipping airtable sync');
    return false;
  }

  try {
    const fields = buildAirtableFields(record);
    const base = new Airtable({ apiKey: cfg.airtableNewClientPat }).base(cfg.airtableNewClientBaseId);
    await base(cfg.airtableNewClientTableName).create([{ fields: fields as FieldSet }]);
    return true;
  } catch (err: any) {
    logError(`[new-client] airtable sync failed: ${err.message || err}`);
    return false;
  }
}
