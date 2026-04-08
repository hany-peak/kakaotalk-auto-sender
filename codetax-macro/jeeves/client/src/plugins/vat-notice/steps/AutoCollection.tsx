import { useApi } from '../../../core/hooks/useApi';

interface Business {
  name: string;
  bizNo: string;
  taxAmount: number;
}

interface AutoCollectionProps {
  businesses: Business[];
  taxYear: number;
  taxPeriod: number;
  onStarted: () => void;
}

export function AutoCollection({ businesses, taxYear, taxPeriod, onStarted }: AutoCollectionProps) {
  const api = useApi();

  async function handleStart() {
    try {
      await api.post('/vat/start', {
        businesses: businesses.map((b) => ({
          ...b,
          groupName: b.name,
        })),
        taxYear,
        taxPeriod,
      });
      onStarted();
    } catch (err: any) {
      console.error('Start failed:', err.message);
    }
  }

  return (
    <div className="bg-surface border border-border rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="bg-accent text-white text-[10px] px-2 py-0.5 rounded-full font-bold">STEP 3</span>
        <h3 className="font-bold text-sm">자동화 수집</h3>
        <span className="bg-success/20 text-success text-[11px] px-2 py-0.5 rounded-full">
          ✅ 세션 확인됨
        </span>
      </div>

      <button
        onClick={handleStart}
        disabled={businesses.length === 0}
        className="bg-accent text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-accent/90 transition-colors"
      >
        ⬇ 자동화 수집 ({businesses.length}건)
      </button>
    </div>
  );
}
