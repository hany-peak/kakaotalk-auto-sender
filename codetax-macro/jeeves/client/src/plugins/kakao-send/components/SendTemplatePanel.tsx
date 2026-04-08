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
    <div className="mb-4">
      {/* Template selector */}
      {templates.length > 0 && (
        <div className="mb-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs text-muted">전송 템플릿</span>
            <button
              onClick={() => setShowSaveForm(!showSaveForm)}
              className="text-xs text-accent border border-accent rounded-md px-2 py-0.5"
            >
              + 현재 설정 저장
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {templates.map((t) => (
              <div
                key={t.id}
                onClick={() => selectTemplate(t.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer border transition-all text-[13px] ${
                  selectedTemplateId === t.id
                    ? 'border-accent bg-accent/10 text-accent'
                    : 'border-border bg-surface2 text-muted hover:text-text'
                }`}
              >
                <span>{t.name}</span>
                {t.cardImageName && <span className="text-[10px] text-muted">🎴</span>}
                <button
                  onClick={(e) => { e.stopPropagation(); deleteTemplate(t.id); }}
                  className="text-muted hover:text-danger text-sm ml-1"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Save template form */}
      {showSaveForm && (
        <div className="flex gap-2 items-center mb-3 p-2.5 bg-surface2 rounded-lg">
          <input
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            placeholder="템플릿 이름"
            className="flex-1 bg-surface border border-border rounded-md text-text px-2.5 py-1.5 text-[13px] outline-none"
          />
          <button onClick={saveCurrentAsTemplate} className="bg-accent text-white rounded-md px-3 py-1.5 text-xs">저장</button>
          <button onClick={() => setShowSaveForm(false)} className="text-muted text-xs">취소</button>
        </div>
      )}

      {/* No templates yet: show save button */}
      {templates.length === 0 && (
        <div className="mb-2">
          <button
            onClick={() => setShowSaveForm(!showSaveForm)}
            className="text-xs text-accent border border-accent rounded-md px-2 py-0.5"
          >
            + 전송 템플릿으로 저장
          </button>
        </div>
      )}

      {/* Individual message and card panels */}
      <MessagePanel
        selectedMessage={selectedMessage}
        onSelect={(msg) => { onMessageChange(msg); setSelectedTemplateId(null); }}
      />
      <CardImagePanel
        selected={selectedCard}
        onSelect={(card) => { onCardChange(card); setSelectedTemplateId(null); }}
      />
    </div>
  );
}
