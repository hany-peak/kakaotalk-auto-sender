import { useCallback, useState } from 'react';
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
