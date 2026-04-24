import { useCallback, useRef, useState } from 'react';
import { useApi } from '../../../core/hooks/useApi';
import type { NewClientRecord } from '../types';

type AuxFieldKey = 'openDate' | 'bankName' | 'accountNumber' | 'bizAddress';
type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface AuxState {
  openDate: string;
  bankName: string;
  accountNumber: string;
  bizAddress: string;
}

export function useAuxInputs(
  clientId: string,
  initial: { openDate?: string; bankName?: string; accountNumber?: string; bizAddress?: string },
  onRecordRefresh: (record: NewClientRecord) => void,
) {
  const { patch } = useApi();
  const [values, setValues] = useState<AuxState>({
    openDate: initial.openDate ?? '',
    bankName: initial.bankName ?? '',
    accountNumber: initial.accountNumber ?? '',
    bizAddress: initial.bizAddress ?? '',
  });
  const [status, setStatus] = useState<Record<AuxFieldKey, SaveStatus>>({
    openDate: 'idle', bankName: 'idle', accountNumber: 'idle', bizAddress: 'idle',
  });
  const lastSaved = useRef<AuxState>(values);
  const fadeTimers = useRef<Partial<Record<AuxFieldKey, ReturnType<typeof setTimeout>>>>({});

  const setField = useCallback((key: AuxFieldKey, v: string) => {
    setValues((cur) => ({ ...cur, [key]: v }));
  }, []);

  const commitField = useCallback(
    async (key: AuxFieldKey) => {
      const cur = values[key];
      if (lastSaved.current[key] === cur) return;
      setStatus((s) => ({ ...s, [key]: 'saving' }));
      try {
        const res = await patch<{ record: NewClientRecord }>(
          `/new-client/${clientId}/aux`,
          { [key]: cur },
        );
        lastSaved.current = { ...lastSaved.current, [key]: cur };
        onRecordRefresh(res.record);
        setStatus((s) => ({ ...s, [key]: 'saved' }));
        if (fadeTimers.current[key]) clearTimeout(fadeTimers.current[key]!);
        fadeTimers.current[key] = setTimeout(
          () => setStatus((s) => ({ ...s, [key]: 'idle' })),
          2000,
        );
      } catch (_e) {
        setStatus((s) => ({ ...s, [key]: 'error' }));
      }
    },
    [patch, clientId, values, onRecordRefresh],
  );

  return { values, status, setField, commitField };
}
