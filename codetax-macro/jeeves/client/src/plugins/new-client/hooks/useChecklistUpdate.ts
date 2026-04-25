import { useCallback, useEffect, useState } from 'react';
import { useApi } from '../../../core/hooks/useApi';
import type {
  ChecklistItemKey,
  ChecklistUpdateInput,
  ChecklistUpdateResponse,
} from '../types';

export function useChecklistUpdate(clientId: string | null) {
  const api = useApi();
  const [pending, setPending] = useState<ChecklistItemKey | null>(null);
  const [error, setError] = useState<string | null>(null);

  const update = useCallback(
    async (itemKey: ChecklistItemKey, payload: ChecklistUpdateInput) => {
      if (!clientId) throw new Error('no client');
      setPending(itemKey);
      setError(null);
      try {
        const res = await api.patch<ChecklistUpdateResponse>(
          `/new-client/${clientId}/checklist/${itemKey}`,
          payload,
        );
        return res;
      } catch (e: any) {
        setError(e.message ?? 'update failed');
        throw e;
      } finally {
        setPending(null);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [clientId],
  );

  return { update, pending, error };
}

export function useDropboxRetry(clientId: string | null) {
  const api = useApi();
  const [pending, setPending] = useState(false);

  const retry = useCallback(async () => {
    if (!clientId) throw new Error('no client');
    setPending(true);
    try {
      return await api.post<{ ok: true; path: string; state: { status: string; updatedAt: string } }>(
        `/new-client/${clientId}/dropbox-folder/retry`,
        {},
      );
    } finally {
      setPending(false);
    }
  }, [api, clientId]);

  return { retry, pending };
}

export interface DropboxStatus {
  path: string | null;
  exists: boolean;
  files: string[];
}

export function useWehagoRegister(clientId: string | null) {
  const api = useApi();
  const [pending, setPending] = useState(false);
  const register = useCallback(async () => {
    if (!clientId) throw new Error('no client');
    setPending(true);
    try {
      return await api.post<{ ok: true; companyName: string; state: { status: string; updatedAt: string } }>(
        `/new-client/${clientId}/wehago/register`,
        {},
      );
    } finally {
      setPending(false);
    }
  }, [api, clientId]);
  return { register, pending };
}

export function useDropboxStatus(clientId: string | null) {
  const api = useApi();
  const [data, setData] = useState<DropboxStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<DropboxStatus>(`/new-client/${clientId}/dropbox-status`);
      setData(res);
    } catch (e: any) {
      setError(e.message ?? 'failed');
    } finally {
      setLoading(false);
    }
    // useApi() returns a fresh object every render; excluding `api` from deps
    // keeps refresh stable so the effect below doesn't fire on every parent re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}
