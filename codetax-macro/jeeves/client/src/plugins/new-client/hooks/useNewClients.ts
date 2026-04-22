import { useCallback, useEffect, useState } from 'react';
import { useApi } from '../../../core/hooks/useApi';
import type { NewClientListItem, NewClientRecord } from '../types';

export function useClientList() {
  const api = useApi();
  const [list, setList] = useState<NewClientListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<NewClientListItem[]>('/new-client/list');
      setList(data);
    } catch (e: any) {
      setError(e.message ?? 'failed to load');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { list, loading, error, reload };
}

export function useClientDetail(id: string | null) {
  const api = useApi();
  const [record, setRecord] = useState<NewClientRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!id) {
      setRecord(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<NewClientRecord>(`/new-client/${id}`);
      setRecord(data);
    } catch (e: any) {
      setError(e.message ?? 'failed to load');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { record, loading, error, reload, setRecord };
}
