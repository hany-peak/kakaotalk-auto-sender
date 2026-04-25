import { useState, useCallback } from 'react';
import { useApi } from '../../../core/hooks/useApi';

export function useKakaoSend() {
  const api = useApi();
  const [sending, setSending] = useState(false);

  const startSend = useCallback(async (targets: any[], message: string, cardImagePath: string) => {
    setSending(true);
    try {
      await api.post('/kakao/start', { targets, message, cardImagePath });
    } catch {
      setSending(false);
    }
  }, [api]);

  const stopSend = useCallback(async () => {
    try {
      await api.post('/kakao/stop');
    } catch {}
    setSending(false);
  }, [api]);

  return { sending, setSending, startSend, stopSend };
}
