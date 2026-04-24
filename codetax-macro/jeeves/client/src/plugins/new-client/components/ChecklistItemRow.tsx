import { useEffect, useState } from 'react';
import { isItemDone } from '../types';
import { KATALK_TEMPLATES } from '../katalkTemplates';
import {
  useDropboxRetry,
  useDropboxStatus,
  useWehagoRegister,
  type DropboxStatus,
} from '../hooks/useChecklistUpdate';
import type {
  ChecklistItemDefinition,
  ChecklistItemState,
  ChecklistUpdateInput,
  NewClientRecord,
} from '../types';

interface Props {
  def: ChecklistItemDefinition;
  state: ChecklistItemState | undefined;
  pending: boolean;
  clientId: string | null;
  record: NewClientRecord;
  onUpdate: (payload: ChecklistUpdateInput) => Promise<void>;
  onDropboxUpdate?: (next: ChecklistItemState) => void;
}

function formatKst(iso: string | undefined): string {
  if (!iso) return '-';
  const d = new Date(iso);
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return `${String(kst.getUTCMonth() + 1).padStart(2, '0')}-${String(kst.getUTCDate()).padStart(2, '0')} ${String(kst.getUTCHours()).padStart(2, '0')}:${String(kst.getUTCMinutes()).padStart(2, '0')}`;
}

export function ChecklistItemRow({ def, state, pending, clientId, record, onUpdate, onDropboxUpdate }: Props) {
  const recordOpenDate = record.openDate;
  const done = isItemDone(def, state);
  const isDropbox = def.key === 'dropboxFolder';
  const [localValue, setLocalValue] = useState<string>(state?.value ?? '');
  const [localNote, setLocalNote] = useState<string>(state?.note ?? '');
  const [err, setErr] = useState<string | null>(null);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const isWehago = def.key === 'wehago';
  const { retry: retryDropbox, pending: dropboxRetrying } = useDropboxRetry(clientId);
  const dropboxStatus = useDropboxStatus(isDropbox ? clientId : null);
  const { register: registerWehago, pending: wehagoRegistering } = useWehagoRegister(clientId);

  useEffect(() => {
    setLocalValue(state?.value ?? '');
    setLocalNote(state?.note ?? '');
  }, [state?.value, state?.note]);

  async function copyTemplate(idx: number, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIdx(idx);
      window.setTimeout(() => {
        setCopiedIdx((cur) => (cur === idx ? null : cur));
      }, 1500);
    } catch {
      setErr('복사 실패 (브라우저 권한 확인)');
    }
  }

  async function submitStatus(next: string) {
    setErr(null);
    try { await onUpdate({ status: next }); }
    catch (e: any) { setErr(e.message ?? 'failed'); }
  }
  async function submitValue(next: string) {
    if ((state?.value ?? '') === next) return;
    setErr(null);
    try { await onUpdate({ value: next }); }
    catch (e: any) { setErr(e.message ?? 'failed'); }
  }
  async function submitNote(next: string) {
    if ((state?.note ?? '') === next) return;
    setErr(null);
    try { await onUpdate({ note: next }); }
    catch (e: any) { setErr(e.message ?? 'failed'); }
  }

  async function handleDropboxRetry() {
    setErr(null);
    try {
      const res = await retryDropbox();
      onDropboxUpdate?.({ status: res.state.status, updatedAt: res.state.updatedAt });
      await dropboxStatus.refresh();
    } catch (e: any) {
      setErr(e.message ?? 'retry failed');
    }
  }

  async function handleWehagoRegister() {
    setErr(null);
    try {
      const res = await registerWehago(recordOpenDate ?? '');
      await onUpdate({ status: res.state.status });
    } catch (e: any) {
      setErr(e.message ?? 'wehago register failed');
    }
  }

  return (
    <tr className={`border-b border-border ${done ? 'bg-surface2/40' : ''}`}>
      <td className="py-2 pr-3 text-xs text-muted whitespace-nowrap">
        {def.step ? `STEP ${def.step}` : ''}
      </td>
      <td className="py-2 pr-3 font-medium whitespace-nowrap">{def.label}</td>
      <td className="py-2 pr-3 text-xs text-muted">
        <div>{def.description ?? ''}</div>
        {def.key === 'katalkRoom' && (
          <div className="flex gap-1 mt-1 flex-wrap">
            {KATALK_TEMPLATES.map((t, i) => (
              <button
                key={t.label}
                type="button"
                onClick={() => copyTemplate(i, t.text)}
                className={`px-2 py-0.5 rounded text-[11px] border transition-colors ${
                  copiedIdx === i
                    ? 'border-success text-success bg-success/10'
                    : 'border-border text-text hover:bg-surface2'
                }`}
              >
                {copiedIdx === i ? '복사됨 ✓' : t.label}
              </button>
            ))}
          </div>
        )}
      </td>
      <td className="py-2 pr-3">
        {isDropbox
          ? renderDropboxCell(
              dropboxStatus.data,
              dropboxStatus.loading,
              dropboxStatus.error,
              dropboxRetrying,
              handleDropboxRetry,
            )
          : isWehago
            ? renderWehagoCell(state, wehagoRegistering, handleWehagoRegister)
            : renderEditor(def, state, localValue, setLocalValue, submitStatus, submitValue)}
        {err && <div className="text-danger text-xs mt-1">{err}</div>}
      </td>
      <td className="py-2 pr-3">
        <input
          value={localNote}
          onChange={(e) => setLocalNote(e.target.value)}
          onBlur={() => submitNote(localNote)}
          placeholder="메모"
          className="w-full px-2 py-1 rounded border border-border bg-surface text-xs"
        />
      </td>
      <td className="py-2 pr-3 text-xs text-muted whitespace-nowrap">
        {pending ? '저장 중...' : formatKst(state?.updatedAt)}
      </td>
    </tr>
  );
}

