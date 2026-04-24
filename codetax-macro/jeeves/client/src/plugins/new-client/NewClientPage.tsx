import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApi } from '../../core/hooks/useApi';
import { NewClientForm, type NewClientFormValues } from './components/NewClientForm';
import { ClientListTable } from './components/ClientListTable';
import { ChecklistTable } from './components/ChecklistTable';
import { AuxInputsPanel } from './components/AuxInputsPanel';
import { ProgressPill } from './components/ProgressPill';
import { useClientList, useClientDetail } from './hooks/useNewClients';
import { useChecklistUpdate } from './hooks/useChecklistUpdate';
import { isItemDone, CHECKLIST_ITEMS } from './types';
import type {
  ChecklistItemKey,
  ChecklistUpdateInput,
  NewClientRecord,
} from './types';

type View = 'list' | 'detail' | 'register';
type Toast = { kind: 'success' | 'warn' | 'error'; message: string } | null;

interface SubmitResponse {
  ok: boolean;
  id: string;
  slackNotified: boolean;
}

export function NewClientPage() {
  const api = useApi();
  // View/selection state is reflected in URL query params so page refresh
  // preserves the current view:
  //   (none)                → list
  //   ?mode=register        → register form
  //   ?id=<recordId>        → detail
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get('id');
  const mode = searchParams.get('mode');
  const view: View = mode === 'register' ? 'register' : selectedId ? 'detail' : 'list';

  const [toast, setToast] = useState<Toast>(null);
  const [submitting, setSubmitting] = useState(false);

  const { list, loading: listLoading, error: listError, reload: reloadList } = useClientList();

  function goList() {
    setSearchParams({});
  }
  function goRegister() {
    setSearchParams({ mode: 'register' });
    setToast(null);
  }
  function goDetail(id: string) {
    setSearchParams({ id });
  }

  async function handleRegister(values: NewClientFormValues) {
    setSubmitting(true);
    setToast(null);
    try {
      const body = {
        ...values,
        contractNote: values.contractNote.trim() === '' ? undefined : values.contractNote,
      };
      const res = await api.post<SubmitResponse>('/new-client/submit', body);
      setToast({
        kind: res.slackNotified ? 'success' : 'warn',
        message: res.slackNotified
          ? '등록 완료 — Slack 알림 전송됨'
          : '등록 완료 — Slack 알림 실패 (서버 로그 확인)',
      });
      await reloadList();
      goList();
    } catch (e: any) {
      setToast({ kind: 'error', message: e?.message || '등록 실패' });
      throw e;
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-4">
      <Header view={view} onBack={goList} onRegister={goRegister} />

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

      {view === 'list' && (
        <>
          {listError && <div className="text-danger text-sm">{listError}</div>}
          {listLoading ? (
            <div className="text-muted">로딩 중...</div>
          ) : (
            <ClientListTable items={list} onSelect={goDetail} />
          )}
        </>
      )}

      {view === 'register' && (
        <div className="bg-surface border border-border rounded-xl p-5">
          <h2 className="text-lg font-bold mb-4">신규 수임처 등록</h2>
          <NewClientForm submitting={submitting} onSubmit={handleRegister} />
        </div>
      )}

      {view === 'detail' && selectedId && (
        <DetailView
          clientId={selectedId}
          onToast={(t) => setToast(t)}
          onListReloadNeeded={reloadList}
        />
      )}
    </div>
  );
}

function Header({
  view,
  onBack,
  onRegister,
}: {
  view: View;
  onBack: () => void;
  onRegister: () => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        {view !== 'list' && (
          <button onClick={onBack} className="text-sm text-muted hover:text-text">
            ← 목록
          </button>
        )}
        <h1 className="text-xl font-bold">📋 신규 수임처</h1>
      </div>
      {view === 'list' && (
        <button
          onClick={onRegister}
          className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm hover:bg-blue-700"
        >
          + 신규 등록
        </button>
      )}
    </div>
  );
}

function DetailView({
  clientId,
  onToast,
  onListReloadNeeded,
}: {
  clientId: string;
  onToast: (t: Toast) => void;
  onListReloadNeeded: () => Promise<void>;
}) {
  const { record, loading, error, setRecord, reload } = useClientDetail(clientId);
  const { update, pending } = useChecklistUpdate(clientId);

  if (loading && !record) return <div className="text-muted">로딩 중...</div>;
  if (error) return <div className="text-danger text-sm">{error}</div>;
  if (!record) return <div className="text-muted">거래처를 찾을 수 없습니다.</div>;

  async function handleUpdate(itemKey: ChecklistItemKey, payload: ChecklistUpdateInput) {
    try {
      const res = await update(itemKey, payload);
      setRecord((prev) =>
        prev ? { ...prev, checklist: { ...prev.checklist, [itemKey]: res.state } } : prev,
      );
      onListReloadNeeded();
    } catch (e: any) {
      onToast({ kind: 'error', message: `저장 실패: ${e.message ?? 'unknown'}` });
      reload();
    }
  }

  const progressDone = CHECKLIST_ITEMS.reduce(
    (n, def) => (isItemDone(def, record.checklist[def.key]) ? n + 1 : n),
    0,
  );

  return (
    <div className="space-y-4">
      <div className="flex items-baseline gap-4">
        <h2 className="text-lg font-bold">{record.companyName}</h2>
        <span className="text-sm text-muted">대표자 {record.representative}</span>
        <div className="ml-auto">
          <ProgressPill done={progressDone} total={CHECKLIST_ITEMS.length} />
        </div>
      </div>

      <InfoCard record={record} />

      <AuxInputsPanel
        record={record}
        onRecordRefresh={(r) => setRecord(r)}
      />

      <div>
        <h3 className="text-sm font-medium mb-2 text-muted">체크리스트</h3>
        <ChecklistTable
          checklist={record.checklist}
          pendingKey={pending}
          clientId={clientId}
          record={record}
          onUpdate={handleUpdate}
          onDropboxStateUpdate={(next) => {
            setRecord((prev) =>
              prev ? { ...prev, checklist: { ...prev.checklist, dropboxFolder: next } } : prev,
            );
            onListReloadNeeded();
          }}
        />
      </div>
    </div>
  );
}

function InfoCard({ record }: { record: NewClientRecord }) {
  const fields: Array<[string, string]> = [
    ['업무 범위', record.businessScope],
    ['업무착수일', record.startDate],
  ];
  if (record.entityType) fields.push(['사업자 형태', record.entityType]);
  if (record.industry) fields.push(['업종', record.industry]);
  if (record.bookkeepingFee !== undefined) {
    fields.push(['기장료', `${record.bookkeepingFee.toLocaleString('en-US')}원`]);
  }
  if (record.adjustmentFee !== undefined) {
    fields.push(['조정료', `${record.adjustmentFee.toLocaleString('en-US')}원`]);
  }
  if (record.inflowRoute) fields.push(['유입경로', record.inflowRoute]);
  if (record.transferStatus) fields.push(['이관여부', record.transferStatus]);
  if (record.bizRegStatus) fields.push(['사업자 생성여부', record.bizRegStatus]);
  if (record.transferSourceOffice) fields.push(['이관사무실', record.transferSourceOffice]);
  if (record.transferReason) fields.push(['이관사유', record.transferReason]);
  if (record.dropboxFolderPath) fields.push(['Dropbox', record.dropboxFolderPath]);
  return (
    <div className="border border-border rounded p-4 space-y-2 text-sm">
      <div className="grid grid-cols-4 gap-3">
        {fields.map(([k, v]) => (
          <div key={k}>
            <div className="text-xs text-muted">{k}</div>
            <div>{v}</div>
          </div>
        ))}
      </div>
      {record.contractNote && (
        <div>
          <div className="text-xs text-muted">계약특이사항</div>
          <div className="whitespace-pre-wrap">{record.contractNote}</div>
        </div>
      )}
    </div>
  );
}
