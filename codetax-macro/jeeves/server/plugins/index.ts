import type { MacroPlugin } from './types';
import { vatNoticePlugin } from './vat-notice';
import { kakaoSendPlugin } from './kakao-send';
import { messagesPlugin } from './messages';
import { thebillSyncPlugin } from './thebill-sync';

export const plugins: MacroPlugin[] = [
  vatNoticePlugin,
  kakaoSendPlugin,
  messagesPlugin,
  thebillSyncPlugin,
];
