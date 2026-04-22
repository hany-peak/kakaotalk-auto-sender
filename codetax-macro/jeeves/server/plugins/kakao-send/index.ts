import type { MacroPlugin } from '../types';
import { registerKakaoRoutes } from './routes';

export const kakaoSendPlugin: MacroPlugin = {
  id: 'kakao-send',
  name: '카카오톡 전송',
  icon: '💬',
  status: 'ready',
  registerRoutes: registerKakaoRoutes,
};