function renderWehagoCell(
  state: ChecklistItemState | undefined,
  pending: boolean,
  onRegister: () => void,
) {
  const status = state?.status ?? 'none';
  if (status === 'done') {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-success">✓ 등록됨</span>
        <button
          type="button"
          onClick={onRegister}
          disabled={pending}
          className="px-2 py-0.5 text-[11px] border border-border rounded hover:bg-surface2 disabled:opacity-50 text-muted"
          title="다시 등록"
        >
          {pending ? '재등록 중...' : '재등록'}
        </button>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted">미등록</span>
      <button
        type="button"
        onClick={onRegister}
        disabled={pending}
        className="px-2 py-0.5 text-xs border border-border rounded hover:bg-surface2 disabled:opacity-50"
      >
        {pending ? '등록 중...' : '위하고 자동 등록'}
      </button>
    </div>
  );
}

function renderDropboxCell(
  data: DropboxStatus | null,
  loading: boolean,
  statusError: string | null,
  retrying: boolean,
  onCreate: () => void,
) {
  if (loading && !data) {
    return <span className="text-xs text-muted">확인 중...</span>;
  }
  if (statusError) {
    return <span className="text-xs text-danger">⚠ 확인 실패: {statusError}</span>;
  }
  if (!data || !data.exists) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted">폴더 없음</span>
        <button
          type="button"
          onClick={onCreate}
          disabled={retrying}
          className="px-2 py-0.5 text-xs border border-border rounded hover:bg-surface2 disabled:opacity-50"
        >
          {retrying ? '생성 중...' : '폴더 생성'}
        </button>
      </div>
    );
  }
  return (
    <details className="text-xs group">
      <summary className="cursor-pointer list-none flex items-center gap-1 text-success">
        <span className="text-muted group-open:rotate-90 inline-block transition-transform">▸</span>
        <span>✓ 생성됨 · 기초자료 {data.files.length}개</span>
      </summary>
      <div className="mt-2 ml-4 space-y-1 text-muted">
        {data.path && (
          <div className="break-all text-[11px]">
            <span className="opacity-70">경로:</span> {data.path}
          </div>
        )}
        {data.files.length > 0 ? (
          <ul className="list-disc ml-4 space-y-0.5 text-[11px]">
            {data.files.map((f) => <li key={f}>{f}</li>)}
          </ul>
        ) : (
          <div className="text-[11px] italic">(기초자료 폴더가 비어있음)</div>
        )}
      </div>
    </details>
  );
}

function renderEditor(
  def: ChecklistItemDefinition,
  state: ChecklistItemState | undefined,
  localValue: string,
  setLocalValue: (v: string) => void,
  submitStatus: (v: string) => void,
  submitValue: (v: string) => void,
) {
  if (def.kind === 'binary') {
    const checked = state?.status === 'done';
    return (
      <label className="inline-flex items-center gap-1">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => submitStatus(e.target.checked ? 'done' : 'none')}
        />
        <span className="text-xs">{checked ? '완료' : '대기'}</span>
      </label>
    );
  }
  if (def.kind === 'enum') {
    const current = state?.status ?? 'none';
    return (
      <select
        value={current}
        onChange={(e) => submitStatus(e.target.value)}
        className="px-2 py-1 rounded border border-border bg-surface text-xs"
      >
        {def.states!.map((s) => (
          <option key={s} value={s}>{s === 'none' ? '— 선택 —' : s}</option>
        ))}
      </select>
    );
  }
  const type = def.valueKind === 'date' ? 'date' : 'text';
  return (
    <input
      type={type}
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={() => submitValue(localValue.trim())}
      placeholder={def.valueKind === 'date' ? 'YYYY-MM-DD' : ''}
      className="px-2 py-1 rounded border border-border bg-surface text-xs"
    />
  );
}
