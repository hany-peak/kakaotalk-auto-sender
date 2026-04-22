import { useState, useCallback } from 'react';
import { useApi } from '../../../core/hooks/useApi';
import type { KakaoTarget, DateFolder } from '../../../core/types';

export function useKakaoTargets() {
  const api = useApi();
  const [targets, setTargets] = useState<KakaoTarget[]>([]);
  const [loading, setLoading] = useState(false);

  const loadTargets = useCallback(async (folder?: string) => {
    setLoading(true);
    try {
      const url = folder ? `/kakao/targets?folder=${encodeURIComponent(folder)}` : '/kakao/targets';
      const data: KakaoTarget[] = await api.get(url);
      setTargets(data.sort((a, b) => (a.status === 'done' ? 1 : 0) - (b.status === 'done' ? 1 : 0)));
    } catch {
      setTargets([]);
    } finally {
      setLoading(false);
    }
  }, [api]);

  const loadFolders = useCallback(async (): Promise<DateFolder[]> => {
    return api.get('/kakao/folders');
  }, [api]);

  const updateInfo = useCallback(async (imagePath: string, fields: Record<string, any>) => {
    await api.patch('/kakao/info', { imagePath, fields });
  }, [api]);

  return { targets, setTargets, loading, loadTargets, loadFolders, updateInfo };
}
