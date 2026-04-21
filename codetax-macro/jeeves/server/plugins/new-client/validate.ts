import {
  BUSINESS_SCOPES,
  INFLOW_ROUTES,
  type NewClientInput,
} from './types';

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
      contractNote,
    },
  };
}
