const HOLIDAY_DATES: Record<number, string[]> = {
  2026: [
    '2026-01-01', // 신정
    '2026-02-16', '2026-02-17', '2026-02-18', // 설날 연휴
    '2026-03-01', // 삼일절
    '2026-05-05', // 어린이날
    '2026-05-24', // 부처님오신날
    '2026-06-06', // 현충일
    '2026-08-15', // 광복절
    '2026-09-24', '2026-09-25', '2026-09-26', // 추석 연휴
    '2026-10-03', // 개천절
    '2026-10-09', // 한글날
    '2026-12-25', // 크리스마스
  ],
  2027: [
    '2027-01-01',
    '2027-02-06', '2027-02-07', '2027-02-08',
    '2027-03-01',
    '2027-05-05',
    '2027-05-13',
    '2027-06-06',
    '2027-08-15',
    '2027-09-14', '2027-09-15', '2027-09-16',
    '2027-10-03',
    '2027-10-09',
    '2027-12-25',
  ],
};

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function isHoliday(d: Date): boolean {
  const list = HOLIDAY_DATES[d.getFullYear()];
  if (!list) return false;
  return list.includes(toIsoDate(d));
}

export const SUPPORTED_HOLIDAY_YEARS = Object.keys(HOLIDAY_DATES).map(Number);
