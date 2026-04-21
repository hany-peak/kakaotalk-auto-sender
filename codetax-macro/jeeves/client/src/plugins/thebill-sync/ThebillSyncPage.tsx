import { useCallback, useEffect, useState } from 'react';
import { useApi } from '../../core/hooks/useApi';
import { useSSE } from '../../core/hooks/useSSE';
import { LogViewer } from '../../core/components/LogViewer';
import { ScheduleSettingsCard } from './components/ScheduleSettingsCard';
import type { SSEEvent } from '../../core/types';

interface RunResult {
  status: 'success' | 'error';
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  summary: string;
  error?: string;
  meta?: Record<string, unknown>;
}

interface LogEntry {
  type: 'info' | 'error' | 'success';
  message: string;
}

const PLUGIN_ID = 'thebill-sync';

export function ThebillSyncPage() {
  const api = useApi();
  const [history, setHistory] = useState<RunResult[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [detail, setDetail] = useState<RunResult | null>(null);

  const loadHistory = useCallback(async () => {
    try {
      const list = await api.get<RunResult[]>(`/scheduler/${PLUGIN_ID}/history`);
      setHistory(list);
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const handleEvent = useCallback(
    (event: SSEEvent) => {
      const msg = typeof event.message === 'string' ? event.message : JSON.stringify(event.message);
      if (event.type === 'log' && msg.includes(`[${PLUGIN_ID}]`)) {
        setLogs((prev) => [...prev, { type: 'info', message: msg }]);
      } else if (event.type === 'error' && msg.includes(`[${PLUGIN_ID}]`)) {
        setLogs((prev) => [...prev, { type: 'error', message: msg }]);
      } else if (event.type === 'scheduler-run-finished' && event.message?.pluginId === PLUGIN_ID) {
        loadHistory();
      }
    },
    [loadHistory],
  );

  useSSE(handleEvent);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h2 className="text-lg font-bold">📊 매월 미납 금액 슬랙 자동 전송</h2>
        <p className="text-sm text-muted mt-1">
          더빌 CMS → 엑셀 파싱 → Airtable 업데이트 → 슬랙 알림 자동 파이프라인
        </p>
      </div>

      <ScheduleSettingsCard pluginId={PLUGIN_ID} onRun={loadHistory} />

      <div className="bg-surface border border-border rounded-xl p-5">
        <h3 className="font-bold text-sm mb-3">최근 실행 이력 (최근 {history.length}건)</h3>
        {history.length === 0 ? (
          <div className="text-xs text-muted">실행 이력이 없습니다.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-muted border-b border-border">
                <tr>
                  <th className="text-left py-2">시각</th>
                  <th className="text-left">상태</th>
                  <th className="text-left">요약</th>
                  <th className="text-right">소요</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {history.map((r) => (
                  <tr key={r.startedAt} className="border-b border-border/50">
                    <td className="py-2">{new Date(r.startedAt).toLocaleString()}</td>
                    <td>
                      <span className={r.status === 'success' ? 'text-success' : 'text-danger'}>
                        {r.status === 'success' ? '✅ 성공' : '❌ 실패'}
                      </span>
                    </td>
                    <td className="truncate max-w-xs">{r.summary}</td>
                    <td className="text-right">{Math.round(r.durationMs / 1000)}초</td>
                    <td className="text-right">
                      <button
                        className="text-accent hover:underline"
                        onClick={() => setDetail(r)}
                      >
                        상세
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <h3 className="font-bold text-sm mb-2">실시간 로그</h3>
        <LogViewer logs={logs} height="240px" />
      </div>

      {detail && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50"
          onClick={() => setDetail(null)}
        >
          <div
            className="bg-surface border border-border rounded-xl p-5 max-w-2xl w-full max-h-[80vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-3">
              <h3 className="font-bold">실행 상세</h3>
              <button onClick={() => setDetail(null)} className="text-muted">
                ✕
              </button>
            </div>
            <div className="text-xs space-y-2">
              <div>시작: {new Date(detail.startedAt).toLocaleString()}</div>
              <div>종료: {new Date(detail.finishedAt).toLocaleString()}</div>
              <div>
                상태:{' '}
                <span className={detail.status === 'success' ? 'text-success' : 'text-danger'}>
                  {detail.status}
                </span>
              </div>
              <div>요약: {detail.summary}</div>
              {detail.meta && (
                <div>
                  <div className="text-muted mt-2">meta:</div>
                  <pre className="bg-surface2 p-2 rounded overflow-x-auto">
                    {JSON.stringify(detail.meta, null, 2)}
                  </pre>
                </div>
              )}
              {detail.error && (
                <div>
                  <div className="text-muted mt-2">error:</div>
                  <pre className="bg-surface2 p-2 rounded overflow-x-auto text-danger">
                    {detail.error}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
