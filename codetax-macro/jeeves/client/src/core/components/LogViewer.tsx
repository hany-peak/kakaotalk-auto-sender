import { useEffect, useRef } from 'react';

interface LogEntry {
  type: 'info' | 'error' | 'success';
  message: string;
}

interface LogViewerProps {
  logs: LogEntry[];
  height?: string;
}

export function LogViewer({ logs, height = '200px' }: LogViewerProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [logs]);

  const colorMap = {
    info: 'text-text',
    error: 'text-danger',
    success: 'text-success',
  };

  return (
    <div
      ref={ref}
      className="bg-surface2 rounded-lg p-3.5 overflow-y-auto font-mono text-xs leading-7 whitespace-pre-wrap"
      style={{ height }}
    >
      {logs.map((log, i) => (
        <div key={i} className={colorMap[log.type]}>
          {log.message}
        </div>
      ))}
    </div>
  );
}
