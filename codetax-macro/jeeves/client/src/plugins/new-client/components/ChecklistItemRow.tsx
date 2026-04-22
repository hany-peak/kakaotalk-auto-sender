import { useEffect, useState } from 'react';
import { isItemDone } from '../types';
import type {
  ChecklistItemDefinition,
  ChecklistItemState,
  ChecklistUpdateInput,
} from '../types';

interface Props {
  def: ChecklistItemDefinition;
  state: ChecklistItemState | undefined;
  pending: boolean;
  onUpdate: (payload: ChecklistUpdateInput) => Promise<void>;
}

function formatKst(iso: string | undefined): string {
  if (!iso) return '-';
  const d = new Date(iso);
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return `${String(kst.getUTCMonth() + 1).padStart(2, '0')}-${String(kst.getUTCDate()).padStart(2, '0')} ${String(kst.getUTCHours()).padStart(2, '0')}:${String(kst.getUTCMinutes()).padStart(2, '0')}`;
}

export function ChecklistItemRow({ def, state, pending, onUpdate }: Props) {
  const done = isItemDone(def, state);
  const [localValue, setLocalValue] = useState<string>(state?.value ?? '');
  const [localNote, setLocalNote] = useState<string>(state?.note ?? '');
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setLocalValue(state?.value ?? '');
    setLocalNote(state?.note ?? '');
  }, [state?.value, state?.note]);

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

  return (
    <tr className={`border-b border-border ${done ? 'bg-surface2/40' : ''}`}>
      <td className="py-2 pr-3 text-xs text-muted whitespace-nowrap">
        {def.step ? `STEP ${def.step}` : ''}
      </td>
      <td className="py-2 pr-3 font-medium whitespace-nowrap">{def.label}</td>
      <td className="py-2 pr-3 text-xs text-muted">{def.description ?? ''}</td>
      <td className="py-2 pr-3">
        {renderEditor(def, state, localValue, setLocalValue, submitStatus, submitValue)}
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
