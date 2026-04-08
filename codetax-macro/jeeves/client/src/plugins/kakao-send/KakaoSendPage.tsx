import { useState, useEffect, useCallback } from 'react';
import { useKakaoTargets } from './hooks/useKakaoTargets';
import { useKakaoSend } from './hooks/useKakaoSend';
import { useSSE } from '../../core/hooks/useSSE';
import { TargetTable } from './components/TargetTable';
import { MessagePanel } from './components/MessagePanel';
import { CardImagePanel } from './components/CardImagePanel';
import { KakaoPreview } from './components/KakaoPreview';
import { FilterBar } from './components/FilterBar';
import { SendConfirmModal } from './components/SendConfirmModal';
import { LogViewer } from '../../core/components/LogViewer';
import { ImagePopup } from '../../core/components/ImagePopup';
import type { KakaoTarget, SSEEvent } from '../../core/types';

interface KakaoSendPageProps {
  folder?: string | null;
}

export function KakaoSendPage({ folder }: KakaoSendPageProps = {}) {
  const { targets, setTargets, loading: _loading, loadTargets, updateInfo } = useKakaoTargets();
  const { sending, setSending, startSend, stopSend } = useKakaoSend();

  // Selection
  const [checkedKeys, setCheckedKeys] = useState<Set<string>>(new Set());
  const [selectedMessage, setSelectedMessage] = useState('');
  const [selectedCard, setSelectedCard] = useState<any>(null);
  const [hoveredTarget, setHoveredTarget] = useState<KakaoTarget | null>(null);

  // Filter state
  const [textFilter, setTextFilter] = useState('');
  const [imageFilter, setImageFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [noteFilter, setNoteFilter] = useState('');
  const [sortValue, setSortValue] = useState('default');

  // UI state
  const [showConfirm, setShowConfirm] = useState(false);
  const [popupImage, setPopupImage] = useState<string | null>(null);
  const [logs, setLogs] = useState<{ type: 'info' | 'error' | 'success'; message: string }[]>([]);
  const [statusMap, setStatusMap] = useState<Record<string, string>>({});

  // Load targets on mount
  useEffect(() => {
    loadTargets(folder || undefined);
  }, [folder]);

  // Initialize checked keys
  useEffect(() => {
    const keys = new Set(
      targets.filter((t) => t.imageUrl && t.status !== 'done').map((t) => t.bizNo.replace(/-/g, '')),
    );
    setCheckedKeys(keys);
  }, [targets]);

  // SSE events
  const handleEvent = useCallback((event: SSEEvent) => {
    if (event.type === 'kakao-log') {
      setLogs((prev) => [...prev, { type: 'info', message: event.message }]);
    }
    if (event.type === 'kakao-status-update' && event.message?.bizNo) {
      setStatusMap((prev) => ({ ...prev, [event.message.bizNo.replace(/-/g, '')]: event.message.status }));
    }
    if (event.type === 'kakao-done') {
      setLogs((prev) => [...prev, { type: 'success', message: event.message }]);
      setSending(false);
      loadTargets(folder || undefined);
    }
  }, [folder]);

  useSSE(handleEvent);

  // Filter logic
  const noteOptions = [...new Set(targets.map((t) => t.note).filter(Boolean) as string[])].sort();

  const filteredTargets = targets.filter((t) => {
    const key = t.bizNo.replace(/-/g, '');
    if (textFilter && ![t.name, t.bizNo, t.groupName].some((v) => v.toLowerCase().includes(textFilter.toLowerCase()))) return false;
    if (imageFilter === 'ok' && t.ocrStatus !== 'ok') return false;
    if (imageFilter === 'warn' && !t.note && t.imageUrl) return false;
    const liveStatus = statusMap[key] || t.status;
    if (statusFilter && liveStatus !== statusFilter) return false;
    if (noteFilter === '__none__' && t.note) return false;
    if (noteFilter && noteFilter !== '__none__' && t.note !== noteFilter) return false;
    return true;
  });

  // Handlers
  function toggleCheck(key: string) {
    setCheckedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function handleGroupNameChange(key: string, value: string) {
    setTargets((prev) => prev.map((t) => (t.bizNo.replace(/-/g, '') === key ? { ...t, groupName: value } : t)));
  }

  async function handleGroupNameSave(key: string, imagePath: string) {
    const target = targets.find((t) => t.bizNo.replace(/-/g, '') === key);
    if (!target) return;
    // imagePath가 없으면 localStorage에만 저장
    if (!imagePath) {
      localStorage.setItem(
        'jeeves_group_names',
        JSON.stringify({
          ...JSON.parse(localStorage.getItem('jeeves_group_names') || '{}'),
          [key]: target.groupName,
        }),
      );
      return;
    }
    await updateInfo(imagePath, { groupName: target.groupName });
  }

  function handleSend() {
    const sendTargets = targets.filter((t) => checkedKeys.has(t.bizNo.replace(/-/g, '')));
    if (sendTargets.length === 0) return;
    setShowConfirm(true);
  }

  async function confirmSend() {
    setShowConfirm(false);
    setLogs([]);
    const sendTargets = targets.filter((t) => checkedKeys.has(t.bizNo.replace(/-/g, '')));
    await startSend(sendTargets, selectedMessage, selectedCard?.path || '');
  }

  const allChecked = filteredTargets.length > 0 && filteredTargets.every((t) => checkedKeys.has(t.bizNo.replace(/-/g, '')));
  const preview = hoveredTarget || targets[0];

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <h3 className="font-bold text-sm">카카오톡 자동 전송</h3>
        <button onClick={() => loadTargets(folder || undefined)} className="border border-border rounded-lg px-3 py-1 text-xs text-muted hover:text-text">
          🔄 새로고침
        </button>
        <button
          onClick={handleSend}
          disabled={sending || checkedKeys.size === 0}
          className="ml-auto bg-accent text-white px-4 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-accent/90"
        >
          💬 전송 시작 ({checkedKeys.size}건)
        </button>
        {sending && (
          <button onClick={stopSend} className="bg-danger text-white px-3 py-1.5 rounded-lg text-sm hover:bg-danger/90">
            ⏹ 전송 중지
          </button>
        )}
      </div>

      <MessagePanel selectedMessage={selectedMessage} onSelect={(msg) => setSelectedMessage(msg)} />
      <CardImagePanel selected={selectedCard} onSelect={setSelectedCard} />

      {targets.length > 0 && (
        <FilterBar
          textFilter={textFilter} onTextChange={setTextFilter}
          imageFilter={imageFilter} onImageChange={setImageFilter}
          statusFilter={statusFilter} onStatusChange={setStatusFilter}
          noteFilter={noteFilter} onNoteChange={setNoteFilter}
          noteOptions={noteOptions}
          sortValue={sortValue} onSortChange={setSortValue}
          shownCount={filteredTargets.length} totalCount={targets.length}
        />
      )}

      <div className="flex gap-5 items-start">
        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          <TargetTable
            targets={filteredTargets}
            checkedKeys={checkedKeys}
            onToggle={toggleCheck}
            onToggleAll={(checked) => {
              const keys = new Set(checked ? filteredTargets.map((t) => t.bizNo.replace(/-/g, '')) : []);
              setCheckedKeys(keys);
            }}
            allChecked={allChecked}
            onHover={setHoveredTarget}
            onImageClick={setPopupImage}
            onGroupNameChange={handleGroupNameChange}
            onGroupNameSave={handleGroupNameSave}
            statusMap={statusMap}
          />
        </div>

        {preview && (
          <KakaoPreview
            groupName={preview.groupName}
            message={selectedMessage}
            cardImageUrl={selectedCard?.url || null}
            bizImageUrl={preview.imageUrl}
          />
        )}
      </div>

      {logs.length > 0 && (
        <div className="mt-4">
          <div className="text-xs text-muted mb-1.5">전송 로그</div>
          <LogViewer logs={logs} height="260px" />
        </div>
      )}

      {showConfirm && (
        <SendConfirmModal
          targets={targets.filter((t) => checkedKeys.has(t.bizNo.replace(/-/g, '')))}
          message={selectedMessage}
          cardImageName={selectedCard?.name || null}
          cardImageUrl={selectedCard?.url || null}
          onConfirm={confirmSend}
          onCancel={() => setShowConfirm(false)}
        />
      )}

      <ImagePopup src={popupImage} onClose={() => setPopupImage(null)} />
    </div>
  );
}
