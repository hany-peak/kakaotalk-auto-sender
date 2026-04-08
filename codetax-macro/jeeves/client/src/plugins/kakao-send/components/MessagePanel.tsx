import { useState, useEffect } from 'react';
import { useApi } from '../../../core/hooks/useApi';

interface MessagePanelProps {
  selectedMessage: string;
  onSelect: (msg: string, idx: number) => void;
}

export function MessagePanel({ selectedMessage: _selectedMessage, onSelect }: MessagePanelProps) {
  const api = useApi();
  const [messages, setMessages] = useState<string[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const [newMsg, setNewMsg] = useState('');

  useEffect(() => {
    api.get('/messages').then((data) => {
      setMessages(data);
      if (data.length > 0 && selectedIdx === -1) {
        setSelectedIdx(data.length - 1);
        onSelect(data[data.length - 1], data.length - 1);
      }
    });
  }, []);

  function select(idx: number) {
    if (selectedIdx === idx) {
      setSelectedIdx(-1);
      onSelect('', -1);
    } else {
      setSelectedIdx(idx);
      onSelect(messages[idx], idx);
    }
  }

  async function addMessage() {
    if (!newMsg.trim()) return;
    const data = await api.post('/messages', { text: newMsg.trim() });
    setMessages(data.list);
    setNewMsg('');
  }

  async function deleteMessage(idx: number) {
    const data = await api.del(`/messages/${idx}`);
    setMessages(data.list);
    if (selectedIdx === idx) { setSelectedIdx(-1); onSelect('', -1); }
    else if (selectedIdx > idx) setSelectedIdx(selectedIdx - 1);
  }

  return (
    <div className="mb-4">
      <div className="text-xs text-muted mb-2">
        Send Message <span className="text-border">(skip to send image only)</span>
      </div>
      <div className="flex flex-col gap-1.5 mb-2.5">
        {messages.map((msg, i) => (
          <div
            key={i}
            onClick={() => select(i)}
            className={`flex items-start gap-2 p-2.5 rounded-lg cursor-pointer border transition-all ${
              selectedIdx === i
                ? 'border-accent bg-accent/[0.08]'
                : 'border-border bg-surface2'
            }`}
          >
            <div className="flex-1 text-[13px] text-text leading-relaxed whitespace-pre-wrap">{msg}</div>
            <button
              onClick={(e) => { e.stopPropagation(); deleteMessage(i); }}
              className="text-muted text-[15px] hover:text-danger"
            >
              x
            </button>
          </div>
        ))}
      </div>
      <div className="flex gap-2 items-start">
        <textarea
          value={newMsg}
          onChange={(e) => setNewMsg(e.target.value)}
          rows={2}
          placeholder="New message..."
          className="flex-1 bg-surface2 border border-border rounded-lg text-text p-2 text-[13px] resize-y outline-none font-[inherit]"
        />
        <button
          onClick={addMessage}
          className="border border-border rounded-lg px-3 py-2 text-sm text-muted hover:text-text shrink-0"
        >
          + Add
        </button>
      </div>
    </div>
  );
}
