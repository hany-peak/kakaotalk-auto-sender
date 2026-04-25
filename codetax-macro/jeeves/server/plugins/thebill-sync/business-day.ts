import { isHoliday } from './holidays';

/**
 * 오늘 기준 가장 최근의 25일 (=가장 최근 출금 cycle reference).
 * 오늘이 25일 이전이면 전월 25일 반환 (cycle 이 한 달 전 25일에 시작했으므로).
 */
export function mostRecentMonth25(now: Date = new Date()): Date {
  const this25 = new Date(now.getFullYear(), now.getMonth(), 25);
  if (now >= this25) return this25;
  return new Date(now.getFullYear(), now.getMonth() - 1, 25);
}

export function isBusinessDay(d: Date): boolean {
  const day = d.getDay();
  if (day === 0 || day === 6) return false; // Sun, Sat
  return !isHoliday(d);
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function adjustToBusinessDay(
  d: Date,
  direction: 'forward' | 'backward',
): Date {
  let cur = new Date(d);
  const step = direction === 'forward' ? 1 : -1;
  for (let i = 0; i < 30; i++) {
    if (isBusinessDay(cur)) return cur;
    cur = addDays(cur, step);
  }
  throw new Error(`adjustToBusinessDay: no business day found within 30 days`);
}

export function addBusinessDays(d: Date, days: number): Date {
  if (days === 0) return new Date(d);
  let cur = new Date(d);
  let remaining = days;
  const step = days > 0 ? 1 : -1;
  remaining = Math.abs(remaining);
  while (remaining > 0) {
    cur = addDays(cur, step);
    if (isBusinessDay(cur)) remaining -= 1;
  }
  return cur;
}
