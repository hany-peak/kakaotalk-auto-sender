import type { KakaoTarget } from '../../../core/types';

interface SendConfirmModalProps {
  targets: KakaoTarget[];
  message: string;
  cardImageName: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export function SendConfirmModal({ targets, message, cardImageName, onConfirm, onCancel }: SendConfirmModalProps) {
  const withImg = targets.filter((t) => t.imageUrl).length;
  const noImg = targets.length - withImg;

  return (
    <div
      onClick={onCancel}
      className="fixed inset-0 z-[1000] bg-black/65 backdrop-blur-sm flex items-center justify-center"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-surface border border-border rounded-2xl w-[620px] max-w-[90vw] max-h-[80vh] p-7 shadow-2xl flex flex-col"
      >
        <div className="flex items-center justify-between mb-4">
          <span className="text-base font-bold">💬 카카오톡 전송 확인</span>
          <button onClick={onCancel} className="text-muted text-xl cursor-pointer bg-transparent border-none">x</button>
        </div>

        <div className="text-[13px] text-muted mb-3">
          총 <b className="text-accent">{targets.length}</b>건 전송 예정
          {' '}(이미지 있음: {withImg}{noImg > 0 && <>, <span className="text-danger">이미지 없음: {noImg}</span></>})
        </div>

        {message ? (
          <div className="text-xs text-muted bg-surface2 rounded-lg p-2.5 mb-3 whitespace-pre-wrap">
            <b>전송 문구:</b><br />{message}
          </div>
        ) : (
          <div className="text-xs text-yellow-400 mb-3">⚠ 전송 문구 미선택 — 이미지만 전송됩니다</div>
        )}

        {cardImageName && (
          <div className="text-xs text-muted mb-3">Card image: <b>{cardImageName}</b></div>
        )}

        <div className="flex-1 overflow-y-auto max-h-[320px] mb-4">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left p-1">사업자명</th>
                <th className="text-left p-1">사업자번호</th>
                <th className="text-left p-1">카톡방</th>
                <th className="text-center p-1">이미지</th>
              </tr>
            </thead>
            <tbody>
              {targets.map((t) => (
                <tr key={t.bizNo} className="border-b border-border/50">
                  <td className="p-1">{t.name}</td>
                  <td className="p-1 font-mono">{t.bizNo}</td>
                  <td className="p-1 text-muted">{t.groupName}</td>
                  <td className="p-1 text-center">{t.imageUrl ? '✅' : <span className="text-danger">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end gap-2.5">
          <button onClick={onCancel} className="border border-border rounded-lg px-4 py-2 text-sm text-muted hover:bg-surface2">
            취소
          </button>
          <button onClick={onConfirm} className="bg-accent text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-accent/90">
            전송하기
          </button>
        </div>
      </div>
    </div>
  );
}
