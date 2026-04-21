import { useState } from 'react';
import { useApi } from '../../core/hooks/useApi';
import { NewClientForm, type NewClientFormValues } from './components/NewClientForm';

interface SubmitResponse {
  ok: boolean;
  id: string;
  slackNotified: boolean;
}

type Toast = { kind: 'success' | 'warn' | 'error'; message: string } | null;

export function NewClientPage() {
  const api = useApi();
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<Toast>(null);

  async function handleSubmit(values: NewClientFormValues) {
    setSubmitting(true);
    setToast(null);
    try {
      const body = {
        ...values,
        contractNote: values.contractNote.trim() === '' ? undefined : values.contractNote,
      };
      const res = await api.post<SubmitResponse>('/new-client/submit', body);
      if (res.slackNotified) {
        setToast({ kind: 'success', message: '등록 완료 — Slack 알림 전송됨' });
      } else {
        setToast({
          kind: 'warn',
          message: '등록 완료 — Slack 알림 실패 (서버 로그 확인)',
        });
      }
    } catch (e: any) {
      setToast({ kind: 'error', message: e?.message || '등록 실패' });
      throw e;
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h2 className="text-lg font-bold">📋 신규 수임처 등록</h2>
        <p className="text-sm text-muted mt-1">
          양식 입력 후 등록 시 로컬에 저장되고 Slack 채널로 알림이 전송됩니다.
        </p>
      </div>

      {toast && (
        <div
          className={
            'px-3 py-2 rounded text-sm ' +
            (toast.kind === 'success'
              ? 'bg-green-100 text-green-800'
              : toast.kind === 'warn'
                ? 'bg-yellow-100 text-yellow-800'
                : 'bg-red-100 text-red-800')
          }
        >
          {toast.message}
        </div>
      )}

      <div className="bg-surface border border-border rounded-xl p-5">
        <NewClientForm submitting={submitting} onSubmit={handleSubmit} />
      </div>
    </div>
  );
}
