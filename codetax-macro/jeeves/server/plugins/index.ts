import type { MacroPlugin } from './types';
import { vatNoticePlugin } from './vat-notice';
import { kakaoSendPlugin } from './kakao-send';
import { messagesPlugin } from './messages';

export const plugins: MacroPlugin[] = [
  vatNoticePlugin,
  kakaoSendPlugin,
  messagesPlugin,
];
