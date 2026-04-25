import type { MacroPagePlugin } from '../types';
import { KakaoStandalonePage } from './KakaoStandalonePage';

export const kakaoSendPlugin: MacroPagePlugin = {
  id: 'kakao-send',
  name: '카카오톡 전송',
  icon: '💬',
  status: 'ready',
  description: '그룹 카톡방 이미지·문구 자동 전송',
  Page: KakaoStandalonePage,
  category: 'send',
};
