import { useEffect, useState } from 'react';
import { useApi } from '../../../core/hooks/useApi';
import type { DateFolder } from '../../../core/types';

interface FolderSelectModalProps {
  onSelect: (folder: string) => void;
  onCancel: () => void;
}

export function FolderSelectModal({ onSelect, onCancel }: FolderSelectModalProps) {
  const api = useApi();
  const [folders, setFolders] = useState<DateFolder[]>([]);

  useEffect(() => {
    api.get('/kakao/folders').then(setFolders).catch(() => setFolders([]));
  }, []);

  function formatDate(folder: string) {
    return folder.replace(/(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})/, '$1.$2.$3 $4:$5');
  }

  return (
    <div
      onClick={onCancel}
      className="fixed inset-0 z-[1000] bg-black/65 backdrop-blur-sm flex items-center justify-center"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-surface border border-border rounded-2xl w-[480px] max-w-[90vw] max-h-[70vh] p-7 shadow-2xl flex flex-col"
      >
        <div className="flex items-center mb-4">
          <span className="text-base font-bold">📂 이전 작업 내역</span>
          <button
            onClick={onCancel}
            className="ml-auto bg-transparent border-none text-muted text-xl cursor-pointer"
          >
            ✕
          </button>
        </div>
        <div className="text-xs text-muted mb-3">
          작업 내역을 선택하면 해당 데이터로 카카오톡 전송 탭이 열립니다.
        </div>
        <div className="flex-1 overflow-y-auto">
          {folders.length === 0 && (
            <div className="text-center text-muted py-8">이전 작업 데이터가 없습니다.</div>
          )}
          {folders.map((f) => (
            <div
              key={f.folder}
              onClick={() => onSelect(f.folder)}
              className="flex items-center gap-3 p-3 border border-border rounded-[10px] mb-2 cursor-pointer transition-colors hover:border-accent hover:bg-accent/[0.06]"
            >
              <div className="text-2xl">📁</div>
              <div className="flex-1">
                <div className="text-sm font-semibold">{formatDate(f.folder)}</div>
                <div className="text-xs text-muted">
                  {f.taxYear ? `${f.taxYear}년 ${f.taxPeriod}기 · ` : ''}
                  {f.bizCount}건
                </div>
              </div>
              <div className="text-xs text-accent">선택 →</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
