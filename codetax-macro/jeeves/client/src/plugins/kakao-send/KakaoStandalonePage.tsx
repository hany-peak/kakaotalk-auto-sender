import { useState, useCallback } from 'react';
import { useKakaoSend } from './hooks/useKakaoSend';
import { useSSE } from '../../core/hooks/useSSE';
import { CsvUpload } from './components/CsvUpload';
import { SendTemplatePanel } from './components/SendTemplatePanel';
import { SimpleTargetTable } from './components/SimpleTargetTable';
import { KakaoPreview } from './components/KakaoPreview';
import { SendConfirmModal } from './components/SendConfirmModal';
import { LogViewer } from '../../core/components/LogViewer';
import type { KakaoTarget, SSEEvent } from '../../core/types';

interface SimpleTarget {
  name: string;
  bizNo: string;
  groupName: string;
  status: string;
}

export function KakaoStandalonePage() {
  const { sending, setSending, startSend, stopSend } = useKakaoSend();

  const [targets, setTargets] = useState<SimpleTarget[]>([]);
  const [checkedKeys, setCheckedKeys] = useState<Set<string>>(new Set());
  const [selectedMessage, setSelectedMessage] = useState('');
  const [selectedCard, setSelectedCard] = useState<{ name: string; url: string; path: string } | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [logs, setLogs] = useState<{ type: 'info' | 'error' | 'success'; message: string }[]>([]);
  const [statusMap, setStatusMap] = useState<Record<string, string>>({});

  // SSE
  const handleEvent = useCallback((event: SSEEvent) => {
    if (event.type === 'kakao-log') {
      setLogs((prev) => [...prev, { type: 'info', message: event.message }]);
    }
    if (event.type === 'kakao-status-update' && event.message?.bizNo) {
      const key = event.message.bizNo.replace(/-/g, '');
      setStatusMap((prev) => ({ ...prev, [key]: event.message.status }));
    }
    if (event.type === 'kakao-done') {
      setLogs((prev) => [...prev, { type: 'success', message: event.message }]);
      setSending(false);
    }
  }, [setSending]);

  useSSE(handleEvent);

  function handleCsvParsed(parsed: { name: string; bizNo: string; groupName: string }[]) {
    const newTargets = parsed.map((t) => ({ ...t, status: 'pending' }));
    setTargets(newTargets);
    setCheckedKeys(new Set(newTargets.map((t) => t.bizNo.replace(/-/g, ''))));
    setStatusMap({});
    setLogs([]);
  }

  function toggleCheck(key: string) {
    setCheckedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  function handleGroupNameChange(key: string, value: string) {
    setTargets((prev) => prev.map((t) => (t.bizNo.replace(/-/g, '') === key ? { ...t, groupName: value } : t)));
  }

  function handleSend() {
    const sendTargets = targets.filter((t) => checkedKeys.has(t.bizNo.replace(/-/g, '')));
    if (sendTargets.length === 0) return;
    setShowConfirm(true);
  }

  async function confirmSend() {
    setShowConfirm(false);
    setLogs([]);
    const sendTargets = targets
      .filter((t) => checkedKeys.has(t.bizNo.replace(/-/g, '')))
      .map((t) => ({
        name: t.name,
        bizNo: t.bizNo,
        groupName: t.groupName,
        imagePath: null,
      }));
    await startSend(sendTargets, selectedMessage, selectedCard?.path || '');
  }

  const allChecked = targets.length > 0 && targets.every((t) => checkedKeys.has(t.bizNo.replace(/-/g, '')));

  // Convert to KakaoTarget-like shape for SendConfirmModal compatibility
  const confirmTargets: KakaoTarget[] = targets
    .filter((t) => checkedKeys.has(t.bizNo.replace(/-/g, '')))
    .map((t) => ({
      ...t,
      taxAmount: 0,
      imageFile: null,
      imagePath: null,
      imageUrl: null,
      dateFolder: '',
      ocrStatus: null,
      ocrNote: null,
      ocrVerifiedAt: null,
      note: null,
      taxList: [],
      taxYear: 0,
      taxPeriod: 0,
    }));

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-lg font-bold">💬 카카오톡 전송</h2>
        <p className="text-sm text-muted mt-1">거래처 엑셀/CSV 업로드 → 문구·카드 이미지 설정 → 그룹 카톡방 자동 전송</p>
      </div>

      {/* CSV Upload */}
      <CsvUpload onParsed={handleCsvParsed} />

      {targets.length > 0 && (
        <>
          <div className="text-xs text-muted mb-3">
            📋 {targets.length}개 거래처 로드됨
          </div>

          {/* Template Panel (message + card image) */}
          <SendTemplatePanel
            selectedMessage={selectedMessage}
            onMessageChange={setSelectedMessage}
            selectedCard={selectedCard}
            onCardChange={setSelectedCard}
          />

          {/* Action bar */}
          <div className="flex items-center gap-2 mb-3">
            <button
              onClick={handleSend}
              disabled={sending || checkedKeys.size === 0}
              className="bg-accent text-white px-4 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-accent/90"
            >
              💬 전송 시작 ({checkedKeys.size}건)
            </button>
            {sending && (
              <button onClick={stopSend} className="bg-danger text-white px-3 py-1.5 rounded-lg text-sm hover:bg-danger/90">
                ⏹ 전송 중지
              </button>
            )}
          </div>

          {/* Table + Preview */}
          <div className="flex gap-5 items-start">
            <div className="flex-1">
              <SimpleTargetTable
                targets={targets}
                checkedKeys={checkedKeys}
                onToggle={toggleCheck}
                onToggleAll={(checked) => {
                  setCheckedKeys(new Set(checked ? targets.map((t) => t.bizNo.replace(/-/g, '')) : []));
                }}
                allChecked={allChecked}
                onGroupNameChange={handleGroupNameChange}
                statusMap={statusMap}
              />
            </div>

            <KakaoPreview
              groupName={targets[0]?.groupName || ''}
              message={selectedMessage}
              cardImageUrl={selectedCard?.url || null}
              bizImageUrl={null}
            />
          </div>

          {/* Log */}
          {logs.length > 0 && (
            <div className="mt-4">
              <div className="text-xs text-muted mb-1.5">전송 로그</div>
              <LogViewer logs={logs} height="260px" />
            </div>
          )}

          {/* Confirm Modal */}
          {showConfirm && (
            <SendConfirmModal
              targets={confirmTargets}
              message={selectedMessage}
              cardImageName={selectedCard?.name || null}
              cardImageUrl={selectedCard?.url || null}
              onConfirm={confirmSend}
              onCancel={() => setShowConfirm(false)}
            />
          )}
        </>
      )}
    </div>
  );
}
