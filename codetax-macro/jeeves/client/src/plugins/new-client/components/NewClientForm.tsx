import { useState } from 'react';

export type BusinessScope = '기장' | '신고대리';
export type InflowRoute = '소개1' | '소개2' | '블로그';

export interface NewClientFormValues {
  companyName: string;
  businessScope: BusinessScope;
  representative: string;
  startDate: string;
  industry: string;
  bookkeepingFee: number;
  adjustmentFee: number;
  inflowRoute: InflowRoute;
  contractNote: string;
}

const EMPTY: NewClientFormValues = {
  companyName: '',
  businessScope: '기장',
  representative: '',
  startDate: '',
  industry: '',
  bookkeepingFee: 0,
  adjustmentFee: 0,
  inflowRoute: '소개1',
  contractNote: '',
};

interface Props {
  submitting: boolean;
  onSubmit: (values: NewClientFormValues) => Promise<void>;
}

export function NewClientForm({ submitting, onSubmit }: Props) {
  const [values, setValues] = useState<NewClientFormValues>(EMPTY);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof NewClientFormValues>(k: K, v: NewClientFormValues[K]) =>
    setValues((prev) => ({ ...prev, [k]: v }));

  function validate(): string | null {
    if (!values.companyName.trim()) return '업체명을 입력하세요';
    if (!values.representative.trim()) return '대표자를 입력하세요';
    if (!values.startDate) return '업무착수일을 입력하세요';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(values.startDate)) return '업무착수일 형식이 올바르지 않습니다 (YYYY-MM-DD)';
    if (!values.industry.trim()) return '업종을 입력하세요';
    if (values.bookkeepingFee < 0) return '기장료는 0 이상이어야 합니다';
    if (values.adjustmentFee < 0) return '조정료는 0 이상이어야 합니다';
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const err = validate();
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    try {
      await onSubmit(values);
      setValues(EMPTY);
    } catch (e: any) {
      setError(e?.message || '저장 중 오류가 발생했습니다');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-xl">
      <div>
        <label className="block text-sm font-medium mb-1">업체명 *</label>
        <input
          type="text"
          className="w-full border border-border rounded px-3 py-2 bg-surface"
          value={values.companyName}
          onChange={(e) => set('companyName', e.target.value)}
          disabled={submitting}
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">업무 범위 *</label>
        <select
          className="w-full border border-border rounded px-3 py-2 bg-surface"
          value={values.businessScope}
          onChange={(e) => set('businessScope', e.target.value as BusinessScope)}
          disabled={submitting}
        >
          <option value="기장">기장</option>
          <option value="신고대리">신고대리</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">대표자 *</label>
        <input
          type="text"
          className="w-full border border-border rounded px-3 py-2 bg-surface"
          value={values.representative}
          onChange={(e) => set('representative', e.target.value)}
          disabled={submitting}
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">업무착수일 *</label>
        <input
          type="date"
          className="w-full border border-border rounded px-3 py-2 bg-surface"
          value={values.startDate}
          onChange={(e) => set('startDate', e.target.value)}
          disabled={submitting}
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">업종 *</label>
        <input
          type="text"
          className="w-full border border-border rounded px-3 py-2 bg-surface"
          value={values.industry}
          onChange={(e) => set('industry', e.target.value)}
          disabled={submitting}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">기장료 (원) *</label>
          <input
            type="number"
            min={0}
            className="w-full border border-border rounded px-3 py-2 bg-surface"
            value={values.bookkeepingFee}
            onChange={(e) => set('bookkeepingFee', Number(e.target.value))}
            disabled={submitting}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">조정료 (원) *</label>
          <input
            type="number"
            min={0}
            className="w-full border border-border rounded px-3 py-2 bg-surface"
            value={values.adjustmentFee}
            onChange={(e) => set('adjustmentFee', Number(e.target.value))}
            disabled={submitting}
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">유입경로 *</label>
        <select
          className="w-full border border-border rounded px-3 py-2 bg-surface"
          value={values.inflowRoute}
          onChange={(e) => set('inflowRoute', e.target.value as InflowRoute)}
          disabled={submitting}
        >
          <option value="소개1">소개1</option>
          <option value="소개2">소개2</option>
          <option value="블로그">블로그</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">계약특이사항</label>
        <textarea
          className="w-full border border-border rounded px-3 py-2 bg-surface"
          rows={3}
          value={values.contractNote}
          onChange={(e) => set('contractNote', e.target.value)}
          disabled={submitting}
        />
      </div>

      {error && <div className="text-red-600 text-sm">{error}</div>}

      <button
        type="submit"
        disabled={submitting}
        className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50 hover:bg-blue-700"
      >
        {submitting ? '등록 중...' : '등록'}
      </button>
    </form>
  );
}
