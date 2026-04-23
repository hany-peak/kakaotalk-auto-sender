import type { BusinessScope, EntityType } from './types';

const TEAM_FOLDER_ROOT = '/세무법인의 팀 폴더/2.기장';

/**
 * Returns the Dropbox parent path for a new client based on entity/scope combination.
 * Paths are returned without a trailing slash.
 */
export function resolveParentPath(
  entityType: EntityType,
  businessScope: BusinessScope,
): string {
  if (entityType === '개인' && businessScope === '기장') return `${TEAM_FOLDER_ROOT}/개인/일반기장`;
  if (entityType === '개인' && businessScope === '신고대리') return `${TEAM_FOLDER_ROOT}/개인/신고대리`;
  if (entityType === '법인' && businessScope === '기장') return `${TEAM_FOLDER_ROOT}/법인`;
  if (entityType === '법인' && businessScope === '신고대리') return `${TEAM_FOLDER_ROOT}/법인/000 신고대리`;
  // Exhaustiveness guard — should be unreachable if types are correct.
  throw new Error(`unreachable: ${entityType} × ${businessScope}`);
}

/**
 * Extracts leading digits from a folder name. Returns null if no leading digits.
 */
export function parseLeadingNumber(name: string): number | null {
  const m = name.match(/^(\d+)/);
  if (!m) return null;
  return parseInt(m[1], 10);
}

/**
 * Formats a client folder name as "NNN. 업체명" with 3-digit zero-pad (4+ digits stay as-is).
 */
export function formatFolderName(n: number, companyName: string): string {
  const padded = n < 1000 ? String(n).padStart(3, '0') : String(n);
  return `${padded}. ${companyName}`;
}
