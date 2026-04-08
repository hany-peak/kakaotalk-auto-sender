import { useState, useCallback } from 'react';
import { ProgressBar } from '../../../core/components/ProgressBar';
import { LogViewer } from '../../../core/components/LogViewer';
import { useSSE } from '../../../core/hooks/useSSE';
import { useApi } from '../../../core/hooks/useApi';
import type { SSEEvent } from '../../../core/types';

interface CollectionProgressProps {
  onDone: () => void;
}

export function CollectionProgress({ onDone }: CollectionProgressProps) {
  const api = useApi();
  const [progress, setProgress] = useState({ current: 0, total: 0, success: 0, failed: 0 });
  const [logs, setLogs] = useState<{ type: 'info' | 'error' | 'success'; message: string }[]>([]);
  const [running, setRunning] = useState(true);

  const handleEvent = useCallback((event: SSEEvent) => {
    if (event.type === 'progress') setProgress(event.message);
    if (event.type === 'log') setLogs((prev) => [...prev, { type: 'info', message: event.message }]);
    if (event.type === 'error') setLogs((prev) => [...prev, { type: 'error', message: event.message }]);
    if (event.type === 'done') {
      setLogs((prev) => [...prev, { type: 'success', message: event.message }]);
      setRunning(false);
      onDone();
    }
  }, [onDone]);

  useSSE(handleEvent);

  async function handleStop() {
    try {
      await api.post('/vat/stop');
      setRunning(false);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="bg-surface border border-border rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="bg-accent text-white text-[10px] px-2 py-0.5 rounded-full font-bold">STEP 4</span>
        <h3 className="font-bold text-sm">자동화 수집 진행</h3>
        <span className="text-[11px] text-accent bg-accent/20 px-2 py-0.5 rounded-full">
          {progress.current}/{progress.total}
        </span>
        {running && (
          <button
            onClick={handleStop}
            className="ml-auto bg-danger text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-danger/90"
          >
            ⏹ 중지
          </button>
        )}
      </div>

      <ProgressBar {...progress} />

      <div className="mt-4">
        <div className="text-xs text-muted mb-1.5">실시간 로그</div>
        <LogViewer logs={logs} />
      </div>
    </div>
  );
}
