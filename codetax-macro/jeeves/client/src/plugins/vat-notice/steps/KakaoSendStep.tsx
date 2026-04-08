import { KakaoSendPage } from '../../kakao-send/KakaoSendPage';

interface KakaoSendStepProps {
  dateFolder: string | null;
}

export function KakaoSendStep({ dateFolder }: KakaoSendStepProps) {
  return (
    <div className="bg-surface border border-border rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="bg-accent text-white text-[10px] px-2 py-0.5 rounded-full font-bold">STEP 5</span>
      </div>
      <KakaoSendPage folder={dateFolder} />
    </div>
  );
}
