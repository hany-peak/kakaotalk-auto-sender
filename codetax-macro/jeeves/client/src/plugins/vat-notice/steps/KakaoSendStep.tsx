interface KakaoSendStepProps {
  dateFolder: string | null;
}

export function KakaoSendStep({ dateFolder }: KakaoSendStepProps) {
  // Will import and render KakaoSendPage from kakao-send plugin
  // For now, placeholder
  return (
    <div className="bg-surface border border-border rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="bg-accent text-white text-[10px] px-2 py-0.5 rounded-full font-bold">STEP 5</span>
        <h3 className="font-bold text-sm">KakaoTalk Send</h3>
      </div>
      <div className="text-muted text-sm">
        KakaoTalk send component will be embedded here. Folder: {dateFolder || 'latest'}
      </div>
    </div>
  );
}
