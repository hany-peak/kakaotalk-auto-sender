import {
  BUSINESS_SCOPES,
  INFLOW_ROUTES,
  TRANSFER_STATUSES,
  BIZ_REG_STATUSES,
  type NewClientInput,
} from './types';
import {
  CHECKLIST_ITEM_MAP,
  type ChecklistItemKey,
  type ChecklistItemDefinition,
} from './checklist-config';

export type ValidationResult =
  | { ok: true; value: NewClientInput }
  | { ok: false; error: string };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function validateInput(body: unknown): ValidationResult {
  if (typeof body !== 'object' || body === null) {
    return { ok: false, error: 'body must be an object' };
  }
  const b = body as Record<string, unknown>;

  const requireString = (key: string): string | null => {
    const v = b[key];
    if (typeof v !== 'string' || v.trim() === '') return null;
    return v.trim();
  };

  const companyName = requireString('companyName');
  if (!companyName) return { ok: false, error: 'missing: companyName' };

  const representative = requireString('representative');
  if (!representative) return { ok: false, error: 'missing: representative' };

  const industry = requireString('industry');
  if (!industry) return { ok: false, error: 'missing: industry' };

  const startDate = requireString('startDate');
  if (!startDate) return { ok: false, error: 'missing: startDate' };
  if (!DATE_RE.test(startDate)) return { ok: false, error: 'invalid startDate (expected YYYY-MM-DD)' };

  const businessScope = b.businessScope;
  if (typeof businessScope !== 'string' || !BUSINESS_SCOPES.includes(businessScope as any)) {
    return { ok: false, error: 'invalid businessScope' };
  }

  const inflowRoute = b.inflowRoute;
  if (typeof inflowRoute !== 'string' || !INFLOW_ROUTES.includes(inflowRoute as any)) {
    return { ok: false, error: 'invalid inflowRoute' };
  }

  const bookkeepingFee = b.bookkeepingFee;
  if (typeof bookkeepingFee !== 'number' || !Number.isFinite(bookkeepingFee) || bookkeepingFee < 0) {
    return { ok: false, error: 'invalid bookkeepingFee (must be non-negative number)' };
  }

  const adjustmentFee = b.adjustmentFee;
  if (typeof adjustmentFee !== 'number' || !Number.isFinite(adjustmentFee) || adjustmentFee < 0) {
    return { ok: false, error: 'invalid adjustmentFee (must be non-negative number)' };
  }

  const transferStatus = b.transferStatus;
  if (typeof transferStatus !== 'string' || !TRANSFER_STATUSES.includes(transferStatus as any)) {
    return { ok: false, error: 'invalid transferStatus' };
  }

  const bizRegStatus = b.bizRegStatus;
  if (typeof bizRegStatus !== 'string' || !BIZ_REG_STATUSES.includes(bizRegStatus as any)) {
    return { ok: false, error: 'invalid bizRegStatus' };
  }

  const contractNoteRaw = b.contractNote;
  const contractNote =
    typeof contractNoteRaw === 'string' && contractNoteRaw.trim() !== ''
      ? contractNoteRaw.trim()
      : undefined;

  return {
    ok: true,
    value: {
      companyName,
      businessScope: businessScope as NewClientInput['businessScope'],
      representative,
      startDate,
      industry,
      bookkeepingFee,
      adjustmentFee,
      inflowRoute: inflowRoute as NewClientInput['inflowRoute'],
      transferStatus: transferStatus as NewClientInput['transferStatus'],
      bizRegStatus: bizRegStatus as NewClientInput['bizRegStatus'],
      contractNote,
    },
  };
}

const DATE_RE_CHECKLIST = /^\d{4}-\d{2}-\d{2}$/;

export interface ChecklistUpdatePayload {
  status?: string;
  value?: string;
  note?: string;
}

export type ChecklistValidationResult =
  | { ok: true; def: ChecklistItemDefinition; payload: ChecklistUpdatePayload }
  | { ok: false; status: 400 | 404; error: string };

export function validateChecklistUpdate(
  itemKey: string,
  body: unknown,
): ChecklistValidationResult {
  const def = CHECKLIST_ITEM_MAP[itemKey as ChecklistItemKey];
  if (!def) {
    return { ok: false, status: 400, error: `unknown item: ${itemKey}` };
  }

  if (typeof body !== 'object' || body === null) {
    return { ok: false, status: 400, error: 'body must be an object' };
  }
  const b = body as Record<string, unknown>;

  const hasStatus = typeof b.status === 'string';
  const hasValue = typeof b.value === 'string';
  const hasNote = typeof b.note === 'string';

  if (!hasStatus && !hasValue && !hasNote) {
    return { ok: false, status: 400, error: 'no update fields' };
  }

  const payload: ChecklistUpdatePayload = {};
  if (hasNote) payload.note = (b.note as string).trim();

  if (def.kind === 'binary' || def.kind === 'enum') {
    if (!hasStatus) {
      return { ok: true, def, payload };
    }
    const status = b.status as string;
    if (!def.states || !def.states.includes(status)) {
      return {
        ok: false,
        status: 400,
        error: `invalid status for ${itemKey}: ${status}`,
      };
    }
    payload.status = status;
    return { ok: true, def, payload };
  }

  // def.kind === 'value'
  if (!hasValue) {
    return { ok: true, def, payload };
  }
  const value = (b.value as string).trim();
  if (def.valueKind === 'date' && value !== '' && !DATE_RE_CHECKLIST.test(value)) {
    return {
      ok: false,
      status: 400,
      error: `invalid date format for ${itemKey} (expected YYYY-MM-DD)`,
    };
  }
  payload.value = value;
  return { ok: true, def, payload };
}
