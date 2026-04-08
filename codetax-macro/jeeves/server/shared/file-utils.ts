export function sanitizeName(name: string): string {
  return (name || '').replace(/[\\/:*?"<>|]/g, '_').trim() || 'unnamed';
}

export function getDateStr(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
}

export function normalizeBizNum(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length !== 10) throw new Error(`invalid biz number: "${raw}"`);
  return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
}
