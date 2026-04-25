import { useEffect, useState } from 'react';
import { useApi } from '../../../core/hooks/useApi';

interface SchedulerPluginInfo {
  id: string;
  name: string;
  icon: string;
  enabled: boolean;
  cron: string;
  defaultCron: string;
  timezone: string;
  lastRun: {
    status: 'success' | 'error';
    startedAt: string;
    summary: string;
  } | null;
}

interface Props {
  pluginId: string;
  onRun?: () => void;
  // true 면 cron/enable UI 숨기고 "실행" 버튼 + 마지막 실행 요약만 표시.
  manualOnly?: boolean;
}

export function ScheduleSettingsCard({ pluginId, onRun, manualOnly = false }: Props) {
  const api = useApi();
  const [info, setInfo] = useState<SchedulerPluginInfo | null>(null);
  const [cronDraft, setCronDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const list = await api.get<SchedulerPluginInfo[]>('/scheduler/plugins');
      const mine = list.find((p) => p.id === pluginId) ?? null;
      setInfo(mine);
      if (mine) setCronDraft(mine.cron);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pluginId]);

  async function save(patch: { enabled?: boolean; cron?: string }) {
    setSaving(true);
    setError(null);
    try {
      await api.post(`/scheduler/${pluginId}/update`, patch);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function runNow() {
    setRunning(true);
    setError(null);
    try {
      await api.post(`/scheduler/${pluginId}/run-now`);
      await load();
      onRun?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  }

  if (!info) {
    return (
      <div className="bg-surface border border-border rounded-xl p-5 text-sm text-muted">
        {error ?? '스케줄 정보 로딩 중...'}
      </div>
    );
  }

  if (manualOnly) {
    return (
      <div className="bg-surface border border-border rounded-xl p-5">
        <div className="flex items-center justify-between gap-4">
          <div className="text-xs text-muted flex-1 min-w-0">
            {info.lastRun ? (
              <>
                <div>마지막 실행:</div>
                <div
                  className={
                    info.lastRun.status === 'success' ? 'text-success' : 'text-danger'
                  }
                >
                  {info.lastRun.status === 'success' ? '✅' : '❌'} {info.lastRun.summary}
                </div>
                <div className="text-[10px] mt-1">
                  {new Date(info.lastRun.startedAt).toLocaleString()}
                </div>
              </>
            ) : (
              '실행 이력 없음'
            )}
          </div>
          <button
            className="px-4 py-2 bg-accent text-white rounded font-bold disabled:opacity-50 whitespace-nowrap"
            disabled={running}
            onClick={runNow}
          >
            {running ? '실행 중...' : '▶ 지금 실행'}
          </button>
        </div>
        {error && <div className="text-danger text-xs pt-3">{error}</div>}
      </div>
    );
  }

  return (
    <div className="bg-surface border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-sm">⏰ 스케줄 설정</h3>
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={info.enabled}
            disabled={saving}
            onChange={(e) => save({ enabled: e.target.checked })}
          />
          <span className={info.enabled ? 'text-success' : 'text-muted'}>
            {info.enabled ? '활성' : '비활성'}
          </span>
        </label>
      </div>

      <div className="space-y-3 text-xs">
        <div>
          <label className="block text-muted mb-1">Cron 표현식 (TZ: {info.timezone})</label>
          <div className="flex gap-2">
            <input
              className="flex-1 bg-surface2 border border-border rounded px-2 py-1 font-mono"
              value={cronDraft}
              onChange={(e) => setCronDraft(e.target.value)}
              placeholder={info.defaultCron}
            />
            <button
              className="px-3 py-1 bg-accent text-white rounded disabled:opacity-50"
              disabled={saving || cronDraft === info.cron}
              onClick={() => save({ cron: cronDraft })}
            >
              저장
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-border">
          <div className="text-muted">
            {info.lastRun ? (
              <>
                마지막 실행:{' '}
                <span className={info.lastRun.status === 'success' ? 'text-success' : 'text-danger'}>
                  {info.lastRun.status === 'success' ? '✅' : '❌'} {info.lastRun.summary}
                </span>
                <div className="text-[10px]">
                  {new Date(info.lastRun.startedAt).toLocaleString()}
                </div>
              </>
            ) : (
              '실행 이력 없음'
            )}
          </div>
          <button
            className="px-3 py-1 bg-surface2 border border-border rounded hover:border-accent disabled:opacity-50"
            disabled={running}
            onClick={runNow}
          >
            {running ? '실행 중...' : '지금 실행'}
          </button>
        </div>

        {error && <div className="text-danger pt-2">{error}</div>}
      </div>
    </div>
  );
}
