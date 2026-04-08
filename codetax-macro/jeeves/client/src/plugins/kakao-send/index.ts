import type { MacroPagePlugin } from '../types';
import { KakaoSendPage } from './KakaoSendPage';

export const kakaoSendPlugin: MacroPagePlugin = {
  id: 'kakao-send',
  name: '카카오톡 전송',
  icon: '💬',
  status: 'ready',
  description: 'Send images and messages to KakaoTalk group chats',
  Page: KakaoSendPage,
};
