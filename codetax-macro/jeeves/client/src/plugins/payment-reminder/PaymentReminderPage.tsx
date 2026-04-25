import { useCallback, useEffect, useState } from 'react';
import { useApi } from '../../core/hooks/useApi';
import { TargetTable } from './components/TargetTable';
import { MessagePreview } from './components/MessagePreview';

interface Preview {
  yearMonth: string;
  targets: Array<{
    recordId: string;
    name: string;
    bizNo: string;
    amount: number;
    message: string;
  }>;
}

interface SendStats {
  stats: { total: number; success: number; failed: number; skipped: number };
  yearMonth: string;
}

export function PaymentReminderPage() {
  const api = useApi();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<SendStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadPreview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const p = await api.get<Preview>('/payment-reminder/preview');
      setPreview(p);
      setSelected(new Set(p.targets.map((t) => t.recordId)));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { void loadPreview(); }, [loadPreview]);

  const onToggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const onToggleAll = (checked: boolean) => {
    if (!preview) return;
    setSelected(checked ? new Set(preview.targets.map((t) => t.recordId)) : new Set());
  };

  const onSend = async () => {
    if (!preview || selected.size === 0) return;
    if (!confirm(`선택된 ${selected.size}건에게 카톡을 발송합니다. 계속하시겠습니까?`)) return;
    setSending(true);
    setError(null);
    try {
      const r = await api.post<SendStats>('/payment-reminder/send', {
        recordIds: Array.from(selected),
      });
      setResult(r);
      await loadPreview();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  };

  const firstSelected = preview?.targets.find((t) => selected.has(t.recordId));

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h2 className="text-lg font-bold">💬 미수업체 입금요청 카톡 (익월 10일)</h2>
        <p className="text-sm text-muted mt-1">
          Airtable 수수료 테이블 [전월] 뷰에서 출금상태=출금실패 거래처에 입금요청 카톡 발송
        </p>
      </div>

      <div className="flex gap-2 items-center">
        <button
          onClick={loadPreview}
          disabled={loading}
          className="px-3 py-1 border border-border rounded"
        >
          {loading ? '불러오는 중…' : '미리보기 새로고침'}
        </button>
        {preview && (
          <span className="text-sm text-muted">
            대상 월: <strong>{preview.yearMonth}</strong> · 총 {preview.targets.length}건
          </span>
        )}
      </div>

      {error && <div className="text-danger text-sm">{error}</div>}

      {preview && (
        <div className="bg-surface border border-border rounded-xl p-5 space-y-3">
          <h3 className="font-bold text-sm">대상 거래처 (선택 {selected.size}건)</h3>
          <TargetTable
            targets={preview.targets}
            selected={selected}
            onToggle={onToggle}
            onToggleAll={onToggleAll}
          />
        </div>
      )}

      {firstSelected && (
        <div>
          <h3 className="font-bold text-sm mb-2">멘트 미리보기 (첫 선택 거래처 기준)</h3>
          <MessagePreview message={firstSelected.message} recipientName={firstSelected.name} />
        </div>
      )}

      <div>
        <button
          onClick={onSend}
          disabled={sending || selected.size === 0}
          className="px-4 py-2 bg-accent text-white rounded font-bold disabled:opacity-40"
        >
          {sending ? '발송 중…' : `발송 (선택 ${selected.size}건)`}
        </button>
      </div>

      {result && (
        <div className="bg-surface border border-border rounded-xl p-5 text-sm">
          <h3 className="font-bold mb-2">발송 결과</h3>
          <div>월: {result.yearMonth}</div>
          <div>총 {result.stats.total}건 / 성공 {result.stats.success} / 실패 {result.stats.failed} / 건너뜀 {result.stats.skipped}</div>
        </div>
      )}
    </div>
  );
}
