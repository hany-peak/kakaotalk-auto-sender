import type { MacroPlugin } from './types';
import { vatNoticePlugin } from './vat-notice';
import { kakaoSendPlugin } from './kakao-send';
import { messagesPlugin } from './messages';
import { thebillWithdrawalPlugin, thebillReWithdrawalPlugin } from './thebill-sync';
import { newClientPlugin } from './new-client';

export const plugins: MacroPlugin[] = [
  vatNoticePlugin,
  kakaoSendPlugin,
  messagesPlugin,
  thebillWithdrawalPlugin,
  thebillReWithdrawalPlugin,
  newClientPlugin,
];
