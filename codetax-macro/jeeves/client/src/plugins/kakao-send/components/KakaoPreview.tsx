interface KakaoPreviewProps {
  groupName: string;
  message: string;
  cardImageUrl: string | null;
  bizImageUrl: string | null;
}

export function KakaoPreview({ groupName, message, cardImageUrl, bizImageUrl }: KakaoPreviewProps) {
  const time = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="w-[260px] shrink-0 sticky top-0 self-start">
      <div className="text-xs text-muted mb-2">전송 미리보기</div>
      <div className="bg-[#1e1e1e] rounded-[14px] overflow-hidden border border-[#333] shadow-xl font-sans">
        {/* Window chrome */}
        <div className="bg-[#2a2a2a] px-3.5 py-2.5 flex items-center gap-1.5">
          <span className="w-[11px] h-[11px] rounded-full bg-[#ff5f56] inline-block" />
          <span className="w-[11px] h-[11px] rounded-full bg-[#ffbd2e] inline-block" />
          <span className="w-[11px] h-[11px] rounded-full bg-[#27c93f] inline-block" />
        </div>
        {/* Header */}
        <div className="bg-[#2a2a2a] px-3.5 py-2.5 flex items-center gap-2.5 border-b border-[#333]">
          <div className="w-9 h-9 rounded-full bg-[#444] flex items-center justify-center text-base shrink-0">👤</div>
          <div>
            <div className="text-[13px] font-semibold text-white">{groupName || '(기장소통방)'}</div>
            <div className="text-[11px] text-[#888]">카카오톡</div>
          </div>
        </div>
        {/* Chat area */}
        <div className="bg-[#0a0a0a] p-3.5 flex flex-col justify-end gap-1.5">
          {message && (
            <div className="flex flex-col items-end gap-0.5">
              <div className="bg-[#f9e000] text-[#2a2000] rounded-xl rounded-br-sm px-3 py-2 text-xs leading-relaxed max-w-[200px] break-all shadow-md whitespace-pre-wrap">
                {message}
              </div>
              <div className="text-[10px] text-[#555]">{time}</div>
            </div>
          )}
          {cardImageUrl && (
            <div className="flex flex-col items-end gap-0.5">
              <div className="bg-[#f9e000] rounded-xl rounded-br-sm overflow-hidden w-40 shadow-lg">
                <img src={cardImageUrl} className="w-full h-auto block" />
              </div>
            </div>
          )}
          <div className="flex flex-col items-end gap-0.5">
            <div className={`${bizImageUrl ? 'bg-[#f9e000]' : 'bg-[#222]'} rounded-xl rounded-br-sm overflow-hidden w-40 h-[200px] flex items-center justify-center shadow-lg`}>
              {bizImageUrl ? (
                <img src={bizImageUrl} className="w-full h-full object-cover" />
              ) : (
                <div className="text-[#555] text-[11px]">이미지 없음</div>
              )}
            </div>
            <div className="text-[10px] text-[#555]">{time}</div>
          </div>
        </div>
        {/* Input bar */}
        <div className="bg-[#1a1a1a] px-2.5 py-2 flex items-center gap-2 border-t border-[#333]">
          <div className="flex-1 bg-[#2a2a2a] rounded-[18px] px-3.5 py-[7px] text-xs text-[#555]">메시지 입력</div>
          <div className="bg-[#f9e000] rounded-lg px-3 py-1.5 text-xs font-bold text-[#3a3000]">전송</div>
        </div>
      </div>
    </div>
  );
}
