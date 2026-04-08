import { useState } from 'react';
import { MessagePanel } from './MessagePanel';
import { CardImagePanel } from './CardImagePanel';

interface SendTemplate {
  id: string;
  name: string;
  message: string;
  cardImageUrl: string | null;
  cardImagePath: string | null;
  cardImageName: string | null;
}

interface SendTemplatePanelProps {
  selectedMessage: string;
  onMessageChange: (msg: string) => void;
  selectedCard: { name: string; url: string; path: string } | null;
  onCardChange: (card: { name: string; url: string; path: string } | null) => void;
}

export function SendTemplatePanel({ selectedMessage, onMessageChange, selectedCard, onCardChange }: SendTemplatePanelProps) {
  const [templates, setTemplates] = useState<SendTemplate[]>(() => {
    try { return JSON.parse(localStorage.getItem('jeeves_send_templates') || '[]'); }
    catch { return []; }
  });
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [tab, setTab] = useState<'template' | 'custom'>('template');
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [templateName, setTemplateName] = useState('');

  function saveTemplates(list: SendTemplate[]) {
    setTemplates(list);
    localStorage.setItem('jeeves_send_templates', JSON.stringify(list));
  }

  function selectTemplate(id: string) {
    if (selectedTemplateId === id) {
      setSelectedTemplateId(null);
      return;
    }
    const t = templates.find((t) => t.id === id);
    if (!t) return;
    setSelectedTemplateId(id);
    onMessageChange(t.message);
    if (t.cardImageUrl && t.cardImageName && t.cardImagePath) {
      onCardChange({ name: t.cardImageName, url: t.cardImageUrl, path: t.cardImagePath });
    } else {
      onCardChange(null);
    }
  }

  function saveCurrentAsTemplate() {
    if (!templateName.trim()) return;
    const newTemplate: SendTemplate = {
      id: Date.now().toString(),
      name: templateName.trim(),
      message: selectedMessage,
      cardImageUrl: selectedCard?.url || null,
      cardImagePath: selectedCard?.path || null,
      cardImageName: selectedCard?.name || null,
    };
    saveTemplates([...templates, newTemplate]);
    setTemplateName('');
    setShowSaveForm(false);
    setSelectedTemplateId(newTemplate.id);
  }

  function deleteTemplate(id: string) {
    saveTemplates(templates.filter((t) => t.id !== id));
    if (selectedTemplateId === id) setSelectedTemplateId(null);
  }

  return (
    <div className="bg-surface border border-border rounded-xl p-5 mb-4">
      <div className="text-sm font-bold mb-3">전송 설정</div>

      {/* Tabs */}
      <div className="flex gap-0 mb-4 border-b border-border">
        <button
          onClick={() => setTab('template')}
          className={`px-4 py-2 text-[13px] font-medium border-b-2 transition-colors ${
            tab === 'template'
              ? 'border-accent text-accent'
              : 'border-transparent text-muted hover:text-text'
          }`}
        >
          템플릿 선택
        </button>
        <button
          onClick={() => setTab('custom')}
          className={`px-4 py-2 text-[13px] font-medium border-b-2 transition-colors ${
            tab === 'custom'
              ? 'border-accent text-accent'
              : 'border-transparent text-muted hover:text-text'
          }`}
        >
          직접 설정
        </button>
      </div>

      {/* Template Tab */}
      {tab === 'template' && (
        <div>
          {templates.length === 0 ? (
            <div className="text-center py-8 text-muted text-sm">
              <div className="text-3xl mb-2">📋</div>
              저장된 템플릿이 없습니다.
              <br />
              <span className="text-xs">"직접 설정" 탭에서 문구와 카드 이미지를 설정한 뒤 템플릿으로 저장할 수 있습니다.</span>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {templates.map((t) => (
                <div
                  key={t.id}
                  onClick={() => selectTemplate(t.id)}
                  className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer border transition-all ${
                    selectedTemplateId === t.id
                      ? 'border-accent bg-accent/10'
                      : 'border-border bg-surface2 hover:border-accent/50'
                  }`}
                >
                  {/* Card image thumbnail */}
                  {t.cardImageUrl ? (
                    <img src={t.cardImageUrl} className="w-10 h-10 rounded-md object-cover border border-border shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-md bg-border flex items-center justify-center text-lg shrink-0">📝</div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold truncate">{t.name}</div>
                    <div className="text-[11px] text-muted truncate">
                      {t.message ? t.message.substring(0, 50) + (t.message.length > 50 ? '...' : '') : '(문구 없음)'}
                      {t.cardImageName && ` · 🎴 ${t.cardImageName}`}
                    </div>
                  </div>

                  {selectedTemplateId === t.id && (
                    <span className="text-accent text-sm shrink-0">✓ 선택됨</span>
                  )}

                  <button
                    onClick={(e) => { e.stopPropagation(); deleteTemplate(t.id); }}
                    className="text-muted hover:text-danger text-sm shrink-0 p-1"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Custom Tab */}
      {tab === 'custom' && (
        <div>
          <MessagePanel
            selectedMessage={selectedMessage}
            onSelect={(msg) => { onMessageChange(msg); setSelectedTemplateId(null); }}
          />
          <CardImagePanel
            selected={selectedCard}
            onSelect={(card) => { onCardChange(card); setSelectedTemplateId(null); }}
          />

          {/* Save as template */}
          <div className="mt-3 pt-3 border-t border-border">
            {showSaveForm ? (
              <div className="flex gap-2 items-center">
                <input
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="템플릿 이름 (예: 4월 부가세 안내)"
                  onKeyDown={(e) => e.key === 'Enter' && saveCurrentAsTemplate()}
                  className="flex-1 bg-surface2 border border-border rounded-md text-text px-2.5 py-1.5 text-[13px] outline-none"
                />
                <button onClick={saveCurrentAsTemplate} className="bg-accent text-white rounded-md px-3 py-1.5 text-xs font-medium">저장</button>
                <button onClick={() => setShowSaveForm(false)} className="text-muted text-xs">취소</button>
              </div>
            ) : (
              <button
                onClick={() => setShowSaveForm(true)}
                disabled={!selectedMessage && !selectedCard}
                className="text-xs text-accent border border-accent rounded-md px-3 py-1.5 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-accent/10 transition-colors"
              >
                💾 현재 설정을 템플릿으로 저장
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
